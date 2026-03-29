// LeadQualif Scraper Engine v3 — Instagram Business via Apify (~0.005$/profil)
// Deploy: npx supabase functions deploy scrape-instagram
// Env: APIFY_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIFY_KEY = Deno.env.get('APIFY_API_KEY')
// Actor Apify pour Instagram Scraper (business profiles)
const ACTOR_ID = 'apify~instagram-scraper'

function extractEmailFromText(text: string): string | null {
  const match = text?.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!APIFY_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'APIFY_API_KEY manquante — canal Instagram désactivé' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mots_cles = [], zones_geo = [] } = await req.json()
  const leads: any[] = []

  // Construire les hashtags/search queries pour Instagram business
  const keywords = mots_cles.slice(0, 2)
  const zones = zones_geo.slice(0, 2)

  const searchQueries: string[] = []
  keywords.forEach((kw: string) => {
    if (zones.length === 0) {
      searchQueries.push(kw)
    } else {
      zones.forEach((z: string) => searchQueries.push(`${kw} ${z}`))
    }
  })

  try {
    // Lancer l'actor Apify Instagram Scraper
    const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Input compatible avec apify~instagram-scraper
        directUrls: [],
        resultsType: 'details',
        resultsLimit: 20,
        searchType: 'hashtag',
        searchLimit: 20,
        // Certaines versions utilisent "searches"
        searches: searchQueries.slice(0, 4),
        hashtags: searchQueries.slice(0, 4).map((q: string) => q.replace(/\s+/g, '')),
        proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
        scrapePostsUntilDate: null,
        isUserTaggedFeedURL: false,
        onlyBusinessAccounts: true,
        maxRequestRetries: 2,
      }),
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      console.error('[scrape-instagram] Apify run failed:', errText)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const runData = await runRes.json()
    const runId = runData.data?.id
    if (!runId) {
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Attendre la fin du run (max 60s)
    let attempts = 0
    let finished = false
    while (attempts < 20 && !finished) {
      await new Promise(r => setTimeout(r, 3000))
      attempts++
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`)
      const statusData = await statusRes.json()
      const status = statusData.data?.status
      if (status === 'SUCCEEDED') { finished = true; break }
      if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(status)) break
    }

    if (!finished) {
      console.warn('[scrape-instagram] Run did not complete in time')
      // Tenter de récupérer les résultats partiels
    }

    // Récupérer les résultats
    const dataRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&format=json&limit=50`
    )

    if (!dataRes.ok) {
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const items = await dataRes.json()
    const seen = new Set<string>()

    for (const item of (Array.isArray(items) ? items : []).slice(0, 30)) {
      // Filtrer les comptes business uniquement
      if (!item.isBusinessAccount && !item.isBusiness && !item.businessCategory) continue

      const username = item.username || item.ownerUsername
      if (!username || seen.has(username)) continue
      seen.add(username)

      const bio = item.biography || item.bio || ''
      const emailFromBio = extractEmailFromText(bio)
      const emailFromContact = item.public_email || item.businessEmail || item.contactEmail

      leads.push({
        nom: item.fullName || item.name || username,
        email: emailFromContact || emailFromBio || null,
        site_web: item.externalUrl || item.websiteUrl || item.external_url || null,
        instagram_url: `https://instagram.com/${username}`,
        instagram_data: {
          username,
          followers: item.followersCount || item.followersCount,
          following: item.followingCount,
          posts: item.mediaCount || item.postsCount,
          bio: bio.slice(0, 300),
          is_business: item.isBusinessAccount || item.isBusiness,
          category: item.businessCategory || item.category || item.categoryName,
          external_url: item.externalUrl || item.external_url,
        },
        source: 'instagram',
        // Ville extraite du bio si possible
        ville: zones[0] || null,
        pays: 'France',
      })
    }

    console.log(`[scrape-instagram] ${leads.length} leads récupérés`)
    return new Response(JSON.stringify({ leads }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[scrape-instagram] Error:', err)
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
