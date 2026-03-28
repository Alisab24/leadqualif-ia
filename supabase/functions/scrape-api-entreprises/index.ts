// LeadQualif Scraper Engine v3 — API Recherche Entreprises France (gratuite, sans clé)
// Deploy: npx supabase functions deploy scrape-api-entreprises

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { mots_cles = [], zones_geo = [], codes_naf = [] } = await req.json()

  const leads: any[] = []
  const seen = new Set<string>()

  const keywords = mots_cles.slice(0, 3)
  const zones = zones_geo.slice(0, 5)

  const queries: Array<{ q: string; zone?: string; naf?: string }> = []

  // Par mots-clés + zones
  keywords.forEach((kw: string) => {
    if (zones.length === 0) {
      queries.push({ q: kw })
    } else {
      zones.forEach((z: string) => queries.push({ q: kw, zone: z }))
    }
  })
  // Par code NAF seul
  if (codes_naf.length > 0) {
    zones.forEach((z: string) => {
      queries.push({ q: z, naf: codes_naf[0] })
    })
    if (zones.length === 0) queries.push({ q: '', naf: codes_naf[0] })
  }

  for (const query of queries.slice(0, 8)) {
    try {
      await new Promise(r => setTimeout(r, 300))
      const params = new URLSearchParams({ per_page: '10', page: '1' })
      if (query.q) params.set('q', query.q)
      if (query.zone) {
        // Détection code postal (5 chiffres) ou département (2 chiffres)
        if (/^\d{5}$/.test(query.zone)) params.set('code_postal', query.zone)
        else if (/^\d{2}$/.test(query.zone)) params.set('departement', query.zone)
        else params.set('q', `${query.q || ''} ${query.zone}`.trim())
      }
      if (query.naf) params.set('activite_principale', query.naf)

      const res = await fetch(`${API_URL}?${params}`)
      if (!res.ok) continue
      const data = await res.json()

      for (const entreprise of (data.results || [])) {
        const siren = entreprise.siren
        if (!siren || seen.has(siren)) continue
        seen.add(siren)

        const siege = entreprise.siege || {}
        const dirigeant = entreprise.dirigeants?.[0]
          ? `${entreprise.dirigeants[0].prenom || ''} ${entreprise.dirigeants[0].nom || ''}`.trim()
          : null

        leads.push({
          nom: entreprise.nom_complet || entreprise.nom_raison_sociale,
          adresse: siege.adresse || [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(' '),
          ville: siege.libelle_commune,
          code_postal: siege.code_postal,
          pays: 'France',
          siren,
          code_naf: entreprise.activite_principale,
          dirigeant,
          source: 'api_entreprises',
          telephone: null, // L'API entreprises ne fournit pas les téléphones
          email: null,
          site_web: null,
        })
      }
    } catch (err) {
      console.error('[api-entreprises] Error:', err)
    }
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
