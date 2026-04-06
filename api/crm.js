/**
 * POST /api/crm
 * Routeur unifié CRM — regroupe auto-contact agent IA et création de RDV.
 *
 * Body : { action: 'auto-contact' | 'create-appointment', ...params }
 * Headers : Authorization: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js'

/* ── Helpers communs ──────────────────────────────────────────────────────── */
function formatDateFr(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}
function formatTimeFr(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
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
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message || JSON.stringify(data)}`)
  return data
}

async function sendResendEmail(to, subject, html, text, fromEmail, resendKey, senderName) {
  if (!resendKey) return null
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${senderName} <${fromEmail}>`, to: [to], subject, html, text }),
  })
  return await res.json()
}

function normalizePhone(phone) {
  if (!phone) return null
  return phone.startsWith('+') ? phone : '+' + phone.replace(/^00/, '')
}

/* ── Action : auto-contact agent IA ──────────────────────────────────────── */
async function generateClaudeMessage(lead, agencyName) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant')

  const secteur = (lead.secteur_activite || lead.type_service || lead.secteur || '').toLowerCase()
  let contexte = 'Secteur inconnu. Message générique sur : automatiser la qualification des leads et gagner du temps dans la prospection.'
  if (secteur.includes('smma') || secteur.includes('marketing') || secteur.includes('agence')) {
    contexte = 'Le lead travaille dans le secteur SMMA/Marketing. Axe sur : générer des leads qualifiés, automatiser la prospection, augmenter le ROI publicité.'
  } else if (secteur.includes('immo') || secteur.includes('immobilier') || secteur.includes('bien') || secteur.includes('achat')) {
    contexte = 'Le lead est dans l\'immobilier. Axe sur : trouver des propriétaires et acheteurs qualifiés, automatiser la qualification des prospects.'
  }

  const prompt = `Tu es un assistant commercial expert pour ${agencyName || 'LeadQualif'}.
Génère un message WhatsApp de premier contact pour ce lead.

Règles STRICTES :
- Maximum 3 phrases courtes
- Ton professionnel mais humain et chaleureux
- Personnalisé avec le prénom du lead si disponible
- Termine OBLIGATOIREMENT par une question ouverte simple
- Maximum 1 emoji
- Langue : français
- Ne mentionne PAS le nom de l'outil ou du logiciel

Contexte : ${contexte}
Lead : Nom: ${lead.nom || 'le contact'} | Secteur: ${lead.secteur_activite || lead.secteur || 'non précisé'} | Score: ${lead.score_ia || lead.score || 0}%

Génère UNIQUEMENT le message WhatsApp, sans guillemets ni préambule.`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${await r.text()}`)
  const d = await r.json()
  return (d.content?.[0]?.text || '').trim()
}

async function handleAutoContact(req, res, supabase, user) {
  const { leadId } = req.body || {}
  if (!leadId) return res.status(400).json({ error: 'leadId requis' })

  const { data: profile } = await supabase.from('profiles')
    .select('agency_id, nom_complet, nom_agence').eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  const { data: settings } = await supabase.from('agency_settings')
    .select('agent_ia_enabled, agent_smma_template, agent_immo_template, agent_default_template, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('agency_id', profile.agency_id).maybeSingle()

  if (settings?.agent_ia_enabled === false)
    return res.status(200).json({ skipped: true, reason: 'Agent IA désactivé pour cette agence' })

  const { data: lead, error: leadErr } = await supabase.from('leads')
    .select('id, nom, telephone, agency_id, score_ia, score, statut_crm, secteur, secteur_activite, type_service, source, do_not_contact, auto_contacted_at, agent_ia_enabled')
    .eq('id', leadId).eq('agency_id', profile.agency_id).single()
  if (leadErr || !lead) return res.status(404).json({ error: 'Lead introuvable' })

  if (lead.do_not_contact) return res.status(200).json({ skipped: true, reason: 'Lead marqué "Ne pas contacter"' })
  if (lead.agent_ia_enabled === false) return res.status(200).json({ skipped: true, reason: 'Agent IA désactivé pour ce lead' })
  if (lead.auto_contacted_at) return res.status(200).json({ skipped: true, reason: 'Lead déjà contacté automatiquement' })
  if (!lead.telephone) return res.status(200).json({ skipped: true, reason: 'Lead sans numéro de téléphone' })

  // Rate-limit 20/heure
  const { count } = await supabase.from('agent_actions').select('id', { count: 'exact', head: true })
    .eq('agency_id', profile.agency_id).eq('status', 'sent')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
  if ((count || 0) >= 20) return res.status(429).json({ error: 'Rate limit atteint (20 messages/heure max)' })

  // Générer le message
  const agencyName = profile.nom_agence || profile.nom_complet || 'LeadQualif'
  const secteur = (lead.secteur_activite || lead.type_service || lead.secteur || '').toLowerCase()
  const isSmma = secteur.includes('smma') || secteur.includes('marketing') || secteur.includes('agence')
  const isImmo = secteur.includes('immo') || secteur.includes('bien') || secteur.includes('achat')
  let template = settings?.agent_default_template || null
  if (isSmma && settings?.agent_smma_template) template = settings.agent_smma_template
  if (isImmo && settings?.agent_immo_template) template = settings.agent_immo_template

  let message = ''
  if (template) {
    const prenom = (lead.nom || '').split(' ')[0] || lead.nom || 'vous'
    message = template
      .replace(/\{\{nom\}\}/gi, lead.nom || 'vous')
      .replace(/\{\{prenom\}\}/gi, prenom)
      .replace(/\{\{agence\}\}/gi, agencyName)
      .replace(/\{\{secteur\}\}/gi, lead.secteur_activite || lead.secteur || '')
  } else {
    message = await generateClaudeMessage(lead, agencyName)
  }
  if (!message) throw new Error('Message généré vide')

  const accountSid = settings?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID
  const authToken  = settings?.twilio_auth_token  || process.env.TWILIO_AUTH_TOKEN
  const fromNumber = settings?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
  if (!accountSid || !authToken || !fromNumber)
    return res.status(503).json({ error: 'Twilio non configuré' })

  const toNumber = normalizePhone(lead.telephone)
  const twilioResult = await sendTwilioMessage(fromNumber, toNumber, message, accountSid, authToken)

  // Stocker conversation
  await supabase.from('conversations').insert({
    lead_id: lead.id, agency_id: profile.agency_id,
    channel: 'whatsapp', direction: 'outbound',
    from_number: fromNumber.replace(/^whatsapp:/i, ''), to_number: toNumber,
    content: message,
    status: ['sent','delivered','read','failed'].includes(twilioResult.status) ? twilioResult.status : 'sent',
    twilio_sid: twilioResult.sid || null,
    read_at: new Date().toISOString(),
    sender_name: `🤖 Agent IA · ${agencyName}`, thread_status: 'open',
  }).catch(e => console.error('[crm/auto-contact] conv error:', e))

  // Logger + marquer lead
  await supabase.from('agent_actions').insert({
    lead_id: leadId, agency_id: profile.agency_id,
    agent_type: 'auto_contact', action: 'Premier contact WhatsApp',
    message_sent: message, status: 'sent',
  }).catch(() => {})
  await supabase.from('leads').update({ auto_contacted_at: new Date().toISOString() }).eq('id', leadId)

  return res.status(200).json({ success: true, message_sent: message, twilio_sid: twilioResult.sid })
}

/* ── Action : create-appointment ─────────────────────────────────────────── */
async function handleCreateAppointment(req, res, supabase, user) {
  const { leadId, title, scheduledAt, durationMinutes = 30, type = 'Appel découverte', notes } = req.body || {}
  if (!leadId || !scheduledAt) return res.status(400).json({ error: 'leadId et scheduledAt requis' })

  const { data: profile } = await supabase.from('profiles')
    .select('agency_id, nom_complet, nom_agence, email').eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  const { data: lead } = await supabase.from('leads')
    .select('id, nom, email, telephone, agency_id')
    .eq('id', leadId).eq('agency_id', profile.agency_id).single()
  if (!lead) return res.status(404).json({ error: 'Lead introuvable' })

  const { data: appt, error: apptErr } = await supabase.from('appointments').insert({
    lead_id: lead.id, agency_id: profile.agency_id, assigned_to: user.id,
    title: title || `${type} - ${lead.nom}`,
    scheduled_at: scheduledAt, duration_minutes: Number(durationMinutes),
    type, notes: notes || null, status: 'confirmed',
  }).select().single()
  if (apptErr) throw new Error(`Création RDV: ${JSON.stringify(apptErr)}`)

  const dateStr    = formatDateFr(scheduledAt)
  const timeStr    = formatTimeFr(scheduledAt)
  const prenom     = (lead.nom || '').split(' ')[0] || lead.nom
  const agencyName = profile.nom_agence || profile.nom_complet || 'Notre équipe'

  await supabase.from('crm_events').insert({
    lead_id: lead.id, type: 'rdv', title: 'RDV créé',
    description: `${type} le ${dateStr} à ${timeStr}${notes ? ` — ${notes}` : ''}`,
  }).catch(() => {})

  // Confirmation WhatsApp
  let waResult = null
  if (lead.telephone) {
    try {
      // Priorité : workspace_settings → agency_settings → env vars
      const { data: ws } = await supabase.from('workspace_settings')
        .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
        .eq('agency_id', profile.agency_id).maybeSingle()
      const { data: s } = (!ws?.twilio_account_sid)
        ? await supabase.from('agency_settings')
            .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
            .eq('agency_id', profile.agency_id).maybeSingle()
        : { data: null }
      const sid  = ws?.twilio_account_sid    || s?.twilio_account_sid    || process.env.TWILIO_ACCOUNT_SID
      const tok  = ws?.twilio_auth_token     || s?.twilio_auth_token     || process.env.TWILIO_AUTH_TOKEN
      const from = ws?.twilio_whatsapp_number || s?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
      if (sid && tok && from) {
        const waMsg = `Bonjour ${prenom} 👋\n\nVotre rendez-vous *${type}* est confirmé pour le *${dateStr} à ${timeStr}*.\n${notes ? `\n📝 ${notes}\n` : ''}\nÀ bientôt,\n${agencyName}`
        waResult = await sendTwilioMessage(from, normalizePhone(lead.telephone), waMsg, sid, tok)
        await supabase.from('conversations').insert({
          lead_id: lead.id, agency_id: profile.agency_id,
          channel: 'whatsapp', direction: 'outbound',
          content: waMsg, status: 'sent', twilio_sid: waResult?.sid || null,
          sender_name: `📅 ${agencyName}`, thread_status: 'open', read_at: new Date().toISOString(),
        }).catch(() => {})
      }
    } catch (e) { console.warn('[crm/appointment] WA failed:', e.message) }
  }

  // Confirmation Email
  let emailResult = null
  if (lead.email) {
    try {
      // Priorité : workspace_settings → env vars
      const { data: wsEmail } = await supabase.from('workspace_settings')
        .select('resend_api_key, from_email, from_name')
        .eq('agency_id', profile.agency_id).maybeSingle()
      const resendKey = wsEmail?.resend_api_key || process.env.RESEND_API_KEY
      const fromEmail = wsEmail?.from_email     || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
      const subject   = `✅ RDV confirmé — ${dateStr} à ${timeStr}`
      const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
        <h2 style="color:#4f46e5;">Votre rendez-vous est confirmé ✅</h2>
        <p>Bonjour ${prenom},</p>
        <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>📅 Date :</strong> ${dateStr}</p>
          <p style="margin:4px 0;"><strong>⏰ Heure :</strong> ${timeStr}</p>
          <p style="margin:4px 0;"><strong>📋 Type :</strong> ${type}</p>
          ${notes ? `<p style="margin:4px 0;"><strong>📝 Notes :</strong> ${notes}</p>` : ''}
        </div>
        <p>À bientôt,<br><strong>${agencyName}</strong></p></div>`
      const senderName = wsEmail?.from_name || agencyName
      emailResult = await sendResendEmail(lead.email, subject, html, `RDV : ${dateStr} à ${timeStr}`, fromEmail, resendKey, senderName)
      if (emailResult?.id) {
        await supabase.from('conversations').insert({
          lead_id: lead.id, agency_id: profile.agency_id,
          channel: 'email', direction: 'outbound',
          subject, content: `RDV confirmé : ${type} le ${dateStr} à ${timeStr}`,
          from_email: fromEmail, to_email: lead.email,
          sender_name: agencyName, status: 'sent', read_at: new Date().toISOString(),
        }).catch(() => {})
      }
    } catch (e) { console.warn('[crm/appointment] email failed:', e.message) }
  }

  return res.status(200).json({ success: true, appointment: appt, wa_sent: !!waResult, email_sent: !!emailResult?.id })
}

/* ── Action : send-email ─────────────────────────────────────────────────── */
async function handleSendEmail(req, res, supabase, user) {
  const { leadId, subject, message, replyToThreadId } = req.body || {}
  if (!leadId || !subject?.trim() || !message?.trim())
    return res.status(400).json({ error: 'leadId, subject et message requis' })

  const { data: profile } = await supabase.from('profiles')
    .select('agency_id, nom_complet, nom_agence, email').eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  const { data: lead } = await supabase.from('leads')
    .select('id, nom, email, agency_id').eq('id', leadId).eq('agency_id', profile.agency_id).single()
  if (!lead) return res.status(404).json({ error: 'Lead introuvable' })
  if (!lead.email) return res.status(400).json({ error: "Ce lead n'a pas d'email" })

  // Utiliser les clés workspace en priorité, sinon fallback env vars
  const { data: ws } = await supabase.from('workspace_settings')
    .select('resend_api_key, from_email, from_name')
    .eq('agency_id', profile.agency_id).maybeSingle()

  const resendKey  = ws?.resend_api_key  || process.env.RESEND_API_KEY
  const fromEmail  = ws?.from_email      || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
  const senderName = ws?.from_name       || profile.nom_complet || profile.nom_agence || "L'équipe"
  if (!resendKey) return res.status(503).json({ error: 'RESEND_API_KEY non configuré' })

  const threadId = replyToThreadId || `thread-${leadId}-${Date.now()}`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `${senderName} <${fromEmail}>`,
      to:      [lead.email],
      subject: subject.trim(),
      html:    `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${message.trim().replace(/\n/g,'<br>')}</div>`,
      text:    message.trim(),
    }),
  })
  const resendData = await resendRes.json()
  if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${resendData.message || JSON.stringify(resendData)}`)

  const { data: conv } = await supabase.from('conversations').insert({
    lead_id: lead.id, agency_id: profile.agency_id,
    channel: 'email', direction: 'outbound',
    subject: subject.trim(), content: message.trim(),
    email_thread_id: threadId, from_email: fromEmail, to_email: lead.email,
    sender_name: senderName, status: 'sent', read_at: new Date().toISOString(),
  }).select().single()

  return res.status(200).json({ success: true, message_id: conv?.id, thread_id: threadId, status: 'sent' })
}

/* ── Handler principal ────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Config Supabase manquante' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  const { action } = req.body || {}

  try {
    if (action === 'auto-contact')        return await handleAutoContact(req, res, supabase, user)
    if (action === 'create-appointment')  return await handleCreateAppointment(req, res, supabase, user)
    if (action === 'send-email')          return await handleSendEmail(req, res, supabase, user)
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[crm/${action}] Erreur:`, err)
    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}
