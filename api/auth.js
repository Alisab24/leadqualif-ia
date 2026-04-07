/**
 * GET|POST /api/auth
 *
 * Gère les flux OAuth pour Google et Microsoft (email + calendrier).
 *
 * GET  ?action=google-init&state=<b64_token>        → redirect Google OAuth
 * GET  ?action=google-callback&code=...&state=...   → store tokens, redirect app
 * GET  ?action=microsoft-init&state=<b64_token>     → redirect Microsoft OAuth
 * GET  ?action=microsoft-callback&code=...&state=...
 * POST { action: 'get-status' }                     → statut intégrations user
 * POST { action: 'disconnect', provider }            → supprimer intégration
 *
 * Variables d'environnement requises :
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   APP_URL  (ex: https://www.leadqualif.com)
 */

import { createClient }                                    from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import nodemailer                                           from 'nodemailer'

const APP_URL = process.env.APP_URL || 'https://www.leadqualif.com'

/* ── Chiffrement mot de passe SMTP (AES-256-GCM) ─────────────────────────── */
function getSmtpKey() {
  const secret = process.env.SMTP_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || 'leadqualif-smtp-fallback-key'
  return createHash('sha256').update(secret).digest() // 32 bytes
}

function encryptSmtpPassword(plaintext) {
  const key = getSmtpKey()
  const iv  = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptSmtpPassword(encoded) {
  try {
    const [ivHex, tagHex, encHex] = encoded.split(':')
    const key     = getSmtpKey()
    const iv      = Buffer.from(ivHex,  'hex')
    const tag     = Buffer.from(tagHex, 'hex')
    const enc     = Buffer.from(encHex, 'hex')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/* ── Google OAuth ─────────────────────────────────────────────────────────── */
const GOOGLE_AUTH_URL    = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO    = 'https://www.googleapis.com/oauth2/v2/userinfo'
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/* ── Microsoft OAuth ──────────────────────────────────────────────────────── */
const MS_AUTH_URL  = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_SCOPES    = 'offline_access Mail.Send Mail.Read Calendars.ReadWrite User.Read'

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function supabaseService() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/** Encode state = base64(JSON{uid, nonce}) — court, sans JWT dans l'URL */
function encodeState(uid) {
  const nonce = Math.random().toString(36).slice(2)
  return Buffer.from(JSON.stringify({ uid, nonce })).toString('base64')
}

function decodeState(state) {
  try {
    // Normalise base64url → base64 standard si nécessaire
    const normalized = state.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(normalized, 'base64').toString())
  } catch {
    return null
  }
}

/** Vérifier le JWT Supabase et retourner l'user */
async function verifyToken(token) {
  const sb = supabaseService()
  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return null
  return user
}

/** Stocker/mettre à jour une intégration email */
async function upsertEmailIntegration(userId, provider, { email, access_token, refresh_token, expires_in }) {
  const sb = supabaseService()
  const expires = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
  await sb.from('email_integrations').upsert({
    user_id: userId, provider, email,
    access_token, refresh_token,
    token_expires_at: expires,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' })
}

/** Stocker/mettre à jour une intégration calendrier */
async function upsertCalendarIntegration(userId, provider, { access_token, refresh_token, expires_in }) {
  const sb = supabaseService()
  const expires = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
  await sb.from('calendar_integrations').upsert({
    user_id: userId, provider,
    access_token, refresh_token,
    token_expires_at: expires,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' })
}

/* ── Handlers GET ─────────────────────────────────────────────────────────── */

function handleGoogleInit(req, res) {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const redirectUri  = `${APP_URL}/api/auth?action=google-callback`
  const stateToken   = req.query.state || ''

  if (!clientId) return res.status(503).send('GOOGLE_CLIENT_ID non configuré')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         GOOGLE_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         stateToken,
  })
  return res.redirect(302, `${GOOGLE_AUTH_URL}?${params}`)
}

async function handleGoogleCallback(req, res) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(302, `${APP_URL}/settings/integrations?error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return res.redirect(302, `${APP_URL}/settings/integrations?error=missing_params`)
  }

  const stateObj = decodeState(state)
  if (!stateObj?.uid) {
    return res.redirect(302, `${APP_URL}/settings/integrations?error=invalid_state`)
  }

  const userId = stateObj.uid

  try {
    // Échanger le code contre les tokens
    const clientId     = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri  = `${APP_URL}/api/auth?action=google-callback`

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokens.error_description || 'Token exchange failed')

    // Récupérer l'email Google de l'user
    const infoRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await infoRes.json()

    // Stocker email integration ET calendar integration (même token, scopes combinés)
    await Promise.all([
      upsertEmailIntegration(userId, 'google', {
        email:         info.email,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in:    tokens.expires_in,
      }),
      upsertCalendarIntegration(userId, 'google', {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in:    tokens.expires_in,
      }),
    ])

    return res.redirect(302, `${APP_URL}/settings/integrations?connected=google`)
  } catch (err) {
    console.error('[auth/google-callback]', err.message)
    return res.redirect(302, `${APP_URL}/settings/integrations?error=${encodeURIComponent(err.message)}`)
  }
}

function handleMicrosoftInit(req, res) {
  const clientId    = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = `${APP_URL}/api/auth?action=microsoft-callback`
  const stateToken  = req.query.state || ''

  if (!clientId) return res.status(503).send('MICROSOFT_CLIENT_ID non configuré')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         MS_SCOPES,
    response_mode: 'query',
    state:         stateToken,
  })
  return res.redirect(302, `${MS_AUTH_URL}?${params}`)
}

async function handleMicrosoftCallback(req, res) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(302, `${APP_URL}/settings/integrations?error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return res.redirect(302, `${APP_URL}/settings/integrations?error=missing_params`)
  }

  const stateObj = decodeState(state)
  if (!stateObj?.uid) {
    return res.redirect(302, `${APP_URL}/settings/integrations?error=invalid_state`)
  }

  const userId = stateObj.uid

  try {
    const clientId     = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const redirectUri  = `${APP_URL}/api/auth?action=microsoft-callback`

    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: MS_SCOPES }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokens.error_description || 'Token exchange failed')

    // Récupérer l'email Microsoft via Graph
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const me = await meRes.json()
    const email = me.mail || me.userPrincipalName || ''

    await Promise.all([
      upsertEmailIntegration(userId, 'microsoft', {
        email,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in:    tokens.expires_in,
      }),
      upsertCalendarIntegration(userId, 'microsoft', {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in:    tokens.expires_in,
      }),
    ])

    return res.redirect(302, `${APP_URL}/settings/integrations?connected=microsoft`)
  } catch (err) {
    console.error('[auth/microsoft-callback]', err.message)
    return res.redirect(302, `${APP_URL}/settings/integrations?error=${encodeURIComponent(err.message)}`)
  }
}

/* ── Handlers SMTP ────────────────────────────────────────────────────────── */

/** Tester une connexion SMTP sans sauvegarder */
async function handleTestSmtp(req, res, user) {
  const { host, port, email, displayName, password, encryption } = req.body
  if (!host || !port || !email || !password) {
    return res.status(400).json({ error: 'Champs requis : host, port, email, password' })
  }

  const secure = encryption === 'ssl'
  const transport = nodemailer.createTransport({
    host,
    port:    parseInt(port, 10),
    secure,
    auth:    { user: email, pass: password },
    tls:     { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
  })

  try {
    await transport.verify()
    // Envoyer un vrai email test à l'adresse Supabase de l'agent
    await transport.sendMail({
      from:    `"${displayName || email}" <${email}>`,
      to:      user.email,
      subject: '✅ Test SMTP — LeadQualif',
      html:    '<p>Votre configuration SMTP fonctionne correctement avec <strong>LeadQualif</strong>. Vous pouvez maintenant enregistrer vos paramètres.</p>',
    })
    return res.status(200).json({ success: true, message: `Email test envoyé à ${user.email}` })
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message })
  }
}

/** Sauvegarder la config SMTP (mot de passe chiffré) */
async function handleSaveSmtp(req, res, user) {
  const { host, port, email, displayName, password, encryption } = req.body
  if (!host || !port || !email || !password) {
    return res.status(400).json({ error: 'Champs requis manquants' })
  }

  const sb = supabaseService()
  const { error } = await sb.from('email_integrations').upsert({
    user_id:            user.id,
    provider:           'smtp',
    email,
    smtp_host:          host,
    smtp_port:          parseInt(port, 10),
    smtp_user:          email,
    smtp_display_name:  displayName || '',
    smtp_password_enc:  encryptSmtpPassword(password),
    smtp_encryption:    encryption || 'tls',
    is_active:          true,
    updated_at:         new Date().toISOString(),
  }, { onConflict: 'user_id,provider' })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}

/** Récupérer la config SMTP sans mot de passe */
async function handleGetSmtpConfig(req, res, user) {
  const sb = supabaseService()
  const { data } = await sb.from('email_integrations')
    .select('smtp_host,smtp_port,smtp_user,smtp_display_name,smtp_encryption,is_active,updated_at')
    .eq('user_id', user.id).eq('provider', 'smtp').eq('is_active', true)
    .maybeSingle()
  return res.status(200).json({ config: data || null })
}

/* ── Handlers POST ────────────────────────────────────────────────────────── */

async function handleGetStatus(req, res, user) {
  const sb = supabaseService()
  const [{ data: emails }, { data: cals }] = await Promise.all([
    sb.from('email_integrations')
      .select('provider,email,smtp_host,smtp_port,smtp_user,smtp_display_name,smtp_encryption,is_active,updated_at')
      .eq('user_id', user.id).eq('is_active', true),
    sb.from('calendar_integrations')
      .select('provider,is_active,updated_at').eq('user_id', user.id).eq('is_active', true),
  ])
  return res.status(200).json({
    email:    emails || [],
    calendar: cals   || [],
  })
}

async function handleDisconnect(req, res, user) {
  const { provider, type = 'both' } = req.body
  if (!provider) return res.status(400).json({ error: 'provider requis' })
  const sb = supabaseService()
  if (type === 'email' || type === 'both') {
    await sb.from('email_integrations').update({ is_active: false }).eq('user_id', user.id).eq('provider', provider)
  }
  if (type === 'calendar' || type === 'both') {
    await sb.from('calendar_integrations').update({ is_active: false }).eq('user_id', user.id).eq('provider', provider)
  }
  return res.status(200).json({ success: true })
}

/** Encode state et retourner l'URL OAuth à appeler (sans redirect, utilisé par le frontend) */
async function handleGetOAuthUrl(req, res, user) {
  const { provider } = req.body
  const stateEncoded = encodeState(user.id)   // state court : uid + nonce (~50 chars)
  let url = ''
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri:  `${APP_URL}/api/auth?action=google-callback`,
      response_type: 'code',
      scope:         GOOGLE_SCOPES,
      access_type:   'offline',
      prompt:        'consent',
      state:         stateEncoded,
    })
    url = `${GOOGLE_AUTH_URL}?${params}`
  } else if (provider === 'microsoft') {
    const params = new URLSearchParams({
      client_id:     process.env.MICROSOFT_CLIENT_ID || '',
      redirect_uri:  `${APP_URL}/api/auth?action=microsoft-callback`,
      response_type: 'code',
      scope:         MS_SCOPES,
      response_mode: 'query',
      state:         stateEncoded,
    })
    url = `${MS_AUTH_URL}?${params}`
  } else {
    return res.status(400).json({ error: 'provider invalide' })
  }
  return res.status(200).json({ url })
}

/* ── Handler principal ────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = req.query.action || req.body?.action

  // ── GET : flux OAuth (redirections) ───────────────────────────────────────
  if (req.method === 'GET') {
    if (action === 'google-init')          return handleGoogleInit(req, res)
    if (action === 'google-callback')      return handleGoogleCallback(req, res)
    if (action === 'microsoft-init')       return handleMicrosoftInit(req, res)
    if (action === 'microsoft-callback')   return handleMicrosoftCallback(req, res)
    return res.status(400).send('Action inconnue')
  }

  // ── POST : actions authentifiées ──────────────────────────────────────────
  if (req.method === 'POST') {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'Non authentifié' })
    const user = await verifyToken(token)
    if (!user) return res.status(401).json({ error: 'Token invalide' })

    try {
      if (action === 'get-status')     return handleGetStatus(req, res, user)
      if (action === 'disconnect')     return handleDisconnect(req, res, user)
      if (action === 'get-oauth-url')  return handleGetOAuthUrl(req, res, user)
      if (action === 'test-smtp')      return handleTestSmtp(req, res, user)
      if (action === 'save-smtp')      return handleSaveSmtp(req, res, user)
      if (action === 'get-smtp-config')return handleGetSmtpConfig(req, res, user)
      return res.status(400).json({ error: `Action inconnue: "${action}"` })
    } catch (err) {
      console.error(`[auth/${action}]`, err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' })
}
