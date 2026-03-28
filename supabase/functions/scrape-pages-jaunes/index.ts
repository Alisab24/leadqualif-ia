// LeadQualif Scraper Engine v3 — Pages Jaunes France (scraper propriétaire)
// Deploy: npx supabase functions deploy scrape-pages-jaunes
// Note: Utilise fetch natif + parsing HTML — timeout 5s par requête

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Extraction données depuis HTML Pages Jaunes
function parsePageJaunes(html: string): any[] {
  const results: any[] = []
  try {
    // Extraction des blocs d'annuaires via regex sur le JSON embarqué
    const jsonMatch = html.match(/"results":\s*(\[[\s\S]*?\])\s*,\s*"pagination"/m)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1])
      for (const item of data.slice(0, 10)) {
        results.push({
          nom: item.businessName || item.denomination,
          adresse: item.address?.street,
          ville: item.address?.city,
          code_postal: item.address?.postalCode,
          telephone: item.phoneNumber || item.phone,
          site_web: item.website || item.url,
          email: item.email || null,
          source: 'pages_jaunes',
          pays: 'France',
        })
      }
      return results
    }

    // Fallback: parsing HTML brut par regex
    const entryRegex = /<li[^>]*class="[^"]*bi-contact[^"]*"[^>]*>([\s\S]*?)<\/li>/g
    let match: RegExpExecArray | null
    while ((match = entryRegex.exec(html)) !== null) {
      const block = match[1]
      const nom = block.match(/class="[^"]*denomination[^"]*"[^>]*>([^<]+)</)?.[1]?.trim()
      const tel = block.match(/class="[^"]*tel[^"]*"[^>]*data-href="[^"]*\/(\d{10})/)?.[1]
      const addr = block.match(/class="[^"]*address[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, '').trim()
      const site = block.match(/href="([^"]*)" [^>]*data-pjlink="web"/)?.[1]
      if (nom) {
        results.push({
          nom,
          adresse: addr || null,
          telephone: tel ? tel.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5') : null,
          site_web: site || null,
          source: 'pages_jaunes',
          pays: 'France',
        })
      }
    }
  } catch (err) {
    console.error('[pages-jaunes] Parse error:', err)
  }
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { mots_cles = [], zones_geo = [] } = await req.json()
  const leads: any[] = []
  const seen = new Set<string>()

  const keywords = mots_cles.slice(0, 2)
  const zones = zones_geo.length > 0 ? zones_geo.slice(0, 3) : ['Paris', 'Lyon', 'Marseille']

  for (const kw of keywords) {
    for (const zone of zones) {
      try {
        // Rate limiting : 2 req/sec max
        await new Promise(r => setTimeout(r, 600))

        const keyword = encodeURIComponent(kw)
        const location = encodeURIComponent(zone)
        const url = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${keyword}&ou=${location}`

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LeadQualif/3.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'fr-FR,fr;q=0.9',
          },
        })
        clearTimeout(timer)

        if (!res.ok) continue
        const html = await res.text()
        const parsed = parsePageJaunes(html)

        for (const item of parsed) {
          const key = item.telephone || `${item.nom}_${zone}`
          if (seen.has(key)) continue
          seen.add(key)
          item.ville = item.ville || zone
          leads.push(item)
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn(`[pages-jaunes] Timeout: ${kw} ${zone}`)
        } else {
          console.error('[pages-jaunes] Error:', err)
        }
      }
    }
  }

  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
