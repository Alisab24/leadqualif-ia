// LeadQualif Scraper Engine v3 — Enrichissement LinkedIn via Proxycurl (~0.01$/profil)
// Deploy: npx supabase functions deploy enrich-linkedin
// Env: PROXYCURL_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROXYCURL_KEY = Deno.env.get('PROXYCURL_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!PROXYCURL_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'PROXYCURL_API_KEY manquante — canal LinkedIn désactivé' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { nom, entreprise, ville } = await req.json()
  if (!nom && !entreprise) {
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Recherche de l'entreprise sur LinkedIn
    const searchParams = new URLSearchParams({
      company_name: entreprise || nom,
      ...(ville ? { location: ville } : {}),
      enrich_profiles: 'skip',
      page_size: '1',
    })

    const res = await fetch(`https://nubela.co/proxycurl/api/linkedin/company/search?${searchParams}`, {
      headers: { 'Authorization': `Bearer ${PROXYCURL_KEY}` },
    })

    if (!res.ok) {
      console.warn(`[enrich-linkedin] HTTP ${res.status}`)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const company = data.results?.[0]

    if (!company) {
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const enriched = {
      linkedin_url: company.linkedin_profile_url || null,
      linkedin_data: {
        followers: company.followers_count,
        industry: company.industry,
        description: company.description?.slice(0, 300),
        specialties: company.specialities,
        website: company.website,
        employee_count: company.company_size,
        hq_city: company.hq?.city,
      },
    }

    return new Response(JSON.stringify({ leads: [enriched] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[enrich-linkedin] Error:', err)
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
