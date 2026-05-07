/**
 * POST /api/webhooks/:platform
 * Handler universel — reçoit les leads depuis 8 sources différentes.
 *
 * Platforms supportées :
 *   systeme | facebook-leads | tiktok | google-ads |
 *   typeform | tally | wordpress | universal
 *
 * Auth : X-LeadQualif-Key: lq_live_xxx  (header ou ?key=xxx)
 *
 * Flux :
 *   1. Valider la clé API → trouver l'agence
 *   2. Parser le payload selon la plateforme
 *   3. Dédoublonner par email
 *   4. Créer ou enrichir le lead
 *   5. Scorer avec Claude IA
 *   6. Si score >= 70 → auto-contact
 *   7. Logger dans webhook_logs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Utilitaires ───────────────────────────────────────────────────────────────

/** Aplatit un objet imbriqué pour la détection automatique des champs */
function flattenObj(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenObj(v, key))
    }
    out[k.toLowerCase()] = typeof v === 'string' ? v : (v == null ? '' : String(v))
  }
  return out
}

/** Cherche une valeur par liste de clés candidates (insensible à la casse) */
function findVal(flat, ...candidates) {
  for (const c of candidates) {
    const k = Object.keys(flat).find(key => key === c.toLowerCase())
    if (k && flat[k]) return flat[k]
  }
  return ''
}

/** Résout un chemin pointé dans un objet (ex: "contact.email") */
function resolvePath(obj, path) {
  if (!path) return ''
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), obj) || ''
}

/** Normalise un numéro de téléphone */
function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim()
}

// ── Parsers par plateforme ────────────────────────────────────────────────────

const PARSERS = {

  systeme(body) {
    const c = body.contact || body
    return {
      email:     (c.email || '').trim().toLowerCase(),
      firstName: c.first_name  || c.firstName  || '',
      lastName:  c.last_name   || c.lastName   || '',
      phone:     normalizePhone(c.phone_number || c.phone || ''),
      source:    'Systeme.io',
      detail:    body.funnel_name || body.page_name || '',
    }
  },

  'facebook-leads'(body) {
    // Meta Webhook format: entry[].changes[].value.field_data[]
    const entry   = body.entry?.[0]
    const change  = entry?.changes?.[0]
    const value   = change?.value || body
    const fields  = value.field_data || body.field_data || []
    const g = (name) => (fields.find(f =>
      (f.name || '').toLowerCase() === name.toLowerCase()
    )?.values?.[0] || '').trim()

    const fullName = g('full_name')
    return {
      email:     (g('email') || '').toLowerCase(),
      firstName: g('first_name') || fullName.split(' ')[0] || '',
      lastName:  g('last_name')  || fullName.split(' ').slice(1).join(' ') || '',
      phone:     normalizePhone(g('phone_number') || g('phone')),
      source:    'Facebook Ads',
      detail:    value.form_id ? `Form ID: ${value.form_id}` : '',
    }
  },

  tiktok(body) {
    const lead   = body.lead_info || body.data || body
    const fields = lead.fields || lead.field_data || {}
    const g = (k) => fields[k] || lead[k] || ''
    const fullName = g('full_name') || g('name') || ''
    return {
      email:     (g('email') || '').trim().toLowerCase(),
      firstName: g('first_name') || fullName.split(' ')[0] || '',
      lastName:  g('last_name')  || fullName.split(' ').slice(1).join(' ') || '',
      phone:     normalizePhone(g('phone_number') || g('phone')),
      source:    'TikTok Ads',
      detail:    lead.campaign_id ? `Campaign: ${lead.campaign_id}` : '',
    }
  },

  'google-ads'(body) {
    const lead = body.lead || body
    const cols = Array.isArray(lead.column_data) ? lead.column_data : []
    const g = (...ids) => {
      for (const id of ids) {
        const found = cols.find(c => (c.column_id || '').toUpperCase() === id.toUpperCase())
        if (found?.string_value) return found.string_value
      }
      return lead[ids[0].toLowerCase()] || ''
    }
    return {
      email:     (g('EMAIL', 'email') || '').toLowerCase(),
      firstName: g('FIRST_NAME', 'first_name'),
      lastName:  g('LAST_NAME',  'last_name'),
      phone:     normalizePhone(g('PHONE_NUMBER', 'phone')),
      source:    'Google Ads',
      detail:    lead.lead_form_id ? `Form: ${lead.lead_form_id}` : '',
    }
  },

  typeform(body) {
    const answers = body.form_response?.answers || body.answers || []
    let email = '', firstName = '', lastName = '', phone = ''

    for (const a of answers) {
      const title = (a.field?.title || a.field?.ref || '').toLowerCase()
      const val   = a.email || a.phone_number || a.text || a.choice?.label || ''

      if (a.type === 'email')        { email = val.toLowerCase() }
      else if (a.type === 'phone_number') { phone = normalizePhone(val) }
      else if (title.includes('prénom') || title.includes('prenom') || title.includes('first')) {
        firstName = firstName || val
      } else if (title.includes('nom') || title.includes('last')) {
        lastName = lastName || val
      } else if (title.includes('email') && !email) {
        email = val.toLowerCase()
      } else if (title.includes('téléphone') || title.includes('phone') || title.includes('tel')) {
        phone = phone || normalizePhone(val)
      }
    }

    return { email, firstName, lastName, phone, source: 'Typeform', detail: body.form_response?.form_id || '' }
  },

  tally(body) {
    const fields = body.data?.fields || body.fields || []
    const byLabel = (label) => {
      const f = fields.find(f =>
        (f.label || f.title || '').toLowerCase().includes(label.toLowerCase())
      )
      return (Array.isArray(f?.value) ? f.value.join(' ') : f?.value) || ''
    }
    const byType = (type) => {
      const f = fields.find(f => (f.type || '').toUpperCase() === type)
      return (Array.isArray(f?.value) ? f.value.join(' ') : f?.value) || ''
    }
    const email = byType('EMAIL') || byLabel('email')
    const phone = normalizePhone(byType('PHONE_NUMBER') || byLabel('téléphone') || byLabel('phone') || byLabel('tel'))
    const fn    = byLabel('prénom') || byLabel('prenom') || byLabel('first')
    const ln    = byLabel('nom')    || byLabel('last')
    return { email: email.toLowerCase(), firstName: fn, lastName: ln, phone, source: 'Tally.so', detail: body.formId || '' }
  },

  wordpress(body) {
    const flat = flattenObj(body)
    const g    = (...keys) => findVal(flat, ...keys)
    const rawName = g('your-name', 'full_name', 'fullname', 'nom_complet', 'name')
    return {
      email:     (g('email', 'your-email', 'email-address', 'mail') || '').toLowerCase(),
      firstName: g('first-name', 'firstname', 'prenom', 'prénom', 'first_name') || rawName.split(' ')[0] || '',
      lastName:  g('last-name',  'lastname',  'nom',    'last_name')  || rawName.split(' ').slice(1).join(' ') || '',
      phone:     normalizePhone(g('phone', 'tel', 'telephone', 'your-phone', 'phone-number', 'mobile')),
      source:    body.form_name || body.post_title || 'WordPress',
      detail:    body.form_id   || body.post_id   || '',
    }
  },

  universal(body, mapping) {
    const flat = flattenObj(body)
    const m    = mapping || {}
    const r    = (path) => (resolvePath(body, path) || findVal(flat, path || '')) + ''

    return {
      email:     (r(m.email)     || findVal(flat, 'email', 'mail', 'courriel', 'email_address')).toLowerCase(),
      firstName: r(m.firstName)  || findVal(flat, 'first_name', 'firstname', 'prenom', 'prénom', 'given_name'),
      lastName:  r(m.lastName)   || findVal(flat, 'last_name',  'lastname',  'nom',    'family_name', 'surname'),
      phone:     normalizePhone(r(m.phone) || findVal(flat, 'phone', 'tel', 'telephone', 'mobile', 'phone_number')),
      source:    m.source        || 'Webhook universel',
      detail:    r(m.detail)     || '',
    }
  },
}

// ── Scoring Claude IA ─────────────────────────────────────────────────────────

async function scoreLead(lead, anthropicKey) {
  if (!anthropicKey) return { score: 30, niveau: 'froid', raison: 'Clé Anthropic non configurée' }
  try {
    const prompt = `Tu es un expert CRM. Évalue ce lead (score 0-100, niveau chaud/tiède/froid, raison courte, action recommandée).
Réponds UNIQUEMENT en JSON : {"score":number,"niveau":"chaud"|"tiède"|"froid","raison":"...","action":"..."}
Lead : ${JSON.stringify({ nom: `${lead.firstName} ${lead.lastName}`, email: lead.email, telephone: lead.phone, source: lead.source })}`

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) return { score: 30, niveau: 'froid', raison: 'Scoring IA indisponible' }
    const d   = await r.json()
    const txt = d.content?.[0]?.text || '{}'
    const m   = txt.match(/\{[\s\S]*\}/)
    const q   = m ? JSON.parse(m[0]) : {}
    return {
      score:  Math.max(0, Math.min(100, parseInt(q.score) || 30)),
      niveau: ['chaud', 'tiède', 'froid'].includes(q.niveau) ? q.niveau : 'froid',
      raison: q.raison || '',
      action: q.action || '',
    }
  } catch { return { score: 30, niveau: 'froid', raison: 'Erreur scoring' } }
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-LeadQualif-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Facebook envoie un GET pour vérifier le webhook
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query
    if (mode === 'subscribe' && challenge) return res.status(200).send(challenge)
    return res.status(200).json({ ok: true, message: 'LeadQualif webhook actif' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' })

  const platform = (req.query.platform || '').toLowerCase()
  const parser   = PARSERS[platform]
  if (!parser) return res.status(400).json({ error: `Plateforme inconnue: "${platform}". Valeurs: ${Object.keys(PARSERS).join(', ')}` })

  // ── 1. Authentification par clé API ──────────────────────────────────────
  const apiKey = (req.headers['x-leadqualif-key'] || req.query.key || '').trim()
  if (!apiKey) return res.status(401).json({ error: 'Clé API requise (header X-LeadQualif-Key ou ?key=)' })

  const { data: keyRow, error: keyErr } = await supabase
    .from('api_keys')
    .select('id, agency_id, is_active')
    .eq('key', apiKey)
    .single()

  if (keyErr || !keyRow) return res.status(401).json({ error: 'Clé API invalide' })
  if (!keyRow.is_active)  return res.status(401).json({ error: 'Clé API désactivée' })

  const agencyId = keyRow.agency_id

  // Mise à jour last_used_at (fire-and-forget)
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then(() => {})

  // ── 2. Parser le payload ──────────────────────────────────────────────────
  let parsed
  try {
    if (platform === 'universal') {
      const { data: mRow } = await supabase
        .from('webhook_mappings')
        .select('mapping')
        .eq('agency_id', agencyId)
        .eq('platform', 'universal')
        .maybeSingle()
      parsed = PARSERS.universal(req.body, mRow?.mapping || {})
    } else {
      parsed = PARSERS[platform](req.body)
    }
  } catch (e) {
    console.error(`[webhook/${platform}] parse error:`, e.message)
    return res.status(400).json({ error: 'Payload invalide', detail: e.message })
  }

  const { email, firstName, lastName, phone, source, detail } = parsed
  const nom = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0]

  if (!email || !email.includes('@')) {
    return res.status(422).json({ error: 'Email invalide ou manquant', parsed })
  }

  // ── 3. Dédoublonnage + create/update lead ──────────────────────────────────
  const { data: existing } = await supabase
    .from('leads')
    .select('id, nom, telephone, source_platform')
    .eq('agency_id', agencyId)
    .eq('email', email)
    .maybeSingle()

  let leadId, action

  if (existing) {
    // Enrichir si téléphone manquant
    const updates = {}
    if (phone && !existing.telephone) updates.telephone = phone
    if (!existing.source_platform)    updates.source_platform = source
    if (Object.keys(updates).length) {
      await supabase.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existing.id)
    }
    leadId = existing.id
    action = 'updated'
  } else {
    const { data: newLead, error: insertErr } = await supabase
      .from('leads')
      .insert({
        agency_id:       agencyId,
        nom,
        email,
        telephone:       phone || null,
        source:          source,
        source_platform: source,
        source_detail:   detail || null,
        statut_crm:      'Nouveau',
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error(`[webhook/${platform}] insert error:`, insertErr.message)
      return res.status(500).json({ error: 'Erreur création lead', detail: insertErr.message })
    }
    leadId = newLead.id
    action = 'created'
  }

  // ── 4. Répondre 200 immédiatement ─────────────────────────────────────────
  res.status(200).json({ ok: true, action, leadId, platform, source })

  // ── 5. Scoring IA (après la réponse) ──────────────────────────────────────
  try {
    const { data: ws } = await supabase
      .from('workspace_settings')
      .select('anthropic_api_key')
      .eq('agency_id', agencyId)
      .maybeSingle()
    const anthropicKey = ws?.anthropic_api_key || process.env.ANTHROPIC_API_KEY

    const scoring = await scoreLead({ firstName, lastName, email, phone, source }, anthropicKey)

    await supabase
      .from('leads')
      .update({
        score_ia:    scoring.score,
        score:       scoring.score,
        niveau_ia:   scoring.niveau,
        raison_ia:   scoring.raison,
        action_ia:   scoring.action,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', leadId)

    // ── 6. Auto-contact si lead chaud ────────────────────────────────────────
    if (action === 'created' && scoring.score >= 70) {
      const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://app.leadqualif.com'
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (profileRow?.user_id) {
        await fetch(`${APP_URL}/api/crm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Agency': agencyId },
          body: JSON.stringify({ action: 'auto-contact', leadId }),
        }).catch(() => {})
      }
    }
  } catch (e) {
    console.warn(`[webhook/${platform}] post-response error:`, e.message)
  }

  // ── 7. Log ────────────────────────────────────────────────────────────────
  supabase.from('webhook_logs').insert({
    agency_id:  agencyId,
    platform,
    payload:    req.body,
    lead_id:    leadId,
    action,
    created_at: new Date().toISOString(),
  }).then(() => {})
}
