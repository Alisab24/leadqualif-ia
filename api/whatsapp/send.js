/**
 * Vercel Serverless Function — POST /api/whatsapp/send
 *
 * Envoie un message WhatsApp sortant via Twilio et le stocke en base.
 *
 * Body attendu :
 *   { leadId: string, message: string }
 *
 * Headers requis :
 *   Authorization: Bearer <supabase_access_token>
 *
 * Variables Vercel requises :
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_NUMBER  — ex: whatsapp:+14155238886
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

// ── Envoyer via l'API REST Twilio (sans SDK) ──────────────────────────────────
async function sendTwilioMessage(from, to, body, accountSid, authToken) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const formBody = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
    Body: body,
  })

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${data.message || JSON.stringify(data)}`)
  }
  return data // { sid, status, ... }
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  // ── Auth : vérifier le JWT Supabase ──────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('[whatsapp/send] SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant')
    return res.status(500).json({ error: 'Configuration serveur manquante (Supabase)' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Vérifier le token utilisateur
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  // ── Lire le body ──────────────────────────────────────────────────────────
  const { leadId, message } = req.body || {}
  if (!leadId || !message?.trim()) {
    return res.status(400).json({ error: 'leadId et message requis' })
  }

  try {
    // ── 1. Récupérer le profil de l'utilisateur (agency_id) ────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, nom_complet, nom_agence')
      .eq('user_id', user.id)
      .single()

    if (!profile?.agency_id) {
      return res.status(403).json({ error: 'Agence introuvable' })
    }

    // ── 2. Récupérer le lead (vérifier qu'il appartient à l'agence) ────────
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, nom, telephone, agency_id')
      .eq('id', leadId)
      .eq('agency_id', profile.agency_id)
      .single()

    if (leadErr || !lead) {
      return res.status(404).json({ error: 'Lead introuvable' })
    }
    if (!lead.telephone) {
      return res.status(400).json({ error: 'Ce lead n\'a pas de numéro de téléphone' })
    }

    // ── 3. Récupérer les credentials Twilio ────────────────────────────────
    // Priorité : agency_settings > variables d'environnement globales
    const { data: agencySettings } = await supabase
      .from('agency_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
      .eq('agency_id', profile.agency_id)
      .maybeSingle()

    const accountSid     = agencySettings?.twilio_account_sid     || process.env.TWILIO_ACCOUNT_SID
    const authToken      = agencySettings?.twilio_auth_token      || process.env.TWILIO_AUTH_TOKEN
    const fromNumber     = agencySettings?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(503).json({ error: 'Twilio non configuré — ajoutez les credentials dans Paramètres' })
    }

    // ── 4. Normaliser le numéro destinataire ──────────────────────────────
    const toNumber = lead.telephone.startsWith('+')
      ? lead.telephone
      : '+' + lead.telephone.replace(/^00/, '')

    // ── 5. Envoyer via Twilio ─────────────────────────────────────────────
    console.log(`[whatsapp/send] → ${toNumber} : "${message.slice(0, 50)}..."`)
    const twilioResult = await sendTwilioMessage(fromNumber, toNumber, message.trim(), accountSid, authToken)

    // ── 6. Stocker le message sortant dans conversations ──────────────────
    const senderName = profile.nom_complet || profile.nom_agence || 'Agent'

    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        lead_id:       lead.id,
        agency_id:     profile.agency_id,
        channel:       'whatsapp',
        direction:     'outbound',
        from_number:   fromNumber.replace(/^whatsapp:/i, ''),
        to_number:     toNumber,
        content:       message.trim(),
        status:        twilioResult.status || 'sent',
        twilio_sid:    twilioResult.sid || null,
        read_at:       new Date().toISOString(),
        sender_name:   senderName,
        thread_status: 'open',
      })
      .select()
      .single()

    if (convErr) console.error('[whatsapp/send] Erreur insert:', convErr)

    return res.status(200).json({
      success:    true,
      message_id: conv?.id,
      twilio_sid: twilioResult.sid,
      status:     twilioResult.status,
    })

  } catch (err) {
    console.error('[whatsapp/send] Erreur:', err)
    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}
