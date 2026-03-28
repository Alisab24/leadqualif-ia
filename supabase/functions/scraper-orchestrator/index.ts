// LeadQualif Scraper Engine v3 — Orchestrateur principal
// Deploy: npx supabase functions deploy scraper-orchestrator
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY  = Deno.env.get('ANTHROPIC_API_KEY')!
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY')!

// ── Calcul du score initial ─────────────────────────────────────────
function calcScore(lead: Record<string, any>): number {
  let score = 0
  if (lead.email)                       score += 25
  if (lead.telephone)                   score += 20
  if (lead.site_web)                    score += 15
  if (lead.note_google && lead.note_google >= 4.0) score += 10
  if (lead.nb_avis && lead.nb_avis >= 20)          score += 10
  if (lead.instagram_url || lead.facebook_url || lead.linkedin_url) score += 10
  if (lead.siren || lead.companies_house_number)   score += 5
  if (lead.linkedin_url)                score += 5
  return Math.min(score, 100)
}

function scoreStatut(score: number): string {
  if (score >= 71) return 'chaud'
  if (score >= 41) return 'tiede'
  return 'froid'
}

// ── Génération AI opener bilingue via Claude Haiku 4.5 ────────────
async function generateAIOpener(lead: Record<string, any>, langue: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return ''
  try {
    const isFr = langue === 'fr'
    const prompt = isFr
      ? `Tu es un commercial expert. Génère un message d'accroche court (2-3 phrases max) et personnalisé en français pour contacter ce prospect par email ou WhatsApp. Sois naturel, professionnel, et mentionne un détail spécifique sur leur activité.
Prospect : ${lead.nom}, ${lead.ville || ''}, ${lead.code_naf ? 'Code NAF: ' + lead.code_naf : ''}, ${lead.note_google ? 'Note Google: ' + lead.note_google + '/5' : ''}, ${lead.nb_avis ? lead.nb_avis + ' avis' : ''}.`
      : `You are an expert sales professional. Write a short, personalized opening message (2-3 sentences max) in English to contact this prospect by email or WhatsApp. Be natural, professional, and mention a specific detail about their business.
Prospect: ${lead.nom}, ${lead.ville || ''}, ${lead.sic_code ? 'SIC: ' + lead.sic_code : ''}, ${lead.note_google ? 'Google Rating: ' + lead.note_google + '/5' : ''}, ${lead.nb_avis ? lead.nb_avis + ' reviews' : ''}.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text?.trim() || ''
  } catch { return '' }
}

// ── Appel d'une edge function source ──────────────────────────────
async function callSource(functionName: string, payload: Record<string, any>): Promise<any[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[${functionName}] HTTP ${res.status}`)
      return []
    }
    const data = await res.json()
    return Array.isArray(data?.leads) ? data.leads : []
  } catch (err) {
    console.error(`[${functionName}] Error:`, err)
    return []
  }
}

// ── Normalisation téléphone → format international WhatsApp ────────
// Convertit "04 77 58 31 22" → "+33477583122" selon le pays de la target
const COUNTRY_CODES: Record<string, string> = {
  FR: '33', GB: '44', BE: '32', CH: '41', CA: '1',
  US: '1',  AU: '61', DE: '49', ES: '34', IT: '39',
  NL: '31', PT: '351', MA: '212', SN: '221', CI: '225',
}
function normalizePhone(raw: any, pays: any = 'FR'): string | null {
  if (!raw) return null
  try {
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  const paysStr = Array.isArray(pays) ? (pays[0] || 'FR') : (pays || 'FR')
  const cc = COUNTRY_CODES[String(paysStr).toUpperCase()] || '33'
  // Déjà au format international (commence par l'indicatif pays)
  if (digits.startsWith(cc) && digits.length > 10) return '+' + digits
  // Format local FR/BE/CH : 10 chiffres commençant par 0
  if (digits.startsWith('0') && digits.length === 10) return '+' + cc + digits.substring(1)
  // Format local UK : 11 chiffres commençant par 0
  if (digits.startsWith('0') && digits.length === 11) return '+' + cc + digits.substring(1)
  // Déjà un format valide (9 chiffres sans 0 initial)
  if (digits.length >= 9) return '+' + cc + digits
  return String(raw) // garder tel quel si format inconnu
  } catch { return raw != null ? String(raw) : null }
}

// ── Dédoublonnage ─────────────────────────────────────────────────
function dedup(leads: any[]): any[] {
  const seen = new Set<string>()
  return leads.filter(l => {
    const key = l.telephone
      ? l.telephone.replace(/\s/g, '')
      : `${(l.nom || '').toLowerCase().slice(0, 15)}_${(l.ville || '').toLowerCase().slice(0, 10)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') || ''
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Récupérer l'utilisateur
  const { data: { user } } = await createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SERVICE_ROLE_KEY)
    .auth.getUser(authHeader.replace('Bearer ', ''))

  const body = await req.json()
  const { target_id, user_id: bodyUserId } = body
  const userId = user?.id || bodyUserId

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers: corsHeaders })
  }

  try {
    // Récupérer la target
    const { data: target, error: targetErr } = await supabase
      .from('scraper_targets')
      .select('*')
      .eq('id', target_id)
      .eq('user_id', userId)
      .single()

    if (targetErr || !target) {
      return new Response(JSON.stringify({ error: 'Target introuvable' }), { status: 404, headers: corsHeaders })
    }

    const langue = target.langue || 'fr'
    const sources = target.sources_actives || []
    const canaux = target.canaux_actifs || []

    console.log(`[Orchestrator] Target: ${target.nom} | Langue: ${langue} | Sources: ${sources.join(',')}`)

    // ── 1. Lancement sources en parallèle ──────────────────────
    const sourcePromises: Promise<any[]>[] = []
    const basePayload = {
      mots_cles: target.mots_cles,
      zones_geo: target.zones_geo,
      pays: target.pays,
      langue,
    }

    if (sources.includes('google_places')) {
      sourcePromises.push(callSource('scrape-google-places', basePayload))
    }
    if (langue === 'fr' && sources.includes('api_entreprises')) {
      sourcePromises.push(callSource('scrape-api-entreprises', {
        ...basePayload,
        codes_naf: target.codes_naf,
      }))
    }
    if (langue === 'fr' && sources.includes('pages_jaunes')) {
      sourcePromises.push(callSource('scrape-pages-jaunes', basePayload))
    }
    if (langue === 'en' && sources.includes('companies_house')) {
      sourcePromises.push(callSource('scrape-companies-house', {
        ...basePayload,
        sic_codes: target.sic_codes,
      }))
    }
    if (langue === 'en' && sources.includes('yelp')) {
      sourcePromises.push(callSource('scrape-yelp', basePayload))
    }
    if (sources.includes('opencorporates')) {
      sourcePromises.push(callSource('scrape-opencorporates', basePayload))
    }

    const results = await Promise.allSettled(sourcePromises)
    let allLeads: any[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') allLeads.push(...r.value)
    }

    // ── 2. Dédoublonnage ───────────────────────────────────────
    allLeads = dedup(allLeads)
    console.log(`[Orchestrator] Après dédup: ${allLeads.length} leads bruts`)

    // ── 3. Enrichissements en parallèle ────────────────────────
    const enriched = await Promise.all(allLeads.map(async (lead) => {
      const enrichTasks: Promise<any>[] = []

      // Enrich site web (gratuit, toujours si canal website activé)
      // Si site_web connu → scrape direct
      // Si pas de site_web mais nom connu → DuckDuckGo search pour trouver le site
      if (canaux.includes('website') && lead.nom) {
        const websitePayload = lead.site_web
          ? { site_web: lead.site_web }
          : { nom: lead.nom, ville: lead.ville }
        enrichTasks.push(callSource('enrich-website', websitePayload).then(r => {
          if (r[0]) {
            Object.assign(lead, r[0])
            // Recalcule le score après enrichissement
            if (r[0].site_web) lead.site_web = r[0].site_web
          }
        }))
      }
      // Enrich LinkedIn
      if (canaux.includes('linkedin') && lead.nom) {
        enrichTasks.push(callSource('enrich-linkedin', {
          nom: lead.nom, entreprise: lead.nom, ville: lead.ville,
        }).then(r => { if (r[0]) Object.assign(lead, r[0]) }))
      }
      // Enrich Instagram
      if (canaux.includes('instagram') && lead.instagram_url) {
        enrichTasks.push(callSource('enrich-instagram', {
          instagram_url: lead.instagram_url,
        }).then(r => { if (r[0]) Object.assign(lead, r[0]) }))
      }
      // Enrich TikTok
      if (canaux.includes('tiktok') && lead.tiktok_url) {
        enrichTasks.push(callSource('enrich-tiktok', {
          tiktok_url: lead.tiktok_url,
        }).then(r => { if (r[0]) Object.assign(lead, r[0]) }))
      }

      await Promise.allSettled(enrichTasks)
      return lead
    }))

    // ── 4. AI opener + score ───────────────────────────────────
    const finalLeads = await Promise.all(enriched.map(async (lead) => {
      const score = calcScore(lead)
      const ai_opener = await generateAIOpener(lead, langue)
      // Normaliser téléphone principal et secondaire au format international
      // target.pays est un ARRAY (text[]) → prendre le 1er élément, pas .toUpperCase() direct
      const paysRaw = Array.isArray(target.pays) ? target.pays[0] : target.pays
      const pays = (paysRaw || 'FR').toString().toUpperCase()
      if (lead.telephone)           lead.telephone           = normalizePhone(lead.telephone, pays) || lead.telephone
      if (lead.telephone_secondaire) lead.telephone_secondaire = normalizePhone(lead.telephone_secondaire, pays) || lead.telephone_secondaire
      return {
        ...lead,
        score_initial: score,
        statut: scoreStatut(score),
        ai_opener,
        langue,
        user_id: userId,
        target_id: target.id,
        canaux_utilises: canaux,
        injecte_pipeline: false,
      }
    }))

    // ── 5. Insertion en base ──────────────────────────────────
    let inserted = 0
    if (finalLeads.length > 0) {
      const chunks = []
      for (let i = 0; i < finalLeads.length; i += 50) chunks.push(finalLeads.slice(i, i + 50))
      for (const chunk of chunks) {
        const { error } = await supabase.from('raw_leads').insert(chunk)
        if (!error) inserted += chunk.length
        else console.error('[Insert] Error:', error)
      }
    }

    // ── 6. Mise à jour target ─────────────────────────────────
    await supabase.from('scraper_targets').update({
      derniere_execution: new Date().toISOString(),
      nb_leads_total: (target.nb_leads_total || 0) + inserted,
    }).eq('id', target.id)

    // ── 7. Notif email ────────────────────────────────────────
    if (inserted > 0 && RESEND_API_KEY) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, nom_complet')
        .eq('user_id', userId)
        .single()
      if (profile?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'LeadQualif Scraper <scraper@leadqualif.com>',
            to: [profile.email],
            subject: `🎯 ${inserted} nouveaux leads [${langue.toUpperCase()}] — ${target.nom}`,
            html: `<p>Bonjour ${profile.nom_complet || ''},</p>
<p>Le scraper a trouvé <strong>${inserted} nouveaux leads</strong> pour votre cible <strong>${target.nom}</strong>.</p>
<p><a href="https://app.leadqualif.com/scraper" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">Voir les résultats →</a></p>`,
          }),
        }).catch(() => {})
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_found: allLeads.length,
      inserted,
      target_id: target.id,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[Orchestrator] Fatal:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
