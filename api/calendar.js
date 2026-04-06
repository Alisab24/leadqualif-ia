/**
 * POST /api/calendar
 *
 * Gestion du calendrier : disponibilités, création d'événements,
 * agent IA de réservation automatique.
 *
 * Actions :
 *   get-availability   { userId, date }               → créneaux libres
 *   create-event        { leadId, title, scheduledAt, durationMinutes, type, notes }
 *   booking-agent       { leadId }                     → WhatsApp avec créneaux + RDV auto
 *   get-upcoming        { limit? }                     → prochains RDV Google/Outlook
 *
 * Variables d'environnement :
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 *   ANTHROPIC_API_KEY
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js'

/* ── Helpers Supabase ────────────────────────────────────────────────────── */
function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function formatDateFr(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTimeFr(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function normalizePhone(p) {
  if (!p) return null
  return p.startsWith('+') ? p : '+' + p.replace(/^00/, '')
}

/* ── Token refresh ───────────────────────────────────────────────────────── */
async function refreshGoogleToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  return r.ok ? r.json() : null
}

async function refreshMicrosoftToken(refreshToken) {
  const r = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
      scope:         'offline_access Mail.Send Mail.Read Calendars.ReadWrite User.Read',
    }),
  })
  return r.ok ? r.json() : null
}

/** Récupère un access_token valide pour un user (auto-refresh si expiré) */
async function getValidToken(userId, table) {
  const supabase = sb()
  const { data } = await supabase.from(table)
    .select('provider, access_token, refresh_token, token_expires_at')
    .eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (!data) return null

  const isExpired = !data.token_expires_at || new Date(data.token_expires_at) < new Date(Date.now() + 60000)
  if (!isExpired) return data

  // Rafraîchir
  const refreshed = data.provider === 'google'
    ? await refreshGoogleToken(data.refresh_token)
    : await refreshMicrosoftToken(data.refresh_token)

  if (!refreshed?.access_token) return data // retourner l'ancien, API essaiera

  const expires = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
  await supabase.from(table).update({
    access_token:    refreshed.access_token,
    token_expires_at: expires,
    updated_at:      new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', data.provider)

  return { ...data, access_token: refreshed.access_token }
}

/* ── Google Calendar ─────────────────────────────────────────────────────── */
async function getGoogleEvents(accessToken, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime' })
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) return []
  const d = await r.json()
  return d.items || []
}

async function createGoogleEvent(accessToken, calendarId, event) {
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(event),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Google Calendar: ${d.error?.message || JSON.stringify(d)}`)
  return d
}

/* ── Microsoft Calendar ──────────────────────────────────────────────────── */
async function getMicrosoftEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({ startDateTime: timeMin, endDateTime: timeMax, $orderby: 'start/dateTime', $top: '50' })
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  })
  if (!r.ok) return []
  const d = await r.json()
  return d.value || []
}

async function createMicrosoftEvent(accessToken, event) {
  const r = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(event),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Microsoft Calendar: ${d.error?.message || JSON.stringify(d)}`)
  return d
}

/* ── Calcul des créneaux libres ──────────────────────────────────────────── */
function getAvailableSlots(busySlots, date, workStart, workEnd, durationMin) {
  const dayStart = new Date(date)
  dayStart.setHours(workStart, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(workEnd, 0, 0, 0)

  const slots = []
  let cursor = new Date(dayStart)

  while (cursor.getTime() + durationMin * 60000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMin * 60000)
    const overlaps = busySlots.some(b => {
      const bStart = new Date(b.start)
      const bEnd   = new Date(b.end)
      return cursor < bEnd && slotEnd > bStart
    })
    if (!overlaps) slots.push(new Date(cursor).toISOString())
    cursor = new Date(cursor.getTime() + 30 * 60000) // pas de 30 min
  }
  return slots
}

/* ── ICS generator ───────────────────────────────────────────────────────── */
function generateICS({ title, start, end, description, organizer, attendeeEmail, attendeeName, location }) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace('.000', '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LeadQualif//FR',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@leadqualif.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location    ? `LOCATION:${location}` : '',
    organizer   ? `ORGANIZER;CN=${organizer}:MAILTO:${organizer}` : '',
    attendeeEmail ? `ATTENDEE;CN=${attendeeName || attendeeEmail};RSVP=TRUE:MAILTO:${attendeeEmail}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

/* ── Twilio WhatsApp ─────────────────────────────────────────────────────── */
async function sendTwilio(from, to, body, sid, token) {
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      To:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
      Body: body,
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${d.message}`)
  return d
}

/* ── ACTION : get-availability ───────────────────────────────────────────── */
async function handleGetAvailability(req, res, user) {
  const { userId, date } = req.body
  const targetUserId = userId || user.id

  const token = await getValidToken(targetUserId, 'calendar_integrations')
  if (!token) return res.status(200).json({ slots: [], provider: null, message: 'Calendrier non connecté — créneaux par défaut' })

  // Récupérer workspace settings pour heures de travail
  const { data: profile } = await sb().from('profiles').select('agency_id').eq('user_id', targetUserId).maybeSingle()
  const { data: ws } = profile?.agency_id
    ? await sb().from('workspace_settings').select('working_hours_start,working_hours_end,appointment_duration').eq('agency_id', profile.agency_id).maybeSingle()
    : { data: null }
  const workStart  = ws?.working_hours_start || 9
  const workEnd    = ws?.working_hours_end   || 18
  const duration   = ws?.appointment_duration || 30

  const targetDate = date ? new Date(date) : new Date()
  const timeMin    = new Date(targetDate)
  timeMin.setHours(0, 0, 0, 0)
  const timeMax    = new Date(targetDate)
  timeMax.setHours(23, 59, 59, 999)

  let busyEvents = []
  try {
    if (token.provider === 'google') {
      const events = await getGoogleEvents(token.access_token, 'primary', timeMin.toISOString(), timeMax.toISOString())
      busyEvents = events.map(e => ({
        start: e.start?.dateTime || e.start?.date,
        end:   e.end?.dateTime   || e.end?.date,
        title: e.summary,
      })).filter(e => e.start && e.end)
    } else {
      const events = await getMicrosoftEvents(token.access_token, timeMin.toISOString(), timeMax.toISOString())
      busyEvents = events.map(e => ({
        start: e.start?.dateTime,
        end:   e.end?.dateTime,
        title: e.subject,
      })).filter(e => e.start && e.end)
    }
  } catch (err) {
    console.warn('[calendar/availability] API error:', err.message)
  }

  const slots = getAvailableSlots(busyEvents, targetDate, workStart, workEnd, duration)
  return res.status(200).json({ slots, busy: busyEvents, provider: token.provider, duration })
}

/* ── ACTION : create-event ────────────────────────────────────────────────── */
async function handleCreateEvent(req, res, user) {
  const { leadId, title, scheduledAt, durationMinutes = 30, type = 'Appel découverte', notes, agentUserId } = req.body
  if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt requis' })

  const { data: profile } = await sb().from('profiles').select('agency_id, nom_complet, nom_agence, email').eq('user_id', user.id).maybeSingle()
  const agencyId = profile?.agency_id

  let lead = null
  if (leadId) {
    const { data } = await sb().from('leads').select('id, nom, email, telephone, agency_id').eq('id', leadId).maybeSingle()
    lead = data
  }

  // Créer le RDV dans appointments table
  const { data: appt } = await sb().from('appointments').insert({
    lead_id: leadId || null, agency_id: agencyId, assigned_to: user.id,
    title: title || `${type}${lead ? ' - ' + lead.nom : ''}`,
    scheduled_at: scheduledAt, duration_minutes: Number(durationMinutes),
    type, notes: notes || null, status: 'confirmed',
  }).select().single()

  const startDate = new Date(scheduledAt)
  const endDate   = new Date(startDate.getTime() + durationMinutes * 60000)
  const agencyName = profile?.nom_agence || profile?.nom_complet || 'LeadQualif'

  // Créer l'événement dans le calendrier connecté
  const calToken = await getValidToken(agentUserId || user.id, 'calendar_integrations')
  let calEvent = null
  if (calToken) {
    try {
      const eventTitle  = title || `${type} — ${lead?.nom || 'Lead'}`
      const description = `${notes || ''}${lead ? `\nContact : ${lead.nom} (${lead.email || lead.telephone || ''})` : ''}\n\nGéré via LeadQualif`

      if (calToken.provider === 'google') {
        const googleEvent = {
          summary:     eventTitle,
          description,
          start:  { dateTime: startDate.toISOString(), timeZone: 'Europe/Paris' },
          end:    { dateTime: endDate.toISOString(),   timeZone: 'Europe/Paris' },
          attendees: lead?.email ? [{ email: lead.email }] : [],
          reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 30 }] },
        }
        calEvent = await createGoogleEvent(calToken.access_token, 'primary', googleEvent)
      } else {
        const msEvent = {
          subject:  eventTitle,
          body:     { contentType: 'text', content: description },
          start:    { dateTime: startDate.toISOString().replace('Z', ''), timeZone: 'Europe/Paris' },
          end:      { dateTime: endDate.toISOString().replace('Z', ''),   timeZone: 'Europe/Paris' },
          attendees: lead?.email ? [{ emailAddress: { address: lead.email, name: lead.nom }, type: 'required' }] : [],
          isReminderOn: true, reminderMinutesBeforeStart: 30,
        }
        calEvent = await createMicrosoftEvent(calToken.access_token, msEvent)
      }
    } catch (err) {
      console.warn('[calendar/create-event] Calendar API:', err.message)
    }
  }

  // Générer et envoyer .ics au lead
  if (lead?.email) {
    try {
      const icsContent = generateICS({
        title:         title || `${type} — ${agencyName}`,
        start:         startDate,
        end:           endDate,
        description:   notes || `Rendez-vous avec ${agencyName}`,
        organizer:     profile?.email,
        attendeeEmail: lead.email,
        attendeeName:  lead.nom,
      })
      // Envoyer via workspace_settings Resend ou env vars
      const { data: ws } = agencyId
        ? await sb().from('workspace_settings').select('resend_api_key, from_email, from_name').eq('agency_id', agencyId).maybeSingle()
        : { data: null }
      const resendKey = ws?.resend_api_key || process.env.RESEND_API_KEY
      if (resendKey) {
        const fromEmail  = ws?.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
        const senderName = ws?.from_name  || agencyName
        const dateStr    = formatDateFr(scheduledAt)
        const timeStr    = formatTimeFr(scheduledAt)
        const prenom     = (lead.nom || '').split(' ')[0] || lead.nom
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${senderName} <${fromEmail}>`,
            to:   [lead.email],
            subject: `📅 Invitation — ${title || type} le ${dateStr} à ${timeStr}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
              <h2 style="color:#4f46e5;">Invitation à un rendez-vous ✅</h2>
              <p>Bonjour ${prenom},</p>
              <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:16px 0;">
                <p style="margin:4px 0;"><strong>📅 Date :</strong> ${dateStr}</p>
                <p style="margin:4px 0;"><strong>⏰ Heure :</strong> ${timeStr}</p>
                <p style="margin:4px 0;"><strong>📋 Type :</strong> ${type}</p>
                ${notes ? `<p style="margin:4px 0;"><strong>📝 Notes :</strong> ${notes}</p>` : ''}
              </div>
              <p style="font-size:13px;color:#64748b;">L'invitation ci-jointe (.ics) vous permet d'ajouter ce rendez-vous directement dans votre calendrier.</p>
              <p>À bientôt,<br><strong>${agencyName}</strong></p></div>`,
            attachments: [{ filename: 'invitation.ics', content: Buffer.from(icsContent).toString('base64') }],
          }),
        })
      }
    } catch (err) {
      console.warn('[calendar/create-event] Email invitation:', err.message)
    }
  }

  // Confirmation WhatsApp au lead
  if (lead?.telephone) {
    try {
      const { data: ws } = agencyId
        ? await sb().from('workspace_settings').select('twilio_account_sid,twilio_auth_token,twilio_whatsapp_number').eq('agency_id', agencyId).maybeSingle()
        : { data: null }
      const twSid  = ws?.twilio_account_sid    || process.env.TWILIO_ACCOUNT_SID
      const twTok  = ws?.twilio_auth_token     || process.env.TWILIO_AUTH_TOKEN
      const twFrom = ws?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
      if (twSid && twTok && twFrom) {
        const prenom   = (lead.nom || '').split(' ')[0] || lead.nom
        const dateStr  = formatDateFr(scheduledAt)
        const timeStr  = formatTimeFr(scheduledAt)
        const waMsg = `Bonjour ${prenom} 👋\n\nVotre rendez-vous *${type}* est confirmé ✅\n📅 *${dateStr}* à *${timeStr}*${notes ? `\n📝 ${notes}` : ''}\n\nVous recevrez une invitation dans votre boîte email.\n\nÀ bientôt,\n${agencyName}`
        const waResult = await sendTwilio(twFrom, normalizePhone(lead.telephone), waMsg, twSid, twTok)
        await sb().from('conversations').insert({
          lead_id: lead.id, agency_id: agencyId,
          channel: 'whatsapp', direction: 'outbound',
          content: waMsg, status: 'sent', twilio_sid: waResult?.sid || null,
          sender_name: `📅 ${agencyName}`, thread_status: 'open', read_at: new Date().toISOString(),
        }).catch(() => {})
      }
    } catch (err) {
      console.warn('[calendar/create-event] WhatsApp:', err.message)
    }
  }

  // CRM event
  if (leadId) {
    await sb().from('crm_events').insert({
      lead_id: leadId, type: 'rdv', title: 'RDV créé via calendrier',
      description: `${type} le ${formatDateFr(scheduledAt)} à ${formatTimeFr(scheduledAt)}${calEvent ? ` (${calToken?.provider})` : ''}`,
    }).catch(() => {})
  }

  return res.status(200).json({ success: true, appointment: appt, calendar_event: calEvent?.id || calEvent?.id || null })
}

/* ── ACTION : booking-agent ──────────────────────────────────────────────── */
async function handleBookingAgent(req, res, user) {
  const { leadId } = req.body
  if (!leadId) return res.status(400).json({ error: 'leadId requis' })

  const { data: profile } = await sb().from('profiles').select('agency_id, nom_complet, nom_agence').eq('user_id', user.id).maybeSingle()
  const { data: lead } = await sb().from('leads').select('id, nom, telephone, email, agency_id').eq('id', leadId).eq('agency_id', profile?.agency_id).single()
  if (!lead) return res.status(404).json({ error: 'Lead introuvable' })
  if (!lead.telephone) return res.status(400).json({ error: 'Lead sans téléphone' })

  const agencyName = profile?.nom_agence || profile?.nom_complet || 'Notre équipe'

  // Récupérer disponibilités des 2 prochains jours ouvrés
  const today = new Date()
  const slots = []
  for (let d = 1; d <= 5 && slots.length < 6; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    if (date.getDay() === 0 || date.getDay() === 6) continue // skip weekends

    const avRes = await handleGetAvailabilityForDate(user.id, date, profile?.agency_id)
    const daySlots = (avRes.slots || []).slice(0, 3) // max 3 par jour
    for (const s of daySlots) {
      if (slots.length < 6) slots.push(s)
    }
  }

  if (!slots.length) {
    return res.status(200).json({ skipped: true, reason: 'Aucun créneau disponible dans les 5 prochains jours' })
  }

  // Formater les créneaux pour le message WhatsApp
  const slotsFormatted = slots.slice(0, 3).map((s, i) => {
    const d = new Date(s)
    const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const time    = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return `• Option ${i + 1} : *${dayName} à ${time}*`
  }).join('\n')

  // Générer le message via Claude
  const prenom  = (lead.nom || '').split(' ')[0] || lead.nom
  const prompt  = `Tu es un assistant commercial pour ${agencyName}.
Génère un message WhatsApp court et professionnel pour proposer des créneaux de RDV à ${prenom}.
Intègre EXACTEMENT ces créneaux tels quels dans le message (ne les reformate pas) :
${slotsFormatted}

Règles : max 5 phrases, ton chaleureux, termine par "Quel créneau vous convient ?" (exactement cette formule), 1 seul emoji max. Réponds UNIQUEMENT avec le message WhatsApp.`

  let message = `Bonjour ${prenom} 👋\n\nJe souhaite planifier un moment avec vous.\nJe peux vous proposer :\n${slotsFormatted}\n\nQuel créneau vous convient ?`
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
      })
      if (r.ok) {
        const d = await r.json()
        message = (d.content?.[0]?.text || '').trim() || message
      }
    }
  } catch (err) {
    console.warn('[calendar/booking-agent] Claude:', err.message)
  }

  // Envoyer le message WhatsApp
  const { data: ws } = profile?.agency_id
    ? await sb().from('workspace_settings').select('twilio_account_sid,twilio_auth_token,twilio_whatsapp_number').eq('agency_id', profile.agency_id).maybeSingle()
    : { data: null }
  const twSid  = ws?.twilio_account_sid    || process.env.TWILIO_ACCOUNT_SID
  const twTok  = ws?.twilio_auth_token     || process.env.TWILIO_AUTH_TOKEN
  const twFrom = ws?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
  if (!twSid || !twTok || !twFrom) return res.status(503).json({ error: 'Twilio non configuré' })

  const twResult = await sendTwilio(twFrom, normalizePhone(lead.telephone), message, twSid, twTok)

  // Stocker la conversation + les créneaux proposés pour la détection de réponse
  await sb().from('conversations').insert({
    lead_id: lead.id, agency_id: profile.agency_id,
    channel: 'whatsapp', direction: 'outbound',
    content: message, status: 'sent', twilio_sid: twResult?.sid || null,
    sender_name: `📅 Agent Booking · ${agencyName}`, thread_status: 'open',
    read_at: new Date().toISOString(),
  }).catch(() => {})

  // Stocker les créneaux proposés dans crm_events pour la détection de réponse
  await sb().from('crm_events').insert({
    lead_id: lead.id, type: 'booking_slots_sent',
    title: '📅 Créneaux proposés',
    description: JSON.stringify({ slots: slots.slice(0, 3), agent_user_id: user.id, message }),
  }).catch(() => {})

  await sb().from('leads').update({ statut_crm: 'À relancer' }).eq('id', leadId).catch(() => {})

  return res.status(200).json({ success: true, message_sent: message, slots_proposed: slots.slice(0, 3), twilio_sid: twResult.sid })
}

/* ── ACTION : get-upcoming ───────────────────────────────────────────────── */
async function handleGetUpcoming(req, res, user) {
  const limit  = Math.min(Number(req.body.limit) || 5, 10)
  const token  = await getValidToken(user.id, 'calendar_integrations')
  if (!token)  return res.status(200).json({ events: [], provider: null })

  const now    = new Date()
  const inWeek = new Date(now.getTime() + 7 * 86400000)
  let events   = []

  try {
    if (token.provider === 'google') {
      const raw = await getGoogleEvents(token.access_token, 'primary', now.toISOString(), inWeek.toISOString())
      events = raw.slice(0, limit).map(e => ({
        id:    e.id,
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end:   e.end?.dateTime   || e.end?.date,
      }))
    } else {
      const raw = await getMicrosoftEvents(token.access_token, now.toISOString(), inWeek.toISOString())
      events = raw.slice(0, limit).map(e => ({
        id:    e.id,
        title: e.subject,
        start: e.start?.dateTime,
        end:   e.end?.dateTime,
      }))
    }
  } catch (err) {
    console.warn('[calendar/upcoming] API error:', err.message)
  }

  return res.status(200).json({ events, provider: token.provider })
}

/* ── Helper interne pour booking-agent ───────────────────────────────────── */
async function handleGetAvailabilityForDate(userId, date, agencyId) {
  const token = await getValidToken(userId, 'calendar_integrations')
  if (!token) return { slots: [] }

  const { data: ws } = agencyId
    ? await sb().from('workspace_settings').select('working_hours_start,working_hours_end,appointment_duration').eq('agency_id', agencyId).maybeSingle()
    : { data: null }
  const workStart = ws?.working_hours_start || 9
  const workEnd   = ws?.working_hours_end   || 18
  const duration  = ws?.appointment_duration || 30

  const timeMin = new Date(date); timeMin.setHours(0, 0, 0, 0)
  const timeMax = new Date(date); timeMax.setHours(23, 59, 59, 999)

  let busyEvents = []
  try {
    if (token.provider === 'google') {
      const events = await getGoogleEvents(token.access_token, 'primary', timeMin.toISOString(), timeMax.toISOString())
      busyEvents = events.map(e => ({ start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date })).filter(e => e.start)
    } else {
      const events = await getMicrosoftEvents(token.access_token, timeMin.toISOString(), timeMax.toISOString())
      busyEvents = events.map(e => ({ start: e.start?.dateTime, end: e.end?.dateTime })).filter(e => e.start)
    }
  } catch {}

  return { slots: getAvailableSlots(busyEvents, date, workStart, workEnd, duration) }
}

/* ── Handler principal ───────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabase = sb()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  const { action } = req.body || {}

  try {
    if (action === 'get-availability') return handleGetAvailability(req, res, user)
    if (action === 'create-event')     return handleCreateEvent(req, res, user)
    if (action === 'booking-agent')    return handleBookingAgent(req, res, user)
    if (action === 'get-upcoming')     return handleGetUpcoming(req, res, user)
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[calendar/${action}]`, err)
    return res.status(500).json({ error: err.message })
  }
}
