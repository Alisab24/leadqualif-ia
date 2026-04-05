/**
 * Vercel Serverless Function — POST /api/webhooks/whatsapp
 *
 * Reçoit les messages WhatsApp entrants via Twilio.
 * Identifie ou crée le lead, stocke le message dans `conversations`.
 *
 * ⚠️  Désactiver le body parser : Twilio envoie en application/x-www-form-urlencoded
 *     et la validation de signature nécessite le body brut trié.
 *
 * Variables Vercel requises :
 *   TWILIO_AUTH_TOKEN          — pour valider la signature
 *   TWILIO_WHATSAPP_NUMBER     — ex: whatsapp:+14155238886
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Vercel doit recevoir le body brut pour la validation de signature Twilio
export const config = {
  api: { bodyParser: false },
}

// ── Lire le body brut ─────────────────────────────────────────────────────────
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Parser application/x-www-form-urlencoded ──────────────────────────────────
function parseFormBody(raw) {
  const params = {}
  for (const pair of raw.toString().split('&')) {
    const [k, v] = pair.split('=').map(decodeURIComponent)
    if (k) params[k] = v || ''
  }
  return params
}

// ── Valider la signature Twilio (HMAC-SHA1) ───────────────────────────────────
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
function validateTwilioSignature(authToken, twilioSig, url, params) {
  if (!authToken || !twilioSig) return false
  // Construire la chaîne : URL + params triés alphabétiquement
  const sortedKeys = Object.keys(params).sort()
  let str = url
  for (const key of sortedKeys) str += key + (params[key] ?? '')
  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(str, 'utf-8'))
    .digest('base64')
  // Comparaison en temps constant pour éviter timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(twilioSig)
    )
  } catch { return false }
}

// ── Normaliser un numéro WhatsApp → format E.164 ──────────────────────────────
function normalizeNumber(n) {
  if (!n) return null
  // Twilio préfixe avec "whatsapp:" → retirer
  const clean = n.replace(/^whatsapp:/i, '').trim()
  return clean.startsWith('+') ? clean : '+' + clean
}

// ── Réponse TwiML vide (pas d'auto-reply) ─────────────────────────────────────
function twimlResponse(res, status = 200) {
  res.setHeader('Content-Type', 'text/xml')
  return res.status(status).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS (Twilio n'en a pas besoin, mais pour les tests)
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)
  const params  = parseFormBody(rawBody)

  // ── Validation signature Twilio ──────────────────────────────────────────
  const authToken   = process.env.TWILIO_AUTH_TOKEN
  const twilioSig   = req.headers['x-twilio-signature'] || ''
  // Reconstruire l'URL complète (Vercel fournit x-forwarded-host)
  const host        = req.headers['x-forwarded-host'] || req.headers.host || ''
  const proto       = req.headers['x-forwarded-proto'] || 'https'
  const webhookUrl  = `${proto}://${host}/api/webhooks/whatsapp`

  // En développement, skip la validation (pas de signature réelle)
  const isDev = process.env.NODE_ENV === 'development' || !authToken
  if (!isDev && !validateTwilioSignature(authToken, twilioSig, webhookUrl, params)) {
    console.error('[whatsapp/webhook] Signature Twilio invalide')
    return res.status(403).json({ error: 'Signature invalide' })
  }

  // ── Extraire les champs du message Twilio ────────────────────────────────
  const {
    From,           // whatsapp:+33612345678
    To,             // whatsapp:+14155238886
    Body,           // contenu du message
    MessageSid,     // SID Twilio unique
    NumMedia,       // nombre de médias joints
    MediaUrl0,      // URL du 1er média (si présent)
  } = params

  if (!From || !Body) {
    console.error('[whatsapp/webhook] Payload incomplet:', params)
    return twimlResponse(res)
  }

  const fromNumber = normalizeNumber(From)
  const toNumber   = normalizeNumber(To)
  const content    = NumMedia > '0' && MediaUrl0
    ? `[Média] ${MediaUrl0}${Body ? '\n' + Body : ''}`
    : Body

  console.log(`[whatsapp/webhook] Message de ${fromNumber}: "${content.slice(0, 50)}"`)

  // ── Supabase (service role pour bypass RLS) ──────────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // ── 1. Trouver le lead par numéro de téléphone ─────────────────────────
    let lead = null
    let agencyId = null

    // Chercher dans tous les formats possibles : +33612..., 0612..., 33612...
    const { data: leads } = await supabase
      .from('leads')
      .select('id, nom, agency_id, telephone')
      .or(`telephone.eq.${fromNumber},telephone.eq.${fromNumber.replace('+', '')},telephone.eq.0${fromNumber.slice(3)}`)
      .limit(1)

    if (leads && leads.length > 0) {
      lead     = leads[0]
      agencyId = lead.agency_id
      console.log(`[whatsapp/webhook] Lead trouvé: ${lead.nom} (${lead.id})`)
    } else {
      // ── 2. Lead inconnu → identifier l'agence via le numéro Twilio ────────
      // Chercher l'agence qui possède ce numéro Twilio dans agency_settings
      const { data: settings } = await supabase
        .from('agency_settings')
        .select('agency_id')
        .eq('twilio_whatsapp_number', toNumber)
        .limit(1)

      if (settings && settings.length > 0) {
        agencyId = settings[0].agency_id
      } else {
        // Fallback : pas d'agence identifiable, on ignore silencieusement
        console.warn('[whatsapp/webhook] Aucune agence pour le numéro', toNumber)
        return twimlResponse(res)
      }

      // ── 3. Créer un lead "Entrant" automatiquement ─────────────────────
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          nom:        `Contact WhatsApp ${fromNumber}`,
          telephone:  fromNumber,
          agency_id:  agencyId,
          source:     'whatsapp_inbound',
          statut:     'Nouveau',
          message:    content.slice(0, 500),
        })
        .select()
        .single()

      if (leadErr) {
        console.error('[whatsapp/webhook] Erreur création lead:', leadErr)
      } else {
        lead = newLead
        console.log(`[whatsapp/webhook] Nouveau lead créé: ${lead.id}`)
      }
    }

    // ── 4. Stocker le message dans conversations ───────────────────────────
    const { error: convErr } = await supabase
      .from('conversations')
      .insert({
        lead_id:     lead?.id || null,
        agency_id:   agencyId,
        channel:     'whatsapp',
        direction:   'inbound',
        from_number: fromNumber,
        to_number:   toNumber,
        content,
        status:      'delivered',
        twilio_sid:  MessageSid || null,
        // Pas de read_at : message non lu
      })

    if (convErr) {
      // Si duplicate (twilio_sid déjà vu), ignorer silencieusement
      if (convErr.code === '23505') {
        console.warn('[whatsapp/webhook] Message déjà reçu (duplicate SID)')
        return twimlResponse(res)
      }
      console.error('[whatsapp/webhook] Erreur insert conversation:', convErr)
    } else {
      console.log(`[whatsapp/webhook] Message stocké — lead:${lead?.id}`)
    }

    // Supabase Realtime se déclenche automatiquement via la subscription
    return twimlResponse(res)

  } catch (err) {
    console.error('[whatsapp/webhook] Erreur:', err)
    // Toujours répondre 200 à Twilio pour éviter les retries
    return twimlResponse(res)
  }
}
