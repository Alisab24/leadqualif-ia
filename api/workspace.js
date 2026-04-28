/**
 * POST /api/workspace
 * Gestion des paramètres workspace (agence).
 *
 * Actions :
 *   get-settings              → Lire les settings (clés masquées)
 *   save-settings             → Sauvegarder (upsert)
 *   test-email                → Envoyer un email de test via Resend
 *   test-whatsapp             → Envoyer un WA de test via Twilio
 *   docuseal-send             → Envoyer un document pour signature (DocuSeal)
 *   docuseal-status           → Vérifier le statut de signature
 *   docuseal-webhook          → Webhook DocuSeal (pas de token requis)
 *
 * Headers : Authorization: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js'

// ── DocuSeal ──────────────────────────────────────────────────────────────────
const DOCUSEAL_BASE = (process.env.DOCUSEAL_BASE_URL || 'https://api.docuseal.com').replace(/\/$/, '')

async function docusealFetch(path, method = 'GET', body = null) {
  const apiKey = process.env.DOCUSEAL_API_KEY
  if (!apiKey) throw Object.assign(new Error('Clé API DocuSeal manquante (DOCUSEAL_API_KEY non configurée).'), { status: 503 })
  const opts = {
    method,
    headers: { 'X-Auth-Token': apiKey, 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${DOCUSEAL_BASE}${path}`, opts)
  let data
  try { data = await r.json() } catch (_) { data = {} }
  if (!r.ok) {
    const msg = typeof data?.error === 'string' ? data.error
      : typeof data?.message === 'string' ? data.message
      : JSON.stringify(data)
    console.error(`[DocuSeal] ${method} ${path} → ${r.status}:`, msg)
    throw Object.assign(new Error(`DocuSeal ${r.status}: ${msg}`), { status: r.status })
  }
  return data
}

/**
 * Construit un HTML minimal pour DocuSeal.
 * RÈGLE CRITIQUE : les marqueurs {{Signature}} et {{Date}} doivent être
 * dans des balises <p> simples — pas dans des <div> stylisés.
 * DocuSeal parse le texte brut du HTML pour trouver les {{markers}}.
 * Noms exacts attendus par DocuSeal : "Signature" (majuscule), "Date" (majuscule).
 */
function buildDocumentHtml(doc) {
  const title  = doc.titre    || doc.reference || 'Document'
  const client = doc.client_nom || 'Client'
  const email  = doc.client_email || doc.email_destinataire || ''
  const ref    = doc.reference || doc.numero_document || ''
  const amount = doc.total_ttc  ? `${Number(doc.total_ttc).toLocaleString('fr-FR')} ${doc.devise || '€'}` : ''
  const today  = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body  { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 48px 56px; line-height: 1.7; }
    h1    { font-size: 20px; margin: 0 0 4px; }
    hr    { border: none; border-top: 1px solid #ccc; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; }
    td    { padding: 4px 0; }
    .lbl  { color: #666; font-size: 11px; width: 160px; }
  </style>
</head>
<body>

<h1>${title}</h1>
<p style="color:#666;font-size:12px">${ref ? 'Ref: ' + ref + ' - ' : ''}${today}</p>

<hr>

<table>
  <tr><td class="lbl">Client :</td><td><strong>${client}</strong></td></tr>
  ${email  ? `<tr><td class="lbl">Email :</td><td>${email}</td></tr>` : ''}
  ${amount ? `<tr><td class="lbl">Montant TTC :</td><td><strong>${amount}</strong></td></tr>` : ''}
  ${ref    ? `<tr><td class="lbl">Reference :</td><td>${ref}</td></tr>` : ''}
</table>

<hr>

<p>En signant ce document, le client reconnait en avoir pris connaissance et en accepte les termes.</p>

<p><strong>Signature du client :</strong></p>
<p>{{Signature}}</p>

<p><strong>Date :</strong></p>
<p>{{Date}}</p>

</body>
</html>`
}

async function handleDocusealSend(supabase, profile, body) {
  const { documentId } = body
  if (!documentId) throw Object.assign(new Error('documentId requis'), { status: 400 })

  const { data: doc } = await supabase.from('documents')
    .select('*').eq('id', documentId).eq('agency_id', profile.agency_id).single()
  if (!doc) throw Object.assign(new Error('Document introuvable'), { status: 404 })
  if (!doc.client_email && !doc.email_destinataire)
    throw Object.assign(new Error("Le document n'a pas d'email client pour la signature."), { status: 400 })

  const signerEmail = doc.client_email || doc.email_destinataire
  const signerName  = doc.client_nom   || doc.destinataire_nom || 'Client'
  const agencyName  = profile.agency_name || profile.nom_complet || "L'agence"
  const docTitle    = doc.titre || doc.reference || 'Document à signer'

  // HTML avec {{Signature}} et {{Date}} — noms standards DocuSeal en <p> simples
  const docHtml = buildDocumentHtml(doc)
  // Log de debug : vérifier que les marqueurs sont bien présents dans le HTML envoyé
  const hasSignature = docHtml.includes('{{Signature}}')
  const hasDate      = docHtml.includes('{{Date}}')
  console.log(`[DocuSeal] Template HTML markers: {{Signature}}=${hasSignature}, {{Date}}=${hasDate}`)
  console.log(`[DocuSeal] HTML snippet around marker:`, docHtml.substring(docHtml.indexOf('{{Signature}}') - 20, docHtml.indexOf('{{Signature}}') + 40))

  const template = await docusealFetch('/templates/html', 'POST', {
    html: docHtml,
    name: docTitle,
  })
  if (!template?.id) throw new Error('Création du template DocuSeal échouée')

  const submission = await docusealFetch('/submissions', 'POST', {
    template_id: template.id,
    send_email:  true,
    submitters: [
      {
        email: signerEmail,
        name:  signerName,
        message: {
          subject: `${docTitle} - Signature requise`,
          body: `Bonjour ${signerName},\n\nVeuillez signer le document "${docTitle}" envoye par ${agencyName}.\n\nCliquez sur le lien pour signer en ligne.\n\nCordialement,\n${agencyName}`,
        },
      },
    ],
  })
  if (!submission?.id) throw new Error('Création de la soumission DocuSeal échouée')

  const signerSlug = submission.submitters?.[0]?.slug || null
  const signerUrl  = signerSlug ? `https://docuseal.com/s/${signerSlug}` : null

  await supabase.from('documents').update({
    docuseal_submission_id: String(submission.id),
    docuseal_slug:    signerSlug,
    signature_status: 'awaiting',
    signature_url:    signerUrl,
    statut:           'envoyé',
    updated_at:       new Date().toISOString(),
  }).eq('id', documentId)

  return { success: true, submission_id: submission.id, signature_url: signerUrl, signer_email: signerEmail }
}

async function handleDocusealStatus(supabase, profile, body) {
  const { documentId } = body
  if (!documentId) throw Object.assign(new Error('documentId requis'), { status: 400 })

  const { data: doc } = await supabase.from('documents')
    .select('docuseal_submission_id, signature_status')
    .eq('id', documentId).eq('agency_id', profile.agency_id).single()
  if (!doc) throw Object.assign(new Error('Document introuvable'), { status: 404 })
  if (!doc.docuseal_submission_id) throw Object.assign(new Error('Document non envoyé pour signature'), { status: 400 })

  const submission = await docusealFetch(`/submissions/${doc.docuseal_submission_id}`)
  const allSigned  = submission.submitters?.every(s => s.completed_at) || false
  const status     = allSigned ? 'completed' : 'awaiting'

  if (status !== doc.signature_status) {
    await supabase.from('documents').update({
      signature_status: status,
      signed_at:  allSigned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', documentId)
  }
  return { status, submitters: submission.submitters }
}

async function handleDocusealWebhook(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const event = req.body?.event_type
  const sub   = req.body?.data
  if (!sub?.id) return res.status(200).json({ ok: true })

  if (['submission.completed', 'submission.form_completed'].includes(event)) {
    const allSigned = sub.submitters?.every(s => s.completed_at) || event === 'submission.completed'
    await supabase.from('documents').update({
      signature_status: allSigned ? 'completed' : 'awaiting',
      signed_at:        allSigned ? new Date().toISOString() : null,
      statut:           allSigned ? 'signé' : 'envoyé',
      updated_at:       new Date().toISOString(),
    }).eq('docuseal_submission_id', String(sub.id))
  }
  return res.status(200).json({ ok: true })
}

// ── Masquer les clés sensibles ─────────────────────────────────────────────
function maskKey(val) {
  if (!val) return ''
  if (val.length <= 8) return '••••••••'
  return '••••••••' + val.slice(-4)
}

// ── Helper CORS ────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ── Auth + profil ──────────────────────────────────────────────────────────
async function getAgencyId(supabase, token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: p } = await supabase.from('profiles')
    .select('agency_id, email, nom_complet').eq('user_id', user.id).single()
  return p ? { ...p, user } : null
}

// ── Actions ────────────────────────────────────────────────────────────────
async function handleGetSettings(supabase, profile) {
  const { data } = await supabase.from('workspace_settings')
    .select('*').eq('agency_id', profile.agency_id).maybeSingle()

  if (!data) return { settings: null, configured: {} }

  // Masquer les clés sensibles avant d'envoyer au client
  const safe = {
    ...data,
    resend_api_key:     maskKey(data.resend_api_key),
    twilio_account_sid: maskKey(data.twilio_account_sid),
    twilio_auth_token:  maskKey(data.twilio_auth_token),
    anthropic_api_key:  maskKey(data.anthropic_api_key),
  }

  const configured = {
    identity: !!(data.agency_name),
    email:    !!(data.resend_api_key && data.from_email),
    whatsapp: !!(data.twilio_account_sid && data.twilio_auth_token && data.twilio_whatsapp_number),
    calendar: true, // toujours des valeurs par défaut
    notifications: !!(data.notification_email),
  }

  return { settings: safe, configured }
}

async function handleSaveSettings(supabase, profile, body) {
  const {
    agency_name, agency_logo_url, primary_color,
    resend_api_key, from_email, from_name, email_signature,
    twilio_account_sid, twilio_auth_token, twilio_whatsapp_number,
    calendar_timezone, working_hours_start, working_hours_end,
    working_days, appointment_duration, booking_link,
    notification_email, notify_new_lead, notify_hot_lead, notify_new_message,
    anthropic_api_key,
  } = body

  // Lire les valeurs actuelles pour ne pas écraser des clés masquées
  const { data: current } = await supabase.from('workspace_settings')
    .select('resend_api_key, twilio_account_sid, twilio_auth_token, anthropic_api_key')
    .eq('agency_id', profile.agency_id).maybeSingle()

  const payload = {
    agency_id: profile.agency_id,
    agency_name, agency_logo_url, primary_color,
    from_email, from_name, email_signature,
    twilio_whatsapp_number,
    calendar_timezone, working_hours_start, working_hours_end,
    working_days, appointment_duration, booking_link,
    notification_email, notify_new_lead, notify_hot_lead, notify_new_message,
  }

  // Ne mettre à jour les clés que si elles ne sont pas masquées (l'user a saisi une nouvelle valeur)
  if (resend_api_key && !resend_api_key.startsWith('••')) payload.resend_api_key = resend_api_key
  else if (current?.resend_api_key) payload.resend_api_key = current.resend_api_key

  if (twilio_account_sid && !twilio_account_sid.startsWith('••')) payload.twilio_account_sid = twilio_account_sid
  else if (current?.twilio_account_sid) payload.twilio_account_sid = current.twilio_account_sid

  if (twilio_auth_token && !twilio_auth_token.startsWith('••')) payload.twilio_auth_token = twilio_auth_token
  else if (current?.twilio_auth_token) payload.twilio_auth_token = current.twilio_auth_token

  if (anthropic_api_key && !anthropic_api_key.startsWith('••')) payload.anthropic_api_key = anthropic_api_key
  else if (current?.anthropic_api_key) payload.anthropic_api_key = current.anthropic_api_key

  const { data, error } = await supabase.from('workspace_settings')
    .upsert(payload, { onConflict: 'agency_id' }).select().single()

  if (error) throw new Error(error.message)
  return { success: true, settings: data }
}

async function handleTestEmail(supabase, profile, body) {
  // Récupérer les vraies clés depuis la DB
  const { data: ws } = await supabase.from('workspace_settings')
    .select('resend_api_key, from_email, from_name, email_signature')
    .eq('agency_id', profile.agency_id).maybeSingle()

  const resendKey = ws?.resend_api_key || process.env.RESEND_API_KEY
  const fromEmail = ws?.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
  const fromName  = ws?.from_name  || 'LeadQualif'
  const toEmail   = body.to || profile.email

  if (!resendKey) return { success: false, error: 'Clé Resend non configurée' }
  if (!toEmail)   return { success: false, error: 'Adresse email de destination manquante' }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b;">
      <h2 style="color:#4f46e5;">✅ Test email réussi !</h2>
      <p>Bonjour,</p>
      <p>Si vous recevez cet email, votre configuration Resend fonctionne parfaitement.</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:14px;margin:16px 0;font-size:13px;color:#64748b;">
        <p style="margin:2px 0"><strong>De :</strong> ${fromName} &lt;${fromEmail}&gt;</p>
        <p style="margin:2px 0"><strong>À :</strong> ${toEmail}</p>
        <p style="margin:2px 0"><strong>Envoyé le :</strong> ${new Date().toLocaleString('fr-FR')}</p>
      </div>
      ${ws?.email_signature ? `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/><p style="font-size:12px;color:#94a3b8;">${ws.email_signature}</p>` : ''}
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to:   [toEmail],
      subject: '✅ Test email LeadQualif',
      html,
    }),
  })

  const data = await res.json()
  if (!res.ok) return { success: false, error: data.message || `Resend ${res.status}` }
  return { success: true, message: `Email envoyé à ${toEmail}`, id: data.id }
}

async function handleTestWhatsApp(supabase, profile, body) {
  const { data: ws } = await supabase.from('workspace_settings')
    .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
    .eq('agency_id', profile.agency_id).maybeSingle()

  const accountSid = ws?.twilio_account_sid  || process.env.TWILIO_ACCOUNT_SID
  const authToken  = ws?.twilio_auth_token   || process.env.TWILIO_AUTH_TOKEN
  const fromNumber = ws?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
  const toNumber   = body.to || null

  if (!accountSid || !authToken || !fromNumber)
    return { success: false, error: 'Twilio non configuré. Renseignez Account SID, Auth Token et numéro WhatsApp.' }
  if (!toNumber)
    return { success: false, error: 'Numéro de destination requis' }

  const normalized = toNumber.startsWith('+') ? toNumber : '+' + toNumber.replace(/^00/, '')
  const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`
  const to   = normalized.startsWith('whatsapp:') ? normalized : `whatsapp:${normalized}`

  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: '✅ Test WhatsApp LeadQualif — votre configuration fonctionne !' }).toString(),
  })

  const data = await res.json()
  if (!res.ok) return { success: false, error: data.message || `Twilio ${res.status}` }
  return { success: true, message: `Message envoyé à ${normalized}`, sid: data.sid }
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Config Supabase manquante' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const profile = await getAgencyId(supabase, token)
  if (!profile) return res.status(401).json({ error: 'Token invalide' })

  const { action, ...body } = req.body || {}

  // Le webhook DocuSeal n'a pas de token utilisateur
  if (action === 'docuseal-webhook') return await handleDocusealWebhook(req, res)

  try {
    if (action === 'get-settings')      return res.status(200).json(await handleGetSettings(supabase, profile))
    if (action === 'save-settings')     return res.status(200).json(await handleSaveSettings(supabase, profile, body))
    if (action === 'test-email')        return res.status(200).json(await handleTestEmail(supabase, profile, body))
    if (action === 'test-whatsapp')     return res.status(200).json(await handleTestWhatsApp(supabase, profile, body))
    if (action === 'docuseal-send')     return res.status(200).json(await handleDocusealSend(supabase, profile, body))
    if (action === 'docuseal-status')   return res.status(200).json(await handleDocusealStatus(supabase, profile, body))
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[workspace/${action}]`, err.message)
    return res.status(err.status || 500).json({ error: err.message })
  }
}
