/**
 * POST /api/appointments/create
 * Crée un RDV, envoie confirmation WhatsApp + email au lead.
 *
 * Body : { leadId, title, scheduledAt, durationMinutes, type, notes }
 * Headers : Authorization: Bearer <token>
 */
import { createClient } from '@supabase/supabase-js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateFr(isoString) {
  const d = new Date(isoString)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTimeFr(isoString) {
  const d = new Date(isoString)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function sendTwilioMessage(from, to, body, accountSid, authToken) {
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      To:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
      Body: body,
    }).toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message}`)
  return data
}

async function sendEmail(to, subject, html, text, fromEmail, resendKey, senderName) {
  if (!resendKey) return null
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `${senderName} <${fromEmail}>`,
      to:      [to],
      subject,
      html,
      text,
    }),
  })
  return await res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Config Supabase manquante' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  const { leadId, title, scheduledAt, durationMinutes = 30, type = 'Appel découverte', notes } = req.body || {}
  if (!leadId || !scheduledAt) return res.status(400).json({ error: 'leadId et scheduledAt requis' })

  try {
    // 1. Profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, nom_complet, nom_agence, email')
      .eq('user_id', user.id).single()
    if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

    // 2. Lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, nom, email, telephone, agency_id')
      .eq('id', leadId).eq('agency_id', profile.agency_id).single()
    if (!lead) return res.status(404).json({ error: 'Lead introuvable' })

    // 3. Créer le RDV
    const rdvTitle = title || `${type} - ${lead.nom}`
    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .insert({
        lead_id:          lead.id,
        agency_id:        profile.agency_id,
        assigned_to:      user.id,
        title:            rdvTitle,
        scheduled_at:     scheduledAt,
        duration_minutes: Number(durationMinutes),
        type,
        notes:            notes || null,
        status:           'confirmed',
      })
      .select().single()

    if (apptErr) throw new Error(`Création RDV: ${JSON.stringify(apptErr)}`)

    const dateStr = formatDateFr(scheduledAt)
    const timeStr = formatTimeFr(scheduledAt)
    const prenom  = (lead.nom || '').split(' ')[0] || lead.nom
    const agencyName = profile.nom_agence || profile.nom_complet || 'Notre équipe'

    // 4. Logger dans crm_events (historique)
    await supabase.from('crm_events').insert({
      lead_id:     lead.id,
      type:        'rdv',
      title:       'RDV créé',
      description: `${type} le ${dateStr} à ${timeStr}${notes ? ` — ${notes}` : ''}`,
    }).catch(() => {})

    // 5. Confirmation WhatsApp
    let waResult = null
    if (lead.telephone) {
      try {
        const { data: agencySettings } = await supabase
          .from('agency_settings')
          .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
          .eq('agency_id', profile.agency_id).maybeSingle()

        const accountSid  = agencySettings?.twilio_account_sid  || process.env.TWILIO_ACCOUNT_SID
        const authToken   = agencySettings?.twilio_auth_token   || process.env.TWILIO_AUTH_TOKEN
        const fromNumber  = agencySettings?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER

        if (accountSid && authToken && fromNumber) {
          const toNumber = lead.telephone.startsWith('+')
            ? lead.telephone : '+' + lead.telephone.replace(/^00/, '')

          const waMsg = `Bonjour ${prenom} 👋\n\nVotre rendez-vous *${type}* est confirmé pour le *${dateStr} à ${timeStr}*.\n${notes ? `\n📝 ${notes}\n` : ''}\nÀ bientôt,\n${agencyName}`

          waResult = await sendTwilioMessage(fromNumber, toNumber, waMsg, accountSid, authToken)

          // Stocker dans conversations
          await supabase.from('conversations').insert({
            lead_id:       lead.id,
            agency_id:     profile.agency_id,
            channel:       'whatsapp',
            direction:     'outbound',
            content:       waMsg,
            status:        'sent',
            twilio_sid:    waResult?.sid || null,
            sender_name:   `📅 ${agencyName}`,
            thread_status: 'open',
            read_at:       new Date().toISOString(),
          }).catch(() => {})
        }
      } catch (waErr) {
        console.warn('[appointments/create] WhatsApp failed:', waErr.message)
      }
    }

    // 6. Confirmation Email
    let emailResult = null
    if (lead.email) {
      try {
        const resendKey  = process.env.RESEND_API_KEY
        const fromEmail  = process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
        const emailSubj  = `✅ RDV confirmé — ${dateStr} à ${timeStr}`
        const emailHtml  = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
            <h2 style="color:#4f46e5;">Votre rendez-vous est confirmé ✅</h2>
            <p>Bonjour ${prenom},</p>
            <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:16px 0;">
              <p style="margin:4px 0;"><strong>📅 Date :</strong> ${dateStr}</p>
              <p style="margin:4px 0;"><strong>⏰ Heure :</strong> ${timeStr}</p>
              <p style="margin:4px 0;"><strong>📋 Type :</strong> ${type}</p>
              ${notes ? `<p style="margin:4px 0;"><strong>📝 Notes :</strong> ${notes}</p>` : ''}
            </div>
            <p>À bientôt,<br><strong>${agencyName}</strong></p>
          </div>`

        emailResult = await sendEmail(
          lead.email, emailSubj, emailHtml,
          `RDV confirmé : ${dateStr} à ${timeStr}`,
          fromEmail, resendKey, agencyName
        )

        // Stocker dans conversations
        if (emailResult?.id) {
          await supabase.from('conversations').insert({
            lead_id:         lead.id,
            agency_id:       profile.agency_id,
            channel:         'email',
            direction:       'outbound',
            subject:         emailSubj,
            content:         `RDV confirmé : ${type} le ${dateStr} à ${timeStr}`,
            from_email:      fromEmail,
            to_email:        lead.email,
            sender_name:     agencyName,
            status:          'sent',
            read_at:         new Date().toISOString(),
          }).catch(() => {})
        }
      } catch (emailErr) {
        console.warn('[appointments/create] Email failed:', emailErr.message)
      }
    }

    return res.status(200).json({
      success:       true,
      appointment:   appt,
      wa_sent:       !!waResult,
      email_sent:    !!emailResult?.id,
    })

  } catch (err) {
    console.error('[appointments/create] Error:', err)
    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}
