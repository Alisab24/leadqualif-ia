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
import { ImapFlow }                                 from 'imapflow'
import { simpleParser }                             from 'mailparser'

/* ── Helpers encodage email ───────────────────────────────────────────────── */

/** Décode un corps email (base64url/base64/quoted-printable) → texte propre */
function decodeEmailBody(raw = '', encoding = '') {
  if (!raw) return ''
  try {
    const enc = (encoding || '').toLowerCase()
    if (enc === 'base64' || /^[A-Za-z0-9+/\-_]+=*$/.test(raw.replace(/\s/g, ''))) {
      const normalized = raw.replace(/-/g,'+').replace(/_/g,'/').replace(/\s/g,'')
      const decoded = Buffer.from(normalized, 'base64').toString('utf-8')
      if (decoded && decoded.length > 0 && /[\x20-\x7E\u00C0-\u024F]/.test(decoded)) return decoded
    }
    if (enc === 'quoted-printable' || raw.includes('=?')) {
      return raw
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    }
    return raw
  } catch { return raw }
}

/** Extrait le texte lisible d'un email (HTML → texte, nettoyage) */
function extractEmailText(html = '', text = '') {
  if (text) return text.trim()
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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

/** Rafraîchit le token Google et met à jour la base */
async function _refreshGoogleToken(integration, supabase, userId) {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret || !integration.refresh_token)
    throw new Error('Impossible de rafraîchir le token Google (config manquante)')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: integration.refresh_token,
      grant_type:    'refresh_token',
    }).toString(),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Refresh Google: ${d.error_description || d.error || r.status}`)

  const newToken  = d.access_token
  const expiresAt = new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString()
  // Mettre à jour en base (best-effort, on n'échoue pas si ça rate)
  await supabase.from('email_integrations')
    .update({ access_token: newToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('provider', 'google')
    .catch(e => console.warn('[_refreshGoogleToken] update base échoué:', e.message))

  return newToken
}

/** Rafraîchit le token Microsoft et met à jour la base */
async function _refreshMicrosoftToken(integration, supabase, userId) {
  const clientId     = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret || !integration.refresh_token)
    throw new Error('Impossible de rafraîchir le token Microsoft (config manquante)')

  const r = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: integration.refresh_token,
      grant_type:    'refresh_token',
      scope:         'https://graph.microsoft.com/Mail.Send offline_access',
    }).toString(),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`Refresh Microsoft: ${d.error_description || d.error || r.status}`)

  const newToken  = d.access_token
  const expiresAt = new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString()
  await supabase.from('email_integrations')
    .update({ access_token: newToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('provider', 'microsoft')
    .catch(e => console.warn('[_refreshMicrosoftToken] update base échoué:', e.message))

  return newToken
}

/** Encode un header RFC 2047 si non-ASCII (Subject, From display name…) */
function _rfc2047(str = '') {
  // Si tout est ASCII on renvoie tel quel
  if (/^[\x20-\x7E]*$/.test(str)) return str
  return `=?UTF-8?B?${Buffer.from(str).toString('base64')}?=`
}

/** Extrait l'adresse email pure depuis "Nom Prénom <addr@domain>" ou "addr@domain" */
function _extractEmail(str = '') {
  const m = str.match(/<([^>]+)>/)
  return (m ? m[1] : str).trim().toLowerCase()
}

/** Gmail API (OAuth Google) — avec refresh automatique si token expiré */
async function _sendViaGmail(to, subject, html, text, integration, supabase, userId) {
  const buildRaw = () => {
    const toAddr   = _extractEmail(to)
    const fromAddr = _extractEmail(integration.email)
    const mime = [
      `From: ${fromAddr}`,
      `To: ${toAddr}`,
      `Subject: ${_rfc2047(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      html,
    ].join('\r\n')
    return Buffer.from(mime).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  }

  const callGmail = async (token) => fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw: buildRaw() }),
  })

  let res = await callGmail(integration.access_token)

  // Token expiré (401) → on rafraîchit et on réessaie
  if (res.status === 401 && supabase && userId) {
    let refreshed = false
    try {
      const newToken = await _refreshGoogleToken(integration, supabase, userId)
      res = await callGmail(newToken)
      refreshed = true
    } catch (refreshErr) {
      console.error('[_sendViaGmail] refresh échoué:', refreshErr.message)
    }
    // Si le refresh a échoué ou si après refresh c'est encore 401 → message actionnable
    if (!refreshed || res.status === 401) {
      throw Object.assign(
        new Error('Votre connexion Gmail a expiré. Reconnectez votre compte dans Paramètres → Intégrations → Email.'),
        { status: 401, code: 'TOKEN_EXPIRED' }
      )
    }
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    const msg = e.error?.message || JSON.stringify(e)
    // 401 sans refresh possible → même message actionnable
    if (res.status === 401) {
      throw Object.assign(
        new Error('Votre connexion Gmail a expiré. Reconnectez votre compte dans Paramètres → Intégrations → Email.'),
        { status: 401, code: 'TOKEN_EXPIRED' }
      )
    }
    throw new Error(`Gmail ${res.status}: ${msg}`)
  }
  return { provider: 'gmail', email: integration.email }
}

/** Microsoft Graph API (OAuth Microsoft) — avec refresh automatique */
async function _sendViaMicrosoft(to, subject, html, text, integration, supabase, userId) {
  const callGraph = async (token) => fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: _extractEmail(to) } }],
      },
      saveToSentItems: true,
    }),
  })

  let res = await callGraph(integration.access_token)

  if (res.status === 401 && supabase && userId) {
    let refreshed = false
    try {
      const newToken = await _refreshMicrosoftToken(integration, supabase, userId)
      res = await callGraph(newToken)
      refreshed = true
    } catch (refreshErr) {
      console.error('[_sendViaMicrosoft] refresh échoué:', refreshErr.message)
    }
    if (!refreshed || res.status === 401) {
      throw Object.assign(
        new Error('Votre connexion Outlook a expiré. Reconnectez votre compte dans Paramètres → Intégrations → Email.'),
        { status: 401, code: 'TOKEN_EXPIRED' }
      )
    }
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    if (res.status === 401) throw Object.assign(new Error('Votre connexion Outlook a expiré. Reconnectez votre compte dans Paramètres → Intégrations → Email.'), { status: 401 })
    throw new Error(`Outlook ${res.status}: ${e.error?.message || ''}`)
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
  // Valider l'adresse email destinataire
  const cleanTo = _extractEmail(to || '')
  if (!cleanTo || !cleanTo.includes('@') || !cleanTo.includes('.')) {
    throw Object.assign(
      new Error(`Adresse email invalide : "${cleanTo || to}". Mettez à jour la fiche du lead.`),
      { status: 400 }
    )
  }

  // Récupérer les intégrations actives de l'agent
  const { data: integrations, error: intError } = await supabase
    .from('email_integrations')
    .select('provider,email,access_token,refresh_token,token_expires_at,smtp_host,smtp_port,smtp_user,smtp_display_name,smtp_password_enc,smtp_encryption')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (intError) console.warn('[sendEmailAny] Erreur lecture email_integrations:', intError.message)

  const googleInt    = integrations?.find(i => i.provider === 'google')
  const microsoftInt = integrations?.find(i => i.provider === 'microsoft')
  const smtpInt      = integrations?.find(i => i.provider === 'smtp' && i.smtp_host)

  // Refresh proactif si le token expire dans moins de 5 minutes
  if (googleInt?.access_token) {
    if (googleInt.token_expires_at && new Date(googleInt.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
      try {
        const newToken = await _refreshGoogleToken(googleInt, supabase, userId)
        googleInt.access_token = newToken
      } catch (e) { console.warn('[sendEmailAny] refresh Google proactif échoué:', e.message) }
    }
    return _sendViaGmail(cleanTo, subject, html, text, googleInt, supabase, userId)
  }
  if (microsoftInt?.access_token) {
    if (microsoftInt.token_expires_at && new Date(microsoftInt.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
      try {
        const newToken = await _refreshMicrosoftToken(microsoftInt, supabase, userId)
        microsoftInt.access_token = newToken
      } catch (e) { console.warn('[sendEmailAny] refresh Microsoft proactif échoué:', e.message) }
    }
    return _sendViaMicrosoft(cleanTo, subject, html, text, microsoftInt, supabase, userId)
  }
  if (smtpInt)                    return _sendViaSmtp(cleanTo, subject, html, text, smtpInt)

  // Fallback Resend
  if (!resendKey) {
    const noProviderMsg = 'Aucun email configuré. Ajoutez une intégration Gmail, Outlook ou SMTP dans Paramètres → Intégrations.'
    throw Object.assign(new Error(noProviderMsg), { code: 'NO_EMAIL_PROVIDER', status: 503 })
  }
  const result = await sendResendEmail(cleanTo, subject, html, text, fallbackFrom, resendKey, fallbackName)
  if (result?.statusCode >= 400) throw new Error(result.message || 'Erreur Resend')
  return { provider: 'resend', email: fallbackFrom }
}

function normalizePhone(phone) {
  if (!phone) return null
  return phone.startsWith('+') ? phone : '+' + phone.replace(/^00/, '')
}

/* ── Templates par défaut LeadQualif Kit (Premier contact) ──────────────── */
// Ces templates sont utilisés quand aucun template personnalisé n'est configuré.
// Les agences clientes peuvent surcharger via Paramètres → Agent IA.
const LEADQUALIF_TEMPLATES = {
  // ─── WhatsApp ────────────────────────────────────────────────────────────
  smma_wa: `Bonjour {{prenom}},

J'ai vu que tu gères des campagnes Meta pour tes clients.

On a développé LeadQualif — un outil qui génère des leads qualifiés avec score IA pour les agences comme la tienne.

Je t'offre 50 leads gratuits sur ton secteur pour tester. Sans engagement.

Ça t'intéresse ?`,

  immo_wa: `Bonjour {{prenom}},

J'ai vu que votre agence est active sur {{ville}}.

LeadQualif identifie automatiquement les propriétaires et acheteurs potentiels dans votre zone avec un score IA.

Je vous offre 50 contacts qualifiés sur {{ville}} pour tester.

Ça vous intéresse ?`,

  default_wa: `Bonjour {{prenom}},

J'ai vu que vous êtes actif dans le secteur {{secteur}}.

On a développé LeadQualif — un outil qui génère des leads qualifiés avec score IA et automatise le premier contact.

Je vous offre 50 leads gratuits pour tester. Sans engagement.

Ça vous intéresse ?`,

  // ─── Email — Objet ────────────────────────────────────────────────────────
  smma_email_subject:    `50 leads qualifiés offerts pour {{nom_agence}}`,
  immo_email_subject:    `50 contacts vendeurs offerts sur {{ville}}`,
  default_email_subject: `50 leads qualifiés offerts — LeadQualif`,

  // ─── Email — Corps ────────────────────────────────────────────────────────
  smma_email_body: `Bonjour {{prenom}},

Je m'appelle {{ton_prenom}}, fondateur de LeadQualif.

J'ai vu que {{nom_agence}} gère des campagnes Meta pour ses clients — et je parie que trouver des prospects qualifiés prend beaucoup de temps à ton équipe.

LeadQualif automatise exactement ça :
→ Scraping automatique (Facebook Pages + Pages Jaunes)
→ Score IA 0-100 : Chaud / Tiède / Froid
→ Agent WhatsApp qui contacte les leads chauds en 5 minutes

Je t'offre 50 leads qualifiés gratuits sur ton secteur pour tester.

Tu veux que je te les envoie ?

Bonne journée,
{{ton_prenom}}
LeadQualif — leadqualif.com`,

  immo_email_body: `Bonjour {{prenom}},

Je m'appelle {{ton_prenom}}, fondateur de LeadQualif.

J'ai vu que votre agence est spécialisée sur {{ville}} — et je sais que trouver des vendeurs potentiels avant la concurrence est un enjeu clé.

LeadQualif identifie automatiquement :
→ Les propriétaires susceptibles de vendre dans votre zone
→ Les acheteurs actifs en recherche
→ Avec un Score IA pour prioriser les plus chauds

Je vous offre 50 contacts qualifiés sur {{ville}} pour tester.

Vous voulez que je vous les envoie ?

Bien cordialement,
{{ton_prenom}}
LeadQualif — leadqualif.com`,

  default_email_body: `Bonjour {{prenom}},

Je m'appelle {{ton_prenom}}, fondateur de LeadQualif.

LeadQualif automatise la qualification de vos leads avec un score IA 0-100 et un agent de premier contact automatique — pour que vos commerciaux se concentrent uniquement sur les prospects chauds.

Je vous offre 50 leads qualifiés gratuits sur votre secteur pour tester.

Vous voulez que je vous les envoie ?

Cordialement,
{{ton_prenom}}
LeadQualif — leadqualif.com`,
}

/* ── Action : auto-contact agent IA ──────────────────────────────────────── */
async function generateClaudeMessage(lead, agencyName, apiKey, channel = 'whatsapp') {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant')

  const secteur = (lead.secteur_activite || lead.type_service || lead.secteur || '').toLowerCase()
  let contexte = 'Secteur inconnu. Message générique sur : automatiser la qualification des leads et gagner du temps dans la prospection.'
  if (secteur.includes('smma') || secteur.includes('marketing') || secteur.includes('agence')) {
    contexte = 'Le lead travaille dans le secteur SMMA/Marketing. Axe sur : générer des leads qualifiés, automatiser la prospection, augmenter le ROI publicité.'
  } else if (secteur.includes('immo') || secteur.includes('immobilier') || secteur.includes('bien') || secteur.includes('achat')) {
    contexte = 'Le lead est dans l\'immobilier. Axe sur : trouver des propriétaires et acheteurs qualifiés, automatiser la qualification des prospects.'
  }

  const isEmail = channel === 'email'
  const prompt = isEmail
    ? `Tu es un assistant commercial expert pour ${agencyName || 'LeadQualif'}.
Génère un email de premier contact professionnel pour ce lead.

Règles STRICTES :
- Objet de l'email sur la 1ère ligne, préfixé par "Objet: "
- Corps de l'email ensuite (séparé par une ligne vide)
- Maximum 4-5 phrases, ton professionnel et chaleureux
- Personnalisé avec le prénom du lead si disponible
- Termine par une question ouverte et une signature avec ${agencyName}
- Maximum 1 emoji
- Langue : français
- Ne mentionne PAS le nom de l'outil ou du logiciel

Contexte : ${contexte}
Lead : Nom: ${lead.nom || 'le contact'} | Secteur: ${lead.secteur_activite || lead.secteur || 'non précisé'} | Score: ${lead.score_ia || lead.score || 0}%

Génère UNIQUEMENT l'email (Objet + corps), sans guillemets ni préambule.`
    : `Tu es un assistant commercial expert pour ${agencyName || 'LeadQualif'}.
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

  // Récupérer la clé Anthropic depuis workspace_settings (priorité DB > env var)
  const { data: ws } = await supabase.from('workspace_settings')
    .select('anthropic_api_key, resend_api_key, from_email, from_name')
    .eq('agency_id', profile.agency_id).maybeSingle()
  const anthropicKey = ws?.anthropic_api_key || process.env.ANTHROPIC_API_KEY

  const { data: lead, error: leadErr } = await supabase.from('leads')
    .select('id, nom, email, telephone, adresse, localisation_souhaitee, adresse_bien, agency_id, score_ia, score, statut_crm, secteur, secteur_activite, type_service, source, do_not_contact, auto_contacted_at, agent_ia_enabled')
    .eq('id', leadId).eq('agency_id', profile.agency_id).single()
  if (leadErr || !lead) return res.status(404).json({ error: 'Lead introuvable' })

  if (lead.do_not_contact) return res.status(200).json({ skipped: true, reason: 'Lead marqué "Ne pas contacter"' })
  if (lead.agent_ia_enabled === false) return res.status(200).json({ skipped: true, reason: 'Agent IA désactivé pour ce lead' })
  if (lead.auto_contacted_at) return res.status(200).json({ skipped: true, reason: 'Lead déjà contacté automatiquement' })

  const hasPhone = !!lead.telephone
  const hasEmail = !!_extractEmail(lead.email || '')?.includes('@')
  if (!hasPhone && !hasEmail)
    return res.status(200).json({ skipped: true, reason: 'Lead sans téléphone ni email' })

  // Rate-limit 20/heure
  const { count } = await supabase.from('agent_actions').select('id', { count: 'exact', head: true })
    .eq('agency_id', profile.agency_id).eq('status', 'sent')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
  if ((count || 0) >= 20) return res.status(429).json({ error: 'Rate limit atteint (20 messages/heure max)' })

  // ── Variables communes ────────────────────────────────────────────────────
  const agencyName = profile.nom_agence || profile.nom_complet || 'LeadQualif'
  const tonPrenom  = (profile.nom_complet || '').split(' ')[0] || profile.nom_complet || 'L\'équipe'
  const secteur    = (lead.secteur_activite || lead.type_service || lead.secteur || '').toLowerCase()
  const isSmma     = secteur.includes('smma') || secteur.includes('marketing') || secteur.includes('agence')
  const isImmo     = secteur.includes('immo') || secteur.includes('bien') || secteur.includes('achat')
  const prenom     = (lead.nom || '').split(' ')[0] || lead.nom || 'vous'
  const leadVille  = lead.localisation_souhaitee || lead.adresse_bien || lead.adresse || 'votre zone'
  const leadAgence = lead.nom || 'votre agence'

  // Applique les variables {{...}} dans un template (custom ou par défaut)
  const applyVars = (tpl) => (tpl || '')
    .replace(/\{\{nom\}\}/gi,        lead.nom      || 'vous')
    .replace(/\{\{prenom\}\}/gi,     prenom)
    .replace(/\{\{agence\}\}/gi,     agencyName)
    .replace(/\{\{secteur\}\}/gi,    lead.secteur_activite || lead.secteur || 'votre secteur')
    .replace(/\{\{ville\}\}/gi,      leadVille)
    .replace(/\{\{nom_agence\}\}/gi, leadAgence)
    .replace(/\{\{ton_prenom\}\}/gi, tonPrenom)

  // ── Résolution des templates ──────────────────────────────────────────────
  // Priorité : template personnalisé (agency_settings) → LeadQualif par défaut
  const customWa      = isSmma ? settings?.agent_smma_template
                      : isImmo ? settings?.agent_immo_template
                      :          settings?.agent_default_template
  const defaultWaKey  = isSmma ? 'smma_wa'  : isImmo ? 'immo_wa'  : 'default_wa'
  const defaultEmSubj = isSmma ? 'smma_email_subject' : isImmo ? 'immo_email_subject' : 'default_email_subject'
  const defaultEmBody = isSmma ? 'smma_email_body'    : isImmo ? 'immo_email_body'    : 'default_email_body'

  // ── Message WhatsApp ──────────────────────────────────────────────────────
  let waMessage = ''
  if (customWa) {
    waMessage = applyVars(customWa)
  } else {
    // Template LeadQualif par défaut — pas besoin de clé Anthropic
    waMessage = applyVars(LEADQUALIF_TEMPLATES[defaultWaKey])
  }

  // ── Message Email ─────────────────────────────────────────────────────────
  let emailSubject = ''
  let emailBody    = ''
  if (hasEmail) {
    if (customWa) {
      // Si l'agence a un template custom WhatsApp, l'adapter pour email
      emailSubject = `Premier contact — ${agencyName}`
      emailBody    = applyVars(customWa)
    } else {
      // Utiliser le template email LeadQualif par défaut
      emailSubject = applyVars(LEADQUALIF_TEMPLATES[defaultEmSubj])
      emailBody    = applyVars(LEADQUALIF_TEMPLATES[defaultEmBody])
    }
  }

  // ── Vérification canaux disponibles ──────────────────────────────────────
  const accountSid = settings?.twilio_account_sid   || process.env.TWILIO_ACCOUNT_SID
  const authToken  = settings?.twilio_auth_token    || process.env.TWILIO_AUTH_TOKEN
  const fromNumber = settings?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER
  const hasWa      = hasPhone && !!(accountSid && authToken && fromNumber)
  const hasEmailInt = hasEmail && !!(emailBody)  // sendEmailAny gère OAuth/SMTP

  if (!hasWa && !hasEmailInt)
    return res.status(503).json({ error: 'Ni WhatsApp (Twilio) ni email (intégration) configuré' })

  const channels = []

  // ── Envoi WhatsApp ────────────────────────────────────────────────────────
  if (hasWa && waMessage) {
    const toNumber     = normalizePhone(lead.telephone)
    const twilioResult = await sendTwilioMessage(fromNumber, toNumber, waMessage, accountSid, authToken)
    await supabase.from('conversations').insert({
      lead_id: lead.id, agency_id: profile.agency_id,
      channel: 'whatsapp', direction: 'outbound',
      from_number: fromNumber.replace(/^whatsapp:/i, ''), to_number: toNumber,
      content: waMessage,
      status: ['sent','delivered','read','failed'].includes(twilioResult.status) ? twilioResult.status : 'sent',
      twilio_sid: twilioResult.sid || null,
      read_at: new Date().toISOString(),
      sender_name: `🤖 Agent IA · ${agencyName}`, thread_status: 'open',
    }).catch(e => console.error('[crm/auto-contact] wa conv error:', e))
    channels.push('whatsapp')
  }

  // ── Envoi Email (via OAuth/SMTP — sendEmailAny) ───────────────────────────
  if (hasEmailInt && emailBody) {
    const leadEmailAddr = _extractEmail(lead.email)
    const htmlBody = `<div style="font-family:sans-serif;max-width:560px;color:#1e293b;line-height:1.6;font-size:14px;">
      ${emailBody.replace(/\n/g, '<br>')}
    </div>`
    try {
      const emailResult = await sendEmailAny({
        supabase, userId: user.id,
        to: leadEmailAddr,
        subject: emailSubject || `Premier contact — ${agencyName}`,
        html: htmlBody, text: emailBody,
        fallbackFrom: ws?.from_email || process.env.RESEND_FROM_EMAIL || 'contact@nexapro.tech',
        fallbackName:  tonPrenom || agencyName,
        resendKey:     ws?.resend_api_key || process.env.RESEND_API_KEY,
      })
      await supabase.from('conversations').insert({
        lead_id: lead.id, agency_id: profile.agency_id,
        channel: 'email', direction: 'outbound',
        subject: emailSubject, content: emailBody,
        html_content: htmlBody,
        from_email: emailResult?.email || 'contact@nexapro.tech',
        to_email: leadEmailAddr,
        status: 'sent', read_at: new Date().toISOString(),
        sender_name: `🤖 Agent IA · ${agencyName}`,
      }).catch(e => console.error('[crm/auto-contact] email conv error:', e))
      channels.push('email')
    } catch (e) {
      console.warn('[crm/auto-contact] email send failed:', e.message)
      // Ne pas bloquer si l'email échoue — WhatsApp peut être suffisant
    }
  }

  if (channels.length === 0)
    return res.status(503).json({ error: 'Aucun message envoyé — vérifiez Twilio (WhatsApp) ou votre intégration email' })

  // ── Logger + marquer lead ─────────────────────────────────────────────────
  const actionLabel = channels.length > 1 ? 'Premier contact WhatsApp + Email' : `Premier contact ${channels[0]}`
  try { await supabase.from('agent_actions').insert({
    lead_id: leadId, agency_id: profile.agency_id,
    agent_type: 'auto_contact', action: actionLabel,
    message_sent: waMessage || emailBody, status: 'sent',
  }) } catch {}
  await supabase.from('leads').update({ auto_contacted_at: new Date().toISOString() }).eq('id', leadId)

  return res.status(200).json({
    success: true,
    channels,
    message_sent: waMessage || emailBody,
    email_subject: emailSubject || null,
  })
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
  if (apptErr) throw Object.assign(new Error(`Création RDV: [${apptErr.code}] ${apptErr.message}`), { status: 400 })

  const dateStr    = formatDateFr(scheduledAt)
  const timeStr    = formatTimeFr(scheduledAt)
  const prenom     = (lead.nom || '').split(' ')[0] || lead.nom
  const agencyName = profile.nom_agence || profile.nom_complet || 'Notre équipe'

  try { await supabase.from('crm_events').insert({
    lead_id: lead.id, type: 'rdv', title: 'RDV créé',
    description: `${type} le ${dateStr} à ${timeStr}${notes ? ` — ${notes}` : ''}`,
  }) } catch {}

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
        try { await supabase.from('conversations').insert({
          lead_id: lead.id, agency_id: profile.agency_id,
          channel: 'whatsapp', direction: 'outbound',
          content: waMsg, status: 'sent', twilio_sid: waResult?.sid || null,
          sender_name: `📅 ${agencyName}`, thread_status: 'open', read_at: new Date().toISOString(),
        }) } catch {}
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
        try { await supabase.from('conversations').insert({
          lead_id: lead.id, agency_id: profile.agency_id,
          channel: 'email', direction: 'outbound',
          subject, content: `RDV confirmé : ${type} le ${dateStr} à ${timeStr}`,
          from_email: fromEmail, to_email: lead.email,
          sender_name: agencyName, status: 'sent', read_at: new Date().toISOString(),
        }) } catch {}
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
    try { await supabase.from('crm_events').insert({
      lead_id: doc.lead_id, agency_id: doc.agency_id, type: 'document',
      title: `📧 ${label} envoyé par email`,
      description: `${doc.reference || label} — Envoyé à ${doc.client_email} via ${sentResult.provider}`,
      statut: 'complété', created_at: new Date().toISOString(),
    }) } catch {}
  }

  return res.status(200).json({ ok: true, sentTo: doc.client_email, provider: sentResult.provider, mode: attachments.length ? 'PDF joint' : 'HTML inline' })
}

/* ── Action : fetch-email-inbox (Gmail API polling) ─────────────────────── */
async function handleFetchEmailInbox(req, res, supabase, user) {
  const { leadId } = req.body || {}
  if (!leadId) return res.status(400).json({ error: 'leadId requis' })

  const dbg = [] // journal de debug retourné au client

  const { data: profile } = await supabase.from('profiles')
    .select('agency_id').eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  const { data: lead } = await supabase.from('leads')
    .select('id, email, agency_id').eq('id', leadId).eq('agency_id', profile.agency_id).single()
  if (!lead?.email) return res.status(200).json({ fetched: 0, provider: null, debug: ['lead.email vide'] })

  const leadEmail = _extractEmail(lead.email)
  dbg.push(`leadEmail: ${leadEmail}`)
  if (!leadEmail.includes('@')) return res.status(200).json({ fetched: 0, provider: null, debug: [`email invalide: ${leadEmail}`] })

  // Récupérer l'intégration email active
  const { data: integrations, error: intErr } = await supabase.from('email_integrations')
    .select('provider,email,access_token,refresh_token,token_expires_at,smtp_host,smtp_port,smtp_user,smtp_password_enc,smtp_encryption')
    .eq('user_id', user.id).eq('is_active', true)

  dbg.push(`intégrations trouvées: ${integrations?.length ?? 0}${intErr ? ' ERR:'+intErr.message : ''}`)
  integrations?.forEach(i => dbg.push(`  → provider=${i.provider} email=${i.email}`))

  const googleInt = integrations?.find(i => i.provider === 'google')
  const smtpInt   = integrations?.find(i => i.provider === 'smtp' && i.smtp_host)

  let newCount = 0

  // ── Gmail polling ──────────────────────────────────────────
  if (googleInt?.access_token) {
    dbg.push('provider=google → démarrage Gmail poll')

    // Refresh proactif si expiré
    let token = googleInt.access_token
    if (googleInt.token_expires_at && new Date(googleInt.token_expires_at) < new Date(Date.now() + 60000)) {
      try { token = await _refreshGoogleToken(googleInt, supabase, user.id); dbg.push('token rafraîchi') }
      catch(e) { dbg.push(`refresh échoué: ${e.message}`) }
    }

    // Date il y a 30 jours au format YYYY/MM/DD (format supporté par Gmail)
    const sinceDate = new Date(Date.now() - 30*24*3600*1000)
    const sinceStr  = `${sinceDate.getFullYear()}/${String(sinceDate.getMonth()+1).padStart(2,'0')}/${String(sinceDate.getDate()).padStart(2,'0')}`
    const query     = encodeURIComponent(`(from:${leadEmail} OR to:${leadEmail}) after:${sinceStr}`)
    dbg.push(`Gmail query: (from:${leadEmail} OR to:${leadEmail}) after:${sinceStr}`)

    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const listStatus = listRes.status
    dbg.push(`Gmail list HTTP ${listStatus}`)

    if (!listRes.ok) {
      const errBody = await listRes.text()
      dbg.push(`Gmail list error: ${errBody.slice(0,200)}`)
      return res.status(200).json({ fetched: 0, provider: 'google', error: `Gmail list HTTP ${listStatus}`, debug: dbg })
    }

    const listData = await listRes.json()
    const messages = listData.messages || []
    dbg.push(`Gmail messages trouvés: ${messages.length} (resultSizeEstimate=${listData.resultSizeEstimate})`)

    // Récupérer les IDs déjà stockés pour éviter doublons
    const { data: existing, error: exErr } = await supabase.from('conversations')
      .select('gmail_message_id').eq('lead_id', leadId).eq('channel', 'email')
      .not('gmail_message_id', 'is', null)
    dbg.push(`existingIds en base: ${existing?.length ?? 0}${exErr ? ' ERR:'+exErr.message : ''}`)
    const existingIds = new Set((existing || []).map(e => e.gmail_message_id))

    for (const { id: gmailId } of messages) {
      if (existingIds.has(gmailId)) { dbg.push(`skip (déjà en base): ${gmailId}`); continue }
      try {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=full`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!msgRes.ok) { dbg.push(`skip msgGet HTTP ${msgRes.status}: ${gmailId}`); continue }
        const msg = await msgRes.json()

        const headers  = msg.payload?.headers || []
        const getH     = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
        const fromH    = getH('From')
        const toH      = getH('To')
        const subjectH = getH('Subject')
        const fromEmail = _extractEmail(fromH)
        const isInbound = fromEmail.toLowerCase() === leadEmail.toLowerCase()
        dbg.push(`msg ${gmailId}: from=${fromEmail} isInbound=${isInbound} subject="${subjectH?.slice(0,30)}"`)

        // Extraire le corps
        const getBody = (payload) => {
          if (!payload) return { html: '', text: '' }
          if (payload.body?.data) {
            const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8')
            return payload.mimeType === 'text/html' ? { html: decoded, text: '' } : { html: '', text: decoded }
          }
          if (payload.parts) {
            let html = '', text = ''
            for (const p of payload.parts) {
              if (p.mimeType === 'text/html' && p.body?.data) html = Buffer.from(p.body.data, 'base64').toString('utf-8')
              if (p.mimeType === 'text/plain' && p.body?.data) text = Buffer.from(p.body.data, 'base64').toString('utf-8')
              // multipart imbriqué
              if (p.parts) for (const pp of p.parts) {
                if (pp.mimeType === 'text/html' && pp.body?.data) html = Buffer.from(pp.body.data, 'base64').toString('utf-8')
                if (pp.mimeType === 'text/plain' && pp.body?.data && !text) text = Buffer.from(pp.body.data, 'base64').toString('utf-8')
              }
            }
            return { html, text }
          }
          return { html: '', text: '' }
        }
        const { html, text } = getBody(msg.payload)
        const cleanText = extractEmailText(html, text)
        const insertDate = new Date(Date.now() + newCount * 1000).toISOString()

        const { error: insErr } = await supabase.from('conversations').insert({
          lead_id: leadId, agency_id: profile.agency_id,
          channel: 'email', direction: isInbound ? 'inbound' : 'outbound',
          subject: subjectH, content: cleanText || '(corps vide)',
          html_content: html || null,
          from_email: fromEmail, to_email: _extractEmail(toH),
          sender_name: isInbound ? fromH : null,
          gmail_message_id: gmailId,
          status: 'delivered', created_at: insertDate,
          read_at: isInbound ? null : new Date().toISOString(),
        })

        if (insErr) {
          dbg.push(`INSERT FAILED ${gmailId}: [${insErr.code}] ${insErr.message}`)
          console.error('[fetch-email-inbox] INSERT FAILED:', insErr.code, insErr.message)
        } else {
          newCount++
          dbg.push(`INSERT OK ${gmailId} dir=${isInbound?'inbound':'outbound'}`)
        }
      } catch (e) {
        dbg.push(`exception ${gmailId}: ${e.message}`)
        console.warn('[fetch-email-inbox] msg error:', e.message)
      }
    }
    return res.status(200).json({ fetched: newCount, provider: 'google', debug: dbg })
  }

  // ── IMAP polling (SMTP) ────────────────────────────────────
  if (smtpInt) {
    const password = _decryptSmtpPwd(smtpInt.smtp_password_enc)
    if (!password) return res.status(200).json({ fetched: 0, provider: 'smtp', error: 'Impossible de déchiffrer le mot de passe', debug: dbg })

    const enc = smtpInt.smtp_encryption || 'tls'

    // Dériver le host IMAP depuis le host SMTP :
    // smtp.example.com  → imap.example.com
    // mail.example.com  → mail.example.com (inchangé)
    // smtp.gmail.com    → imap.gmail.com
    const smtpHost = smtpInt.smtp_host || ''
    const imapHost = smtpHost.startsWith('smtp.') ? smtpHost.replace(/^smtp\./, 'imap.') : smtpHost

    // Port IMAP : 993 (SSL/IMAPS) ou 143 (STARTTLS/plain)
    const imapPort   = enc === 'ssl' ? 993 : 143
    const imapSecure = enc === 'ssl'   // true = IMAPS directement, false = STARTTLS

    dbg.push(`IMAP host=${imapHost} port=${imapPort} secure=${imapSecure} user=${smtpInt.smtp_user}`)

    const client = new ImapFlow({
      host:   imapHost,
      port:   imapPort,
      secure: imapSecure,
      auth:   { user: smtpInt.smtp_user, pass: password },
      tls:    { rejectUnauthorized: false },
      logger: false,
    })

    try {
      await client.connect()
      dbg.push('IMAP connecté')

      const lock = await client.getMailboxLock('INBOX')
      let fetched = 0
      try {
        const since = new Date(Date.now() - 30*24*3600*1000)
        // Deux recherches séparées (from + to) car certains serveurs IMAP
        // ne supportent pas les critères OR combinés.
        // On enveloppe dans try/catch au cas où un critère serait rejeté.
        let uids  = []
        let uids2 = []
        try { uids  = await client.search({ since, from: leadEmail }, { uid: true }) } catch(e) { dbg.push(`search from err: ${e.message}`) }
        try { uids2 = await client.search({ since, to:   leadEmail }, { uid: true }) } catch(e) { dbg.push(`search to err: ${e.message}`) }
        const allUids = [...new Set([...(uids||[]), ...(uids2||[])])].slice(-20)
        dbg.push(`IMAP UIDs trouvés: from=${uids.length} to=${uids2.length} total=${allUids.length}`)

        // ⚠️ Un fetch vide est une commande IMAP invalide → "Command failed"
        if (allUids.length === 0) {
          dbg.push('Aucun UID → skip fetch')
        } else {
          const { data: existing } = await supabase.from('conversations')
            .select('imap_uid').eq('lead_id', leadId).eq('channel', 'email').not('imap_uid', 'is', null)
          const existingUids = new Set((existing || []).map(e => String(e.imap_uid)))

          // ⚠️ 3ème argument { uid: true } indispensable : dit à ImapFlow que allUids
          //    contient des UIDs (retournés par client.search) et NON des numéros de séquence.
          //    Sans ça, les UIDs (ex: 54321) sont interprétés comme séquence → "Command failed"
          //    si la boîte a moins de messages que le UID le plus grand.
          for await (const msg of client.fetch(allUids, { source: true, uid: true }, { uid: true })) {
            if (existingUids.has(String(msg.uid))) { dbg.push(`skip UID ${msg.uid} (déjà en base)`); continue }
            try {
              const parsed      = await simpleParser(msg.source)
              const fromEmail   = parsed.from?.value?.[0]?.address || ''
              const isInbound   = fromEmail.toLowerCase() === leadEmail.toLowerCase()
              const cleanText   = extractEmailText(parsed.html || '', parsed.text || '')
              const insertDate  = new Date(Date.now() + fetched * 1000).toISOString()

              const { error: insErr } = await supabase.from('conversations').insert({
                lead_id: leadId, agency_id: profile.agency_id,
                channel: 'email', direction: isInbound ? 'inbound' : 'outbound',
                subject: parsed.subject || '(sans objet)', content: cleanText || '(corps vide)',
                html_content: parsed.html || null,
                from_email: fromEmail, to_email: parsed.to?.value?.[0]?.address || '',
                sender_name: isInbound ? parsed.from?.text : null,
                imap_uid: msg.uid,
                status: 'delivered', created_at: insertDate,
                read_at: isInbound ? null : new Date().toISOString(),
              })

              if (insErr) {
                dbg.push(`INSERT FAILED UID ${msg.uid}: [${insErr.code}] ${insErr.message}`)
                console.error('[fetch-email-inbox/imap] INSERT FAILED:', insErr.code, insErr.message)
                // Fallback sans colonnes optionnelles si erreur de colonne manquante
                if (insErr.code === '42703' || insErr.message?.includes('column')) {
                  const { error: ins2 } = await supabase.from('conversations').insert({
                    lead_id: leadId, agency_id: profile.agency_id,
                    channel: 'email', direction: isInbound ? 'inbound' : 'outbound',
                    content: `[${parsed.subject || '(sans objet)'}] ${cleanText}`,
                    sender_name: isInbound ? parsed.from?.text : null,
                    status: 'delivered', created_at: insertDate,
                    read_at: isInbound ? null : new Date().toISOString(),
                  })
                  if (!ins2) { fetched++; dbg.push(`INSERT fallback OK UID ${msg.uid}`) }
                }
              } else {
                fetched++
                dbg.push(`INSERT OK UID ${msg.uid} dir=${isInbound ? 'inbound' : 'outbound'}`)
              }
            } catch (e) {
              dbg.push(`parse error UID ${msg.uid}: ${e.message}`)
              console.warn('[fetch-email-inbox/imap] parse error:', e.message)
            }
          }
        }
        newCount = fetched
      } finally { lock.release() }

      await client.logout()
    } catch (e) {
      dbg.push(`IMAP erreur: ${e.message}`)
      console.error('[fetch-email-inbox/imap] connect/search error:', e.message)
      return res.status(200).json({ fetched: 0, provider: 'smtp', error: e.message, debug: dbg })
    }
    return res.status(200).json({ fetched: newCount, provider: 'smtp', debug: dbg })
  }

  return res.status(200).json({ fetched: 0, provider: null })
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

/* ── Action : send-invitation ───────────────────────────────────────────────── */
async function handleSendInvitation(req, res, supabase, user) {
  const { agency_id, invite_email, role = 'agent', agency_name: agencyNameFromFrontend = '', inviter_name: inviterNameFromFrontend = '' } = req.body || {}
  if (!agency_id || !invite_email) return res.status(400).json({ error: 'agency_id et invite_email requis' })

  const normalizedEmail = invite_email.trim().toLowerCase()

  // Vérifier que l'utilisateur appartient bien à cette agence + récupérer son profil
  const { data: profile } = await supabase.from('profiles')
    .select('agency_id, nom_complet, nom_agence').eq('user_id', user.id).single()
  if (profile?.agency_id !== agency_id) return res.status(403).json({ error: 'Accès refusé' })

  // Nom d'agence réel — priorité : profil DB > ce que le frontend a envoyé
  // Si le profil ne l'a pas, chercher le propriétaire de l'agence
  let agency_name = profile?.nom_agence || agencyNameFromFrontend || ''
  if (!agency_name) {
    const { data: ownerProfile } = await supabase.from('profiles')
      .select('nom_agence, nom_complet').eq('agency_id', agency_id).eq('role', 'owner').maybeSingle()
    agency_name = ownerProfile?.nom_agence || ownerProfile?.nom_complet || agencyNameFromFrontend || 'votre agence'
  }

  // Nom de l'expéditeur — profil courant ou ce que le frontend a envoyé
  const inviter_name = profile?.nom_complet || inviterNameFromFrontend || ''

  // Créer ou renouveler l'invitation
  const { data: existing } = await supabase.from('agency_invitations')
    .select('id').eq('agency_id', agency_id).eq('email', normalizedEmail).eq('status', 'pending').maybeSingle()

  let token, isRefresh = false
  const newToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  if (existing) {
    await supabase.from('agency_invitations').update({
      token: newToken, role, invited_by: user.id, expires_at: expiresAt,
    }).eq('id', existing.id)
    token = newToken; isRefresh = true
  } else {
    const { data: inv, error: invErr } = await supabase.from('agency_invitations').insert({
      agency_id, invited_by: user.id, email: normalizedEmail,
      role, status: 'pending', expires_at: expiresAt, token: newToken,
    }).select('token').single()
    if (invErr) throw Object.assign(new Error(`Création invitation: [${invErr.code}] ${invErr.message}`), { status: 400 })
    token = inv.token
  }

  const appUrl     = process.env.APP_URL || process.env.VITE_APP_URL || 'https://www.leadqualif.com'
  const inviteLink = `${appUrl}/join/${token}`

  // Envoyer l'email si Resend disponible
  const { data: ws } = await supabase.from('workspace_settings')
    .select('resend_api_key, from_email, from_name').eq('agency_id', agency_id).maybeSingle()
  const resendKey = ws?.resend_api_key || process.env.RESEND_API_KEY
  const fromEmail = ws?.from_email     || process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
  const fromName  = ws?.from_name      || agency_name

  const roleLabels = { owner: 'Propriétaire', admin: 'Admin', agent: 'Agent', viewer: 'Lecture seule' }
  const roleLabel  = roleLabels[role] || 'Agent'

  const html = `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1e293b;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">👥</div>
      <h1 style="margin:0;color:#fff;font-size:20px;">Invitation à rejoindre l'équipe</h1>
      <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">${agency_name}</p>
    </div>
    <div style="background:#fff;padding:32px 40px;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;"><strong>${inviter_name || agency_name}</strong> vous invite à rejoindre <strong>${agency_name}</strong> en tant que <strong>${roleLabel}</strong>.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${inviteLink}" style="display:inline-block;padding:13px 32px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">👥 Rejoindre ${agency_name} →</a>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-size:13px;color:#64748b;">
        <strong>ℹ️</strong> Ce lien est valable <strong>7 jours</strong> · Rôle : <strong>${roleLabel}</strong>
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">Si le bouton ne fonctionne pas : <a href="${inviteLink}" style="color:#4f46e5;word-break:break-all;">${inviteLink}</a></p>
    </div>
  </div>`

  let emailSent = false
  if (resendKey) {
    try {
      const r = await sendResendEmail(normalizedEmail, `👥 ${inviter_name || agency_name} vous invite à rejoindre ${agency_name}`, html, `Lien d'invitation : ${inviteLink}`, fromEmail, resendKey, fromName)
      emailSent = !!r?.id
    } catch (e) { console.warn('[send-invitation] email failed:', e.message) }
  }

  return res.status(200).json({ success: true, token, invite_link: inviteLink, is_refresh: isRefresh, email_sent: emailSent })
}

  const { action } = req.body || {}

  try {
    if (action === 'auto-contact')        return await handleAutoContact(req, res, supabase, user)
    if (action === 'create-appointment')  return await handleCreateAppointment(req, res, supabase, user)
    if (action === 'send-email')           return await handleSendEmail(req, res, supabase, user)
    if (action === 'send-whatsapp')        return await handleSendWhatsapp(req, res, supabase, user)
    if (action === 'send-document-email') return await handleSendDocumentEmail(req, res, supabase, user)
    if (action === 'fetch-email-inbox')   return await handleFetchEmailInbox(req, res, supabase, user)
    if (action === 'send-invitation')     return await handleSendInvitation(req, res, supabase, user)
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[crm/${action}] Erreur:`, err)
    const status = err.status || 500
    return res.status(status).json({ error: err.message || 'Erreur serveur' })
  }
}
