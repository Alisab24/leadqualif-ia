// LeadQualif Scraper Engine v3 — Facebook Pages via Apify
// Deploy: npx supabase functions deploy scrape-facebook-pages
// Env: APIFY_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIFY_KEY = Deno.env.get('APIFY_API_KEY')
// Actor officiel Apify pour Facebook Pages
const ACTOR_ID = 'apify~facebook-pages-scraper'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!APIFY_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'APIFY_API_KEY manquante' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mots_cles = [], zones_geo = [] } = await req.json()
  const leads: any[] = []

  const keywords = (mots_cles as string[]).slice(0, 2)
  const zones = (zones_geo as string[]).slice(0, 2)

  // Construire des URLs de recherche Facebook (format accepté par l'actor)
  const startUrls: { url: string }[] = []
  keywords.forEach((kw: string) => {
    if (zones.length === 0) {
      startUrls.push({ url: `https://www.facebook.com/search/pages/?q=${encodeURIComponent(kw)}` })
    } else {
      zones.forEach((z: string) => {
        startUrls.push({ url: `https://www.facebook.com/search/pages/?q=${encodeURIComponent(kw + ' ' + z)}` })
      })
    }
  })

  const finalUrls = startUrls.slice(0, 4)

  try {
    const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: finalUrls,
        maxResults: 20,
        scrapeAbout: true,
        scrapeReviews: false,
        scrapeServices: false,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
        },
      }),
    })

    if (!runRes.ok) {
      const err = await runRes.text()
      console.error('[facebook-pages] Apify run failed:', err)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const runData = await runRes.json()
    const runId = runData.data?.id
    if (!runId) {
      console.error('[facebook-pages] No runId returned')
      return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })
    }

    console.log(`[facebook-pages] Run démarré: ${runId}`)

    // Attendre la fin du run (max 90s)
    let attempts = 0
    let finished = false
    let lastStatus = ''
    while (attempts < 30 && !finished) {
      await new Promise(r => setTimeout(r, 3000))
      attempts++
      try {
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`)
        const statusData = await statusRes.json()
        lastStatus = statusData.data?.status || ''
        if (lastStatus === 'SUCCEEDED') { finished = true; break }
        if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(lastStatus)) {
          console.warn(`[facebook-pages] Run status: ${lastStatus}`)
          break
        }
      } catch {}
    }

    console.log(`[facebook-pages] Run terminé: ${lastStatus}, ${attempts} tentatives`)

    // Récupérer les résultats même si run non terminé (résultats partiels)
    const dataRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&format=json&limit=50`
    )

    if (!dataRes.ok) {
      console.warn('[facebook-pages] Impossible de récupérer les items')
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const items = await dataRes.json()
    const seen = new Set<string>()

    for (const item of (Array.isArray(items) ? items : []).slice(0, 30)) {
      const nom = item.title || item.name || item.pageName
      if (!nom) continue

      const key = (nom + (item.city || '')).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      leads.push({
        nom,
        adresse: item.address || item.street,
        ville: item.city || item.location?.city,
        code_postal: item.zip || item.postalCode,
        telephone: item.phone || item.phoneNumber,
        email: item.email,
        site_web: item.website,
        facebook_url: item.url || item.pageUrl || item.link,
        instagram_url: item.instagramUrl || item.instagram || null,
        nb_avis: item.reviewCount || item.ratingCount,
        note_google: item.overallStarRating || item.starRating,
        categorie: item.category || item.pageCategory,
        source: 'facebook_pages',
        pays: item.country || null,
      })
    }

    console.log(`[facebook-pages] ${leads.length} leads récupérés`)
  } catch (err) {
    console.error('[facebook-pages] Error:', err)
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
