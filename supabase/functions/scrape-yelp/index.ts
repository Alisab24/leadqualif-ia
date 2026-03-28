// LeadQualif Scraper Engine v3 — Yelp Fusion API (500 req/jour gratuit)
// Deploy: npx supabase functions deploy scrape-yelp
// Env: YELP_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const YELP_KEY  = Deno.env.get('YELP_API_KEY')
const YELP_BASE = 'https://api.yelp.com/v3/businesses'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!YELP_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'YELP_API_KEY manquante' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mots_cles = [], zones_geo = [], pays = [] } = await req.json()
  const leads: any[] = []
  const seen = new Set<string>()

  const keywords = mots_cles.slice(0, 2)
  const locations = zones_geo.length > 0 ? zones_geo.slice(0, 4) : ['London', 'New York', 'Toronto']

  for (const kw of keywords) {
    for (const location of locations) {
      try {
        await new Promise(r => setTimeout(r, 400))
        const params = new URLSearchParams({
          term: kw,
          location,
          limit: '10',
          locale: 'en_US',
        })
        const res = await fetch(`${YELP_BASE}/search?${params}`, {
          headers: { 'Authorization': `Bearer ${YELP_KEY}` },
        })
        if (!res.ok) continue
        const data = await res.json()

        for (const biz of (data.businesses || [])) {
          if (seen.has(biz.id)) continue
          seen.add(biz.id)

          const addr = biz.location || {}
          leads.push({
            nom: biz.name,
            adresse: biz.location?.display_address?.join(', '),
            ville: addr.city,
            code_postal: addr.zip_code,
            pays: addr.country || (pays[0] || 'US'),
            telephone: biz.display_phone || biz.phone || null,
            site_web: null, // Yelp ne fournit pas le site dans l'API search
            note_google: biz.rating || null,
            nb_avis: biz.review_count || null,
            source: 'yelp',
          })
        }
      } catch (err) {
        console.error('[yelp] Error:', err)
      }
    }
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
