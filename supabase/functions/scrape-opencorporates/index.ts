// LeadQualif Scraper Engine v3 — OpenCorporates API (500 req/mois gratuit, 140 pays)
// Deploy: npx supabase functions deploy scrape-opencorporates

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map pays → jurisdiction OpenCorporates
const JURISDICTION_MAP: Record<string, string> = {
  'France': 'fr', 'UK': 'gb', 'USA': 'us', 'Canada': 'ca',
  'Australia': 'au', 'Belgium': 'be', 'Suisse': 'ch', 'Switzerland': 'ch',
  'Maroc': 'ma', 'Morocco': 'ma',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { mots_cles = [], zones_geo = [], pays = [], langue = 'fr' } = await req.json()
  const leads: any[] = []
  const seen = new Set<string>()

  // Résoudre les juridictions
  const jurisdictions: string[] = []
  if (pays.length > 0) {
    pays.forEach((p: string) => {
      const j = JURISDICTION_MAP[p]
      if (j && !jurisdictions.includes(j)) jurisdictions.push(j)
    })
  }
  if (jurisdictions.length === 0) jurisdictions.push(langue === 'fr' ? 'fr' : 'gb')

  const keywords = mots_cles.slice(0, 2)

  for (const kw of keywords) {
    for (const jurisdiction of jurisdictions.slice(0, 2)) {
      try {
        await new Promise(r => setTimeout(r, 600))
        const params = new URLSearchParams({
          q: kw,
          jurisdiction_code: jurisdiction,
          per_page: '10',
          current_status: 'Active',
        })
        const res = await fetch(`https://api.opencorporates.com/v0.4/companies/search?${params}`)
        if (!res.ok) continue
        const data = await res.json()
        const companies = data.results?.companies || []

        for (const item of companies) {
          const c = item.company
          if (!c || seen.has(c.company_number)) continue
          seen.add(c.company_number)

          leads.push({
            nom: c.name,
            adresse: c.registered_address?.street_address,
            ville: c.registered_address?.locality,
            code_postal: c.registered_address?.postal_code,
            pays: c.registered_address?.country || jurisdiction.toUpperCase(),
            source: 'opencorporates',
            companies_house_number: jurisdiction === 'gb' ? c.company_number : null,
            siren: jurisdiction === 'fr' ? c.company_number : null,
            telephone: null,
            email: null,
            site_web: null,
          })
        }
      } catch (err) {
        console.error('[opencorporates] Error:', err)
      }
    }
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
