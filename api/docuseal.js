/**
 * POST /api/docuseal
 * Intégration DocuSeal Cloud — signature électronique de documents.
 *
 * Actions :
 *   send-for-signature  { documentId }           → crée submission DocuSeal + envoie lien de signature
 *   check-status        { documentId }           → vérifie le statut depuis DocuSeal
 *   webhook             (POST from DocuSeal)      → met à jour le statut après signature
 *
 * Config requise (NexaPro uniquement, variable Vercel) :
 *   DOCUSEAL_API_KEY    — clé API DocuSeal globale (les clients ne configurent rien)
 *                         Self-hosted : token généré dans l'admin DocuSeal
 *                         Cloud       : https://app.docuseal.com/api
 *
 * Table documents (colonnes supplémentaires nécessaires) :
 *   docuseal_submission_id  TEXT
 *   docuseal_slug           TEXT
 *   signature_status        TEXT  ('pending'|'awaiting'|'completed'|'expired')
 *   signature_url           TEXT  (lien de signature pour le signataire)
 *   signed_at               TIMESTAMPTZ
 */

import { createClient } from '@supabase/supabase-js'

// Self-hosted : DOCUSEAL_BASE_URL = https://sign.tondomaine.com
// Cloud       : laisser vide → utilise api.docuseal.com par défaut
const DOCUSEAL_BASE = (process.env.DOCUSEAL_BASE_URL || 'https://api.docuseal.com').replace(/\/$/, '')

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  )
}

// ── Appel API DocuSeal ────────────────────────────────────────────────────────
async function docusealFetch(path, method = 'GET', body = null, apiKey) {
  const opts = {
    method,
    headers: { 'X-Auth-Token': apiKey, 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${DOCUSEAL_BASE}${path}`, opts)
  const data = await r.json()
  if (!r.ok) throw Object.assign(new Error(data.error || `DocuSeal ${r.status}`), { status: r.status })
  return data
}

// ── Construire le HTML du document à partir du contenu stocké ────────────────
function buildDocumentHtml(doc) {
  // Le document a un champ `html_content` ou `contenu` (selon le générateur)
  const body = doc.html_content || doc.contenu || ''
  const title = doc.titre || doc.reference || 'Document'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; margin: 40px; line-height: 1.5; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  .signature-section { margin-top: 48px; display: flex; justify-content: space-between; gap: 32px; border-top: 1px solid #e5e7eb; padding-top: 24px; }
  .signature-block { flex: 1; }
  .signature-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .signature-field { border-bottom: 1px solid #9ca3af; height: 48px; margin-bottom: 8px; }
  .signature-date  { font-size: 10px; color: #9ca3af; }
</style>
</head>
<body>
${body}
<div class="signature-section">
  <div class="signature-block">
    <div class="signature-label">Signature du client</div>
    <div class="signature-field"></div>
    <div class="signature-date">Date : ____________________</div>
  </div>
  <div class="signature-block">
    <div class="signature-label">Signature émetteur</div>
    <div class="signature-field"></div>
    <div class="signature-date">Date : ____________________</div>
  </div>
</div>
</body>
</html>`
}

// ── Action : envoyer pour signature ──────────────────────────────────────────
async function handleSendForSignature(req, res, supabase, user) {
  const { documentId } = req.body || {}
  if (!documentId) return res.status(400).json({ error: 'documentId requis' })

  // Profil
  const { data: profile } = await supabase.from('profiles')
    .select('agency_id, nom_complet, nom_agence, email')
    .eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  // Clé DocuSeal — globale NexaPro (variable Vercel), les clients ne configurent rien
  const apiKey = process.env.DOCUSEAL_API_KEY
  if (!apiKey) return res.status(422).json({ error: 'Service de signature temporairement indisponible.' })

  // Document
  const { data: doc } = await supabase.from('documents')
    .select('*').eq('id', documentId).eq('agency_id', profile.agency_id).single()
  if (!doc) return res.status(404).json({ error: 'Document introuvable' })
  if (!doc.client_email && !doc.email_destinataire) {
    return res.status(400).json({ error: 'Le document n\'a pas d\'email client pour la signature.' })
  }

  const signerEmail = doc.client_email || doc.email_destinataire
  const signerName  = doc.client_nom   || doc.destinataire_nom || 'Client'
  const agencyName  = profile.nom_agence || profile.nom_complet || 'L\'agence'
  const docTitle    = doc.titre || doc.reference || 'Document à signer'

  // 1. Créer un template HTML dans DocuSeal
  const htmlContent = buildDocumentHtml(doc)
  const template = await docusealFetch('/templates/html', 'POST', {
    html:   htmlContent,
    name:   docTitle,
    fields: [
      { name: 'Signature Client', role: 'Signer',   type: 'signature' },
      { name: 'Date Client',      role: 'Signer',   type: 'date'      },
      { name: 'Signature Agence', role: 'Approver', type: 'signature' },
      { name: 'Date Agence',      role: 'Approver', type: 'date'      },
    ],
  }, apiKey)

  if (!template?.id) return res.status(500).json({ error: 'Création du template DocuSeal échouée' })

  // 2. Créer la soumission (envoi au signataire)
  const submission = await docusealFetch('/submissions', 'POST', {
    template_id: template.id,
    send_email:  true,
    submitters:  [
      {
        role:  'Signer',
        email: signerEmail,
        name:  signerName,
        fields: [{ name: 'Signature Client' }, { name: 'Date Client' }],
        message: {
          subject: `${docTitle} — Signature requise`,
          body:    `Bonjour ${signerName},\n\nVeuillez signer le document "${docTitle}" envoyé par ${agencyName}.\n\nCliquez sur le lien ci-dessous pour signer en ligne.\n\nCordialement,\n${agencyName}`,
        },
      },
      {
        role:  'Approver',
        email: profile.email || 'contact@nexapro.tech',
        name:  agencyName,
        fields: [{ name: 'Signature Agence' }, { name: 'Date Agence' }],
      },
    ],
  }, apiKey)

  if (!submission?.id) return res.status(500).json({ error: 'Création de la soumission DocuSeal échouée' })

  // Lien de signature du client (premier submitter)
  const signerSlug    = submission.submitters?.[0]?.slug || null
  const signerUrl     = signerSlug ? `https://docuseal.com/s/${signerSlug}` : null

  // 3. Mettre à jour le document en base
  await supabase.from('documents').update({
    docuseal_submission_id: String(submission.id),
    docuseal_slug:          signerSlug,
    signature_status:       'awaiting',
    signature_url:          signerUrl,
    statut:                 'envoyé',
    updated_at:             new Date().toISOString(),
  }).eq('id', documentId)

  return res.status(200).json({
    success:       true,
    submission_id: submission.id,
    signature_url: signerUrl,
    signer_email:  signerEmail,
  })
}

// ── Action : vérifier le statut ───────────────────────────────────────────────
async function handleCheckStatus(req, res, supabase, user) {
  const { documentId } = req.body || {}
  if (!documentId) return res.status(400).json({ error: 'documentId requis' })

  const { data: profile } = await supabase.from('profiles')
    .select('agency_id').eq('user_id', user.id).single()
  if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

  const { data: doc } = await supabase.from('documents')
    .select('docuseal_submission_id, signature_status')
    .eq('id', documentId).eq('agency_id', profile.agency_id).single()
  if (!doc) return res.status(404).json({ error: 'Document introuvable' })
  if (!doc.docuseal_submission_id) return res.status(400).json({ error: 'Document non envoyé pour signature' })

  const apiKey = process.env.DOCUSEAL_API_KEY
  if (!apiKey) return res.status(422).json({ error: 'Service de signature temporairement indisponible.' })

  const submission = await docusealFetch(`/submissions/${doc.docuseal_submission_id}`, 'GET', null, apiKey)
  const allSigned  = submission.submitters?.every(s => s.completed_at) || false
  const status     = allSigned ? 'completed' : 'awaiting'

  if (status !== doc.signature_status) {
    await supabase.from('documents').update({
      signature_status: status,
      signed_at: allSigned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', documentId)
  }

  return res.status(200).json({ status, submitters: submission.submitters })
}

// ── Webhook DocuSeal → mise à jour automatique après signature ────────────────
async function handleWebhook(req, res) {
  const supabase = sb()
  const event    = req.body?.event_type
  const sub      = req.body?.data

  if (!sub?.id) return res.status(200).json({ ok: true })

  if (['submission.completed', 'submission.form_completed'].includes(event)) {
    const allSigned = sub.submitters?.every(s => s.completed_at) || event === 'submission.completed'
    await supabase.from('documents')
      .update({
        signature_status: allSigned ? 'completed' : 'awaiting',
        signed_at:        allSigned ? new Date().toISOString() : null,
        statut:           allSigned ? 'signé' : 'envoyé',
        updated_at:       new Date().toISOString(),
      })
      .eq('docuseal_submission_id', String(sub.id))
  }

  return res.status(200).json({ ok: true })
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { action } = req.body || {}

  // Le webhook DocuSeal n'a pas de token utilisateur
  if (action === 'webhook') return await handleWebhook(req, res)

  // Authentification Supabase pour les autres actions
  const authHeader = req.headers.authorization || ''
  const token      = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Token requis' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  const supabase    = createClient(supabaseUrl, supabaseKey)

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  try {
    if (action === 'send-for-signature') return await handleSendForSignature(req, res, supabase, user)
    if (action === 'check-status')       return await handleCheckStatus(req, res, supabase, user)
    return res.status(400).json({ error: `Action inconnue: "${action}"` })
  } catch (err) {
    console.error(`[docuseal/${action}]`, err.message)
    return res.status(err.status || 500).json({ error: err.message })
  }
}
