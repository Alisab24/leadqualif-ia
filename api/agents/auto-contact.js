/**
 * Vercel Serverless Function — POST /api/agents/auto-contact
 *
 * Agent IA Auto-Contact : génère et envoie un premier message WhatsApp
 * personnalisé à un lead chaud via Claude API + Twilio.
 *
 * Body attendu :
 *   { leadId: string }
 *
 * Headers requis :
 *   Authorization: Bearer <supabase_access_token>
 *
 * Variables Vercel requises :
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL  (ou VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_KEY  (ou SUPABASE_SERVICE_ROLE_KEY)
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER (fallback)
 *
 * Limites :
 *   - Maximum 1 auto-contact par lead (do_not_duplicate)
 *   - Skip si lead.do_not_contact = true
 *   - Skip si lead.agent_ia_enabled = false
 *   - Skip si agency agent_ia_enabled = false
 *   - Rate-limit : 20 messages auto par agence par heure
 */

import { createClient } from '@supabase/supabase-js'

// ── Génération du message via Claude API ──────────────────────────────────────
async function generateMessage(lead, agencyName) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant')

  // Détecter le secteur
  const secteur = (
    lead.secteur_activite ||
    lead.type_service ||
    lead.secteur ||
    ''
  ).toLowerCase()

  let contexte = ''
  if (secteur.includes('smma') || secteur.includes('marketing') || secteur.includes('agence')) {
    contexte = `Le lead travaille dans le secteur SMMA/Marketing. Axe le message sur : générer des leads qualifiés pour leurs clients, automatiser leur prospection, et augmenter leur ROI publicité.`
  } else if (
    secteur.includes('immo') ||
    secteur.includes('immobilier') ||
    secteur.includes('bien') ||
    secteur.includes('achat') ||
    secteur.includes('vente')
  ) {
    contexte = `Le lead est dans l'immobilier. Axe le message sur : trouver des propriétaires et acheteurs qualifiés dans leur zone, automatiser leur qualification de prospects.`
  } else {
    contexte = `Secteur inconnu. Utilise un message générique sur : automatiser la qualification des leads et gagner du temps dans la prospection.`
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
- Ne dis pas "je vous contacte" ou "suite à votre inscription" de façon générique

Contexte : ${contexte}

Informations du lead :
- Nom : ${lead.nom || 'le contact'}
- Secteur : ${lead.secteur_activite || lead.type_service || lead.secteur || 'non précisé'}
- Source : ${lead.source || 'non précisée'}
- Score qualification : ${lead.score_ia || lead.score || 0}%

Génère UNIQUEMENT le message WhatsApp, sans guillemets ni préambule.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API ${res.status}: ${err}`)
  }

  const data = await res.json()
  return (data.content?.[0]?.text || '').trim()
}

// ── Envoi via Twilio (sans SDK) ───────────────────────────────────────────────
async function sendTwilioMessage(from, to, body, accountSid, authToken) {
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
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
  return data
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

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuration Supabase manquante' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  // ── Body ──────────────────────────────────────────────────────────────────
  const { leadId } = req.body || {}
  if (!leadId) return res.status(400).json({ error: 'leadId requis' })

  try {
    // ── 1. Profil utilisateur ─────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, nom_complet, nom_agence')
      .eq('user_id', user.id)
      .single()

    if (!profile?.agency_id) {
      return res.status(403).json({ error: 'Agence introuvable' })
    }

    const agencyId   = profile.agency_id
    const agencyName = profile.nom_agence || profile.nom_complet || 'LeadQualif'

    // ── 2. Vérifier config agent de l'agence ─────────────────────────────
    const { data: agencySettings } = await supabase
      .from('agency_settings')
      .select('agent_ia_enabled, agent_ia_delay_minutes, agent_smma_template, agent_immo_template, agent_default_template, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
      .eq('agency_id', agencyId)
      .maybeSingle()

    if (agencySettings?.agent_ia_enabled === false) {
      return res.status(200).json({ skipped: true, reason: 'Agent IA désactivé pour cette agence' })
    }

    // ── 3. Récupérer le lead ──────────────────────────────────────────────
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, nom, telephone, agency_id, score_ia, score, statut, statut_crm, secteur, secteur_activite, type_service, source, do_not_contact, auto_contacted_at, agent_ia_enabled')
      .eq('id', leadId)
      .eq('agency_id', agencyId)
      .single()

    if (leadErr || !lead) {
      return res.status(404).json({ error: 'Lead introuvable' })
    }

    // ── 4. Vérifications de sécurité ──────────────────────────────────────
    if (lead.do_not_contact) {
      await logAction(supabase, leadId, agencyId, 'skipped', null, null, 'do_not_contact = true')
      return res.status(200).json({ skipped: true, reason: 'Lead marqué "Ne pas contacter"' })
    }

    if (lead.agent_ia_enabled === false) {
      await logAction(supabase, leadId, agencyId, 'skipped', null, null, 'Agent désactivé pour ce lead')
      return res.status(200).json({ skipped: true, reason: 'Agent IA désactivé pour ce lead' })
    }

    if (lead.auto_contacted_at) {
      return res.status(200).json({ skipped: true, reason: 'Lead déjà contacté automatiquement' })
    }

    if (!lead.telephone) {
      await logAction(supabase, leadId, agencyId, 'failed', null, null, 'Pas de numéro de téléphone')
      return res.status(200).json({ skipped: true, reason: 'Lead sans numéro de téléphone' })
    }

    // ── 5. Rate-limit : max 20 messages auto / agence / heure ────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('agent_actions')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'sent')
      .gte('created_at', oneHourAgo)

    if ((recentCount || 0) >= 20) {
      return res.status(429).json({ error: 'Rate limit atteint (20 messages/heure max)' })
    }

    // ── 6. Générer le message ─────────────────────────────────────────────
    let message = ''

    // Utiliser template custom si défini
    const secteur = (lead.secteur_activite || lead.type_service || lead.secteur || '').toLowerCase()
    const isSmma  = secteur.includes('smma') || secteur.includes('marketing') || secteur.includes('agence')
    const isImmo  = secteur.includes('immo') || secteur.includes('bien') || secteur.includes('achat')

    let customTemplate = agencySettings?.agent_default_template || null
    if (isSmma && agencySettings?.agent_smma_template) customTemplate = agencySettings.agent_smma_template
    if (isImmo && agencySettings?.agent_immo_template) customTemplate = agencySettings.agent_immo_template

    if (customTemplate) {
      // Interpoler les variables dans le template
      const prenom = (lead.nom || '').split(' ')[0] || lead.nom || 'vous'
      message = customTemplate
        .replace(/\{\{nom\}\}/gi,    lead.nom || 'vous')
        .replace(/\{\{prenom\}\}/gi, prenom)
        .replace(/\{\{agence\}\}/gi, agencyName)
        .replace(/\{\{secteur\}\}/gi, lead.secteur_activite || lead.secteur || '')
    } else {
      // Générer via Claude
      message = await generateMessage(lead, agencyName)
    }

    if (!message) throw new Error('Message généré vide')

    // ── 7. Credentials Twilio ─────────────────────────────────────────────
    const accountSid = agencySettings?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID
    const authToken  = agencySettings?.twilio_auth_token  || process.env.TWILIO_AUTH_TOKEN
    const fromNumber = agencySettings?.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      await logAction(supabase, leadId, agencyId, 'failed', 'Envoi WhatsApp', message, 'Twilio non configuré')
      return res.status(503).json({ error: 'Twilio non configuré' })
    }

    // ── 8. Normaliser le numéro ───────────────────────────────────────────
    const toNumber = lead.telephone.startsWith('+')
      ? lead.telephone
      : '+' + lead.telephone.replace(/^00/, '')

    // ── 9. Envoyer via Twilio ─────────────────────────────────────────────
    console.log(`[auto-contact] → ${toNumber} : "${message.slice(0, 60)}..."`)
    const twilioResult = await sendTwilioMessage(fromNumber, toNumber, message, accountSid, authToken)

    // ── 10. Stocker dans conversations ────────────────────────────────────
    const senderName = `🤖 Agent IA · ${agencyName}`
    const { error: convErr } = await supabase
      .from('conversations')
      .insert({
        lead_id:       lead.id,
        agency_id:     agencyId,
        channel:       'whatsapp',
        direction:     'outbound',
        from_number:   fromNumber.replace(/^whatsapp:/i, ''),
        to_number:     toNumber,
        content:       message,
        status:        ['sent','delivered','read','failed'].includes(twilioResult.status) ? twilioResult.status : 'sent',
        twilio_sid:    twilioResult.sid || null,
        read_at:       new Date().toISOString(),
        sender_name:   senderName,
        thread_status: 'open',
      })

    if (convErr) console.error('[auto-contact] Erreur insert conversation:', convErr)

    // ── 11. Logger l'action ───────────────────────────────────────────────
    await logAction(supabase, leadId, agencyId, 'sent', 'Premier contact WhatsApp', message, null)

    // ── 12. Marquer le lead comme auto-contacté ───────────────────────────
    await supabase
      .from('leads')
      .update({ auto_contacted_at: new Date().toISOString() })
      .eq('id', leadId)

    return res.status(200).json({
      success:    true,
      message_sent: message,
      twilio_sid: twilioResult.sid,
    })

  } catch (err) {
    console.error('[auto-contact] Erreur:', err)
    // Logger l'échec si possible
    try {
      const { data: profile } = await supabase
        .from('profiles').select('agency_id').eq('user_id', user.id).single()
      if (profile?.agency_id) {
        await logAction(supabase, leadId, profile.agency_id, 'failed', null, null, err.message)
      }
    } catch (_) {}

    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}

// ── Helper : insérer un log agent_actions ────────────────────────────────────
async function logAction(supabase, leadId, agencyId, status, action, message, error) {
  try {
    await supabase.from('agent_actions').insert({
      lead_id:      leadId,
      agency_id:    agencyId,
      agent_type:   'auto_contact',
      action:       action || 'Premier contact WhatsApp',
      message_sent: message,
      status,
      error_msg:    error || null,
    })
  } catch (e) {
    console.error('[auto-contact] Erreur logAction:', e)
  }
}
