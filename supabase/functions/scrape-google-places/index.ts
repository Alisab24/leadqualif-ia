// LeadQualif Scraper Engine v3 — Google Places API (FR + EN)
// Deploy: npx supabase functions deploy scrape-google-places
// Env: GOOGLE_PLACES_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')
const BASE_URL = 'https://maps.googleapis.com/maps/api/place'

async function getPlaceDetails(place_id: string): Promise<Record<string, any>> {
  try {
    const res = await fetch(
      `${BASE_URL}/details/json?place_id=${place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry&key=${GOOGLE_API_KEY}`
    )
    const data = await res.json()
    return data.result || {}
  } catch { return {} }
}

function parseAddress(address: string): { ville: string; code_postal: string } {
  const cpMatch = address.match(/\b(\d{5})\b/)
  const code_postal = cpMatch ? cpMatch[1] : ''
  const parts = address.split(',')
  const ville = parts[parts.length - 2]?.trim().replace(/^\d{5}\s*/, '') || ''
  return { ville, code_postal }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!GOOGLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY manquante', leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mots_cles = [], zones_geo = [], pays = [], langue = 'fr' } = await req.json()

  const leads: any[] = []
  const seen = new Set<string>()

  // Combinaisons mot-clé × zone
  const queries: string[] = []
  const keywords = mots_cles.slice(0, 3) // limiter pour le quota
  const zones = zones_geo.slice(0, 5)

  if (zones.length === 0) {
    keywords.forEach((kw: string) => queries.push(kw))
  } else {
    keywords.forEach((kw: string) => {
      zones.forEach((zone: string) => queries.push(`${kw} ${zone}`))
    })
  }

  for (const query of queries.slice(0, 10)) {
    try {
      // Rate limiting : 1 req/sec Google Places
      await new Promise(r => setTimeout(r, 1000))

      const params = new URLSearchParams({
        query,
        key: GOOGLE_API_KEY,
        language: langue === 'fr' ? 'fr' : 'en',
      })
      if (langue === 'en' && pays.length > 0) {
        params.set('region', pays[0].toLowerCase().slice(0, 2))
      }

      const res = await fetch(`${BASE_URL}/textsearch/json?${params}`)
      const data = await res.json()

      if (data.status !== 'OK' || !data.results) continue

      for (const place of (data.results || []).slice(0, 8)) {
        if (seen.has(place.place_id)) continue
        seen.add(place.place_id)

        // Détails complets (téléphone, site)
        await new Promise(r => setTimeout(r, 500))
        const details = await getPlaceDetails(place.place_id)

        const addr = parseAddress(place.formatted_address || '')

        leads.push({
          nom: place.name,
          adresse: place.formatted_address,
          ville: addr.ville,
          code_postal: addr.code_postal,
          pays: langue === 'fr' ? 'France' : (pays[0] || 'UK'),
          telephone: details.formatted_phone_number || null,
          site_web: details.website || null,
          note_google: place.rating || null,
          nb_avis: place.user_ratings_total || null,
          source: 'google_places',
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng,
        })
      }
    } catch (err) {
      console.error(`[google-places] Query "${query}":`, err)
    }
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
