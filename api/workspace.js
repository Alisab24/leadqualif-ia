/**
 * POST /api/workspace
 * Gestion des paramètres workspace (agence).
 *
 * Actions :
 *   get-settings         → Lire les settings (clés masquées)
 *   save-settings        → Sauvegarder (upsert)
 *   test-email           → Envoyer un email de test via Resend
 *   test-whatsapp        → Envoyer un WA de test via Twilio
 *
 * Headers : Authorization: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js'

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

  try {
    if (action === 'get-settings')    return res.status(200).json(await handleGetSettings(supabase, profile))
    if (action === 'save-settings')   return res.status(200).json(await handleSaveSettings(supabase, profile, body))
    if (action === 'test-email')      return res.status(200).json(await handleTestEmail(supabase, profile, body))
    if (action === 'test-whatsapp')   return res.status(200).json(await handleTestWhatsApp(supabase, profile, body))
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[workspace/${action}]`, err.message)
    return res.status(500).json({ error: err.message })
  }
}
