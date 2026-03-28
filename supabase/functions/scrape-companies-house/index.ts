// LeadQualif Scraper Engine v3 — Companies House API UK (gratuite)
// Deploy: npx supabase functions deploy scrape-companies-house
// Env: COMPANIES_HOUSE_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CH_API_KEY = Deno.env.get('COMPANIES_HOUSE_API_KEY')
const CH_BASE    = 'https://api.company-information.service.gov.uk'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!CH_API_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'COMPANIES_HOUSE_API_KEY manquante' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mots_cles = [], zones_geo = [], sic_codes = [] } = await req.json()
  const leads: any[] = []
  const seen = new Set<string>()
  const headers = {
    'Authorization': `Basic ${btoa(CH_API_KEY + ':')}`,
    'Accept': 'application/json',
  }

  const keywords = mots_cles.slice(0, 3)
  const zones = zones_geo.slice(0, 3)

  const queries: string[] = []
  keywords.forEach((kw: string) => {
    if (zones.length === 0) queries.push(kw)
    else zones.forEach((z: string) => queries.push(`${kw} ${z}`))
  })

  for (const query of queries.slice(0, 6)) {
    try {
      await new Promise(r => setTimeout(r, 500))
      const params = new URLSearchParams({ q: query, items_per_page: '10' })
      const res = await fetch(`${CH_BASE}/search/companies?${params}`, { headers })
      if (!res.ok) continue
      const data = await res.json()

      for (const company of (data.items || [])) {
        const number = company.company_number
        if (!number || seen.has(number)) continue
        seen.add(number)

        // Filtrage SIC code si spécifié
        if (sic_codes.length > 0) {
          const sics: string[] = company.sic_codes || []
          const match = sic_codes.some((s: string) => sics.some((c: string) => c.startsWith(s)))
          if (!match) continue
        }

        const addr = company.registered_office_address || {}
        leads.push({
          nom: company.title,
          adresse: [addr.address_line_1, addr.address_line_2].filter(Boolean).join(', '),
          ville: addr.locality || '',
          code_postal: addr.postal_code || '',
          pays: 'UK',
          companies_house_number: number,
          sic_code: (company.sic_codes || [])[0] || null,
          source: 'companies_house',
          telephone: null,
          email: null,
          site_web: null,
        })
      }
    } catch (err) {
      console.error('[companies-house] Error:', err)
    }
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
