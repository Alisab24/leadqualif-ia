/**
 * POST /api/crm
 * Routeur unifié CRM — regroupe auto-contact agent IA et création de RDV.
 *
 * Body : { action: 'auto-contact' | 'create-appointment', ...params }
 * Headers : Authorization: Bearer <supabase_access_token>
 */
import { createClient }                              from '@supabase/supabase-js'
import { createDecipheriv, createHash }             from 'crypto'
import nodemailer                                   from 'nodemailer'

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

/* ── Envoi email multi-canal (OAuth > SMTP > Resend) ─────────────────────── */

/** Déchiffre le mot de passe SMTP stocké en base */
function _decryptSmtpPwd(encoded) {
  try {
    if (!encoded) return null
    const secret  = process.env.SMTP_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || 'leadqualif-smtp-fallback-key'
    const key     = createHash('sha256').update(secret).digest()
    const parts   = (encoded || '').split(':')
    if (parts.length !== 3) return null
    const [ivHex, tagHex, encHex] = parts
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  } catch { return null }
}

/** Gmail API (OAuth Google) */
async function _sendViaGmail(to, subject, html, text, integration) {
  const mime = [
    `From: ${integration.email}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')
  const raw = Buffer.from(mime).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${integration.access_token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(`Gmail API ${res.status}: ${e.error?.message || JSON.stringify(e)}`)
  }
  return { provider: 'gmail', email: integration.email }
}

/** Microsoft Graph API (OAuth Microsoft) */
async function _sendViaMicrosoft(to, subject, html, text, integration) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method:  'POST',
    headers: { Authorization: `Bearer ${integration.access_token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(`Graph API ${res.status}: ${e.error?.message || ''}`)
  }
  return { provider: 'microsoft', email: integration.email }
}

/** SMTP via nodemailer */
async function _sendViaSmtp(to, subject, html, text, integration) {
  const password = _decryptSmtpPwd(integration.smtp_password_enc)
  if (!password) throw new Error('Impossible de déchiffrer le mot de passe SMTP')
  const transport = nodemailer.createTransport({
    host:   integration.smtp_host,
    port:   integration.smtp_port   || 587,
    secure: integration.smtp_encryption === 'ssl',
    auth:   { user: integration.smtp_user, pass: password },
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
  })
  await transport.sendMail({
    from:    integration.smtp_display_name
               ? `"${integration.smtp_display_name}" <${integration.smtp_user}>`
               : integration.smtp_user,
    to, subject, html, text,
  })
  return { provider: 'smtp', email: integration.smtp_user }
}

/**
 * Envoi email unifié — Priorité : OAuth Google > OAuth Microsoft > SMTP > Resend
 * @param {object} opts - { supabase, userId, agencyId, to, subject, html, text, fallbackFrom, fallbackName, resendKey }
 */
async function sendEmailAny({ supabase, userId, to, subject, html, text, fallbackFrom, fallbackName, resendKey }) {
  // Récupérer les intégrations actives de l'agent
  const { data: integrations, error: intError } = await supabase
    .from('email_integrations')
    .select('provider,email,access_token,smtp_host,smtp_port,smtp_user,smtp_display_name,smtp_password_enc,smtp_encryption')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (intError) console.warn('[sendEmailAny] Erreur lecture email_integrations:', intError.message)

  const googleInt    = integrations?.find(i => i.provider === 'google')
  const microsoftInt = integrations?.find(i => i.provider === 'microsoft')
  const smtpInt      = integrations?.find(i => i.provider === 'smtp' && i.smtp_host)

  if (googleInt?.access_token)    return _sendViaGmail(to, subject, html, text, googleInt)
  if (microsoftInt?.access_token) return _sendViaMicrosoft(to, subject, html, text, microsoftInt)
  if (smtpInt)                    return _sendViaSmtp(to, subject, html, text, smtpInt)

  // Fallback Resend
  if (!resendKey) {
    const noProviderMsg = 'Aucun email configuré. Ajoutez une intégration Gmail, Outlook ou SMTP dans Paramètres → Intégrations.'
    throw Object.assign(new Error(noProviderMsg), { code: 'NO_EMAIL_PROVIDER', status: 503 })
  }
  const result = await sendResendEmail(to, subject, html, text, fallbackFrom, resendKey, fallbackName)
  if (result?.statusCode >= 400) throw new Error(result.message || 'Erreur Resend')
  return { provider: 'resend', email: fallbackFrom }
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

  // Clés fallback Resend (utilisées uniquement si aucune intégration OAuth/SMTP active)
  const { data: ws } = await supabase.from('workspace_settings')
    .select('resend_api_key, from_email, from_name')
    .eq('agency_id', profile.agency_id).maybeSingle()

  const resendKey  = ws?.resend_api_key  || process.env.RESEND_API_KEY
  const fromEmail  = ws?.from_email      || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
  const senderName = ws?.from_name       || profile.nom_complet || profile.nom_agence || "L'équipe"
  const threadId   = replyToThreadId || `thread-${leadId}-${Date.now()}`
  const htmlBody   = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${message.trim().replace(/\n/g,'<br>')}</div>`

  const result = await sendEmailAny({
    supabase, userId: user.id,
    to: lead.email, subject: subject.trim(),
    html: htmlBody, text: message.trim(),
    fallbackFrom: fromEmail, fallbackName: senderName, resendKey,
  })

  const { data: conv } = await supabase.from('conversations').insert({
    lead_id: lead.id, agency_id: profile.agency_id,
    channel: 'email', direction: 'outbound',
    subject: subject.trim(), content: message.trim(),
    email_thread_id: threadId,
    from_email: result.email || fromEmail,
    to_email: lead.email,
    sender_name: senderName, status: 'sent', read_at: new Date().toISOString(),
  }).select().single()

  return res.status(200).json({ success: true, message_id: conv?.id, thread_id: threadId, status: 'sent', provider: result.provider })
}

/* ── Action : send-whatsapp ───────────────────────────────────────────────── */
async function handleSendWhatsapp(req, res, supabase, user) {
  const { leadId, message } = req.body || {}
  if (!leadId || !message?.trim()) return res.status(400).json({ error: 'leadId et message requis' })

  const { data: profile } = await supabase.from('profiles')
    .select('agency_id, nom_complet, nom_agence').eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  const { data: lead } = await supabase.from('leads')
    .select('id, nom, telephone, agency_id').eq('id', leadId).eq('agency_id', profile.agency_id).single()
  if (!lead)             return res.status(404).json({ error: 'Lead introuvable' })
  if (!lead.telephone)   return res.status(400).json({ error: 'Lead sans numéro de téléphone' })

  // Priorité : workspace_settings → agency_settings → env vars
  const { data: ws } = await supabase.from('workspace_settings')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('agency_id', profile.agency_id).maybeSingle()
  const { data: ag } = (!ws?.twilio_account_sid)
    ? await supabase.from('agency_settings')
        .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
        .eq('agency_id', profile.agency_id).maybeSingle()
    : { data: null }

  const accountSid = ws?.twilio_account_sid    || ag?.twilio_account_sid    || process.env.TWILIO_ACCOUNT_SID
  const authToken  = ws?.twilio_auth_token     || ag?.twilio_auth_token     || process.env.TWILIO_AUTH_TOKEN
  const fromNumber = ws?.twilio_whatsapp_number || ag?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
  if (!accountSid || !authToken || !fromNumber)
    return res.status(503).json({ error: 'Twilio non configuré' })

  const toNumber = normalizePhone(lead.telephone)
  const twilioResult = await sendTwilioMessage(fromNumber, toNumber, message.trim(), accountSid, authToken)

  const senderName = profile.nom_complet || profile.nom_agence || 'Agent'
  const { data: conv } = await supabase.from('conversations').insert({
    lead_id: lead.id, agency_id: profile.agency_id,
    channel: 'whatsapp', direction: 'outbound',
    from_number: fromNumber.replace(/^whatsapp:/i, ''), to_number: toNumber,
    content: message.trim(),
    status: ['sent','delivered','read','failed'].includes(twilioResult.status) ? twilioResult.status : 'sent',
    twilio_sid: twilioResult.sid || null,
    read_at: new Date().toISOString(), sender_name: senderName, thread_status: 'open',
  }).select().single()

  return res.status(200).json({ success: true, message_id: conv?.id, twilio_sid: twilioResult.sid, status: twilioResult.status })
}

/* ── Action : send-document-email ────────────────────────────────────────── */
// Labels par type de document
const DOCUMENT_TYPE_LABELS = {
  devis: 'Devis', facture: 'Facture', contrat: 'Contrat de prestation',
  rapport: 'Rapport de performance', mandat: 'Mandat immobilier',
  compromis: 'Compromis de vente', bon_visite: 'Bon de visite', contrat_gestion: 'Contrat de gestion',
}

function buildDocHtml(doc, agency) {
  const label  = DOCUMENT_TYPE_LABELS[doc.type] || 'Document'
  const cj     = typeof doc.content_json === 'string' ? JSON.parse(doc.content_json) : (doc.content_json || {})
  const items  = Array.isArray(cj.items)  ? cj.items  : []
  const totals = Array.isArray(cj.totals) ? cj.totals : []
  const devise = doc.devise || cj.devise || '€'
  const fmt    = v => Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })
  const date   = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')
  const an = agency?.nom_agence || 'Votre agence'
  const ae = agency?.email || ''
  const aa = agency?.adresse_legale || agency?.adresse || ''
  const as = agency?.siret || agency?.numero_enregistrement || ''
  const itemsHtml = items.map(i => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${i.description||''}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${i.quantity||1}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;">${fmt(i.amount??i.unitPrice??i.total)} ${devise}</td></tr>`).join('')
  const totalsHtml = totals.map(t => {
    const isTtc = (t.label||'').toUpperCase().includes('TOTAL TTC')
    return `<tr style="${isTtc?'background:#eff6ff;':''}"><td colspan="2" style="padding:6px 12px;text-align:right;font-size:${isTtc?'14':'12'}px;font-weight:${isTtc?'700':'400'};color:${isTtc?'#1d4ed8':'#6b7280'};border-top:1px solid #e5e7eb;">${t.label}</td><td style="padding:6px 12px;text-align:right;font-size:${isTtc?'14':'12'}px;font-weight:${isTtc?'700':'600'};color:${isTtc?'#1d4ed8':'#374151'};border-top:1px solid #e5e7eb;">${fmt(t.amount)} ${devise}</td></tr>`
  }).join('')
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111827;background:#fff;line-height:1.5;}.page{max-width:800px;margin:0 auto;padding:36px;}table{border-collapse:collapse;}</style></head><body><div class="page"><div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e5e7eb;padding-bottom:20px;margin-bottom:24px;"><div><div style="font-size:22px;font-weight:800;color:#1e3a5f;">${an}</div><div style="font-size:12px;color:#6b7280;margin-top:4px;">${aa?`<div>${aa}</div>`:''}${ae?`<div>${ae}</div>`:''}${as?`<div>N° ${as}</div>`:''}</div></div><div style="text-align:right;"><div style="font-size:22px;font-weight:700;color:#1e3a5f;">${label}</div><div style="font-size:13px;color:#6b7280;">${doc.reference?`Réf: ${doc.reference}`:''}</div><div style="font-size:12px;color:#9ca3af;">Date: ${date}</div></div></div><div style="background:#f9fafb;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 18px;margin-bottom:24px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Client</div><div style="font-size:16px;font-weight:700;">${doc.client_nom||'—'}</div>${doc.client_email?`<div style="font-size:12px;color:#6b7280;margin-top:2px;">${doc.client_email}</div>`:''}</div>${items.length?`<div style="margin-bottom:24px;"><table style="width:100%;"><thead><tr style="background:#f3f4f6;"><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Description</th><th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:60px;">Qté</th><th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:120px;">Montant</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot>${totalsHtml}</tfoot></table></div>`:''}<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;">${agency?.mention_legale?`<div>${agency.mention_legale}</div>`:''}<div>Document généré par NexaPro</div></div></div></body></html>`
}

async function handleSendDocumentEmail(req, res, supabase, user) {
  const { documentId } = req.body || {}
  if (!documentId) return res.status(400).json({ error: 'documentId requis' })

  const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single()
  if (!doc)              return res.status(404).json({ error: 'Document introuvable' })
  if (!doc.client_email) return res.status(400).json({ error: 'Aucun email client sur ce document' })

  const { data: agencyArr } = await supabase.from('profiles')
    .select('nom_agence, email, telephone, adresse_legale, adresse, siret, numero_enregistrement, mention_legale, conditions_paiement, carte_pro_t, carte_pro_s')
    .eq('agency_id', doc.agency_id).order('created_at', { ascending: true }).limit(1)
  const agency = Array.isArray(agencyArr) ? agencyArr[0] : agencyArr

  // Clés fallback Resend
  const { data: ws } = await supabase.from('workspace_settings')
    .select('resend_api_key, from_email, from_name').eq('agency_id', doc.agency_id).maybeSingle()
  const resendKey  = ws?.resend_api_key || process.env.RESEND_API_KEY
  const fromEmail  = ws?.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
  const senderName = ws?.from_name  || agency?.nom_agence || process.env.SENDER_NAME || 'LeadQualif'
  const label      = DOCUMENT_TYPE_LABELS[doc.type] || 'Document'
  const subject    = `${senderName} — Votre ${label.toLowerCase()}${doc.reference ? ' ' + doc.reference : ''}`

  // Générer HTML du document
  const docHtml = ['devis','facture'].includes(doc.type)
    ? buildDocHtml(doc, agency)
    : (doc.preview_html || buildDocHtml(doc, agency))

  // Essayer génération PDF via pdfshift si clé disponible
  let attachments = []
  let emailHtml   = ''
  if (docHtml && process.env.PDFSHIFT_API_KEY) {
    try {
      const pdfRes = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(`api_key:${process.env.PDFSHIFT_API_KEY}`).toString('base64'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: docHtml, format: 'A4', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }),
      })
      if (pdfRes.ok) {
        const buf = await pdfRes.arrayBuffer()
        attachments = [{ filename: `${label}${doc.reference ? '-' + doc.reference : ''}.pdf`, content: Buffer.from(buf).toString('base64') }]
        emailHtml = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b;"><h2 style="color:#1e3a5f;">📄 ${label}${doc.reference ? ' — ' + doc.reference : ''}</h2><p>Bonjour <strong>${doc.client_nom || ''}</strong>,</p><p>Veuillez trouver <strong>en pièce jointe</strong> votre ${label.toLowerCase()}${doc.total_ttc ? ` d'un montant de <strong>${Number(doc.total_ttc).toLocaleString('fr-FR')} ${doc.devise || '€'}</strong>` : ''}.</p>${agency?.email ? `<p style="font-size:13px;color:#6b7280;">Contact : <a href="mailto:${agency.email}">${agency.email}</a></p>` : ''}<p>Cordialement,<br><strong>${senderName}</strong></p></div>`
      }
    } catch {}
  }
  if (!emailHtml) {
    emailHtml = `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;"><div style="background:#1e3a5f;color:#fff;padding:20px 28px;border-radius:12px 12px 0 0;"><h1 style="margin:0;font-size:18px;">📄 ${label}${doc.reference ? ' — ' + doc.reference : ''}</h1><p style="margin:6px 0 0;font-size:12px;opacity:.75;">De la part de ${senderName}</p></div><div style="background:#fff;padding:20px 28px;border-radius:0 0 12px 12px;">${docHtml}</div></div>`
  }

  // Envoi : OAuth Google/Microsoft > SMTP > Resend (les pièces jointes PDF ne sont supportées que via Resend)
  let sentResult
  if (attachments.length) {
    // Pièces jointes PDF → uniquement via Resend
    if (!resendKey) throw new Error('Resend requis pour les pièces jointes PDF (RESEND_API_KEY)')
    const payload = { from: `${senderName} <${fromEmail}>`, to: doc.client_email, subject, html: emailHtml, attachments }
    const sendRes  = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const sendData = await sendRes.json()
    if (!sendRes.ok) throw new Error(`Resend ${sendRes.status}: ${sendData.message || JSON.stringify(sendData)}`)
    sentResult = { provider: 'resend', email: fromEmail }
  } else {
    sentResult = await sendEmailAny({
      supabase, userId: user.id,
      to: doc.client_email, subject,
      html: emailHtml, text: `${label}${doc.reference ? ' — ' + doc.reference : ''} — Consulter en ligne.`,
      fallbackFrom: fromEmail, fallbackName: senderName, resendKey,
    })
  }

  await supabase.from('documents').update({ statut: 'envoyé', updated_at: new Date().toISOString() }).eq('id', documentId)
  if (doc.lead_id) {
    await supabase.from('crm_events').insert({
      lead_id: doc.lead_id, agency_id: doc.agency_id, type: 'document',
      title: `📧 ${label} envoyé par email`,
      description: `${doc.reference || label} — Envoyé à ${doc.client_email} via ${sentResult.provider}`,
      statut: 'complété', created_at: new Date().toISOString(),
    }).catch(() => {})
  }

  return res.status(200).json({ ok: true, sentTo: doc.client_email, provider: sentResult.provider, mode: attachments.length ? 'PDF joint' : 'HTML inline' })
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
    if (action === 'send-email')           return await handleSendEmail(req, res, supabase, user)
    if (action === 'send-whatsapp')        return await handleSendWhatsapp(req, res, supabase, user)
    if (action === 'send-document-email') return await handleSendDocumentEmail(req, res, supabase, user)
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[crm/${action}] Erreur:`, err)
    const status = err.status || 500
    return res.status(status).json({ error: err.message || 'Erreur serveur' })
  }
}
