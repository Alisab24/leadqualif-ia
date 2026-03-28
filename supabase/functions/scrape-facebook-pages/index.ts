// LeadQualif Scraper Engine v3 — Facebook Pages via Apify (pay-as-you-go)
// Deploy: npx supabase functions deploy scrape-facebook-pages
// Env: APIFY_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIFY_KEY = Deno.env.get('APIFY_API_KEY')
// Actor ID Apify pour Facebook Pages Scraper
const ACTOR_ID = 'apify~facebook-pages-scraper'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!APIFY_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'APIFY_API_KEY manquante — canal Facebook désactivé' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mots_cles = [], zones_geo = [] } = await req.json()
  const leads: any[] = []

  const keywords = mots_cles.slice(0, 2)
  const zones = zones_geo.slice(0, 3)

  // Construire les search terms pour Apify
  const searchTerms: string[] = []
  keywords.forEach((kw: string) => {
    if (zones.length === 0) searchTerms.push(kw)
    else zones.forEach((z: string) => searchTerms.push(`${kw} ${z}`))
  })

  try {
    // Lancer l'actor Apify
    const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerms: searchTerms.slice(0, 5),
        maxResults: 20,
        scrapeAbout: true,
        scrapeReviews: false,
        scrapeServices: false,
      }),
    })

    if (!runRes.ok) {
      console.error('[facebook-pages] Apify run failed:', await runRes.text())
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const runData = await runRes.json()
    const runId = runData.data?.id
    if (!runId) return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })

    // Attendre la fin du run (max 30s)
    let attempts = 0
    let finished = false
    while (attempts < 10 && !finished) {
      await new Promise(r => setTimeout(r, 3000))
      attempts++
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`)
      const statusData = await statusRes.json()
      if (['SUCCEEDED', 'FAILED', 'TIMED-OUT'].includes(statusData.data?.status)) {
        finished = statusData.data?.status === 'SUCCEEDED'
        break
      }
    }

    if (!finished) {
      console.warn('[facebook-pages] Run did not complete in time')
      return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })
    }

    // Récupérer les résultats
    const dataRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&format=json`
    )
    const items = await dataRes.json()

    for (const item of (Array.isArray(items) ? items : []).slice(0, 20)) {
      leads.push({
        nom: item.title || item.name,
        adresse: item.address,
        ville: item.city,
        telephone: item.phone || item.phoneNumber,
        email: item.email,
        site_web: item.website,
        facebook_url: item.url || item.pageUrl,
        nb_avis: item.reviewCount,
        note_google: item.overallStarRating,
        source: 'facebook_pages',
        pays: item.country || null,
      })
    }
  } catch (err) {
    console.error('[facebook-pages] Error:', err)
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
