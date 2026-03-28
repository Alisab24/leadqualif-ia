// LeadQualif Scraper Engine v3 — Enrichissement site web (scraper maison, gratuit)
// Deploy: npx supabase functions deploy enrich-website
// Extrait : emails, réseaux sociaux, téléphone secondaire
// Si pas de site_web → recherche DuckDuckGo pour trouver l'URL automatiquement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractEmails(html: string): string[] {
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(regex) || []
  return [...new Set(matches)].filter(e =>
    !e.includes('example.') &&
    !e.includes('sentry') &&
    !e.includes('noreply') &&
    !e.includes('@2x') &&
    !e.endsWith('.png') &&
    !e.endsWith('.jpg')
  ).slice(0, 3)
}

function extractPhones(html: string): string[] {
  const cleaned = html.replace(/<[^>]+>/g, ' ')
  const regex = /(?:\+33|0033|0)[1-9](?:[\s.\-]?\d{2}){4}|(?:\+44|0044|0)\d{10,11}|\+1[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g
  const matches = cleaned.match(regex) || []
  return [...new Set(matches)].slice(0, 2)
}

function extractSocialLinks(html: string): Record<string, string | null> {
  const socials: Record<string, string | null> = {
    linkedin_url: null, instagram_url: null, facebook_url: null, tiktok_url: null,
  }
  const linkedinMatch  = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"?]+)/)
  const instagramMatch = html.match(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"?]+)/)
  const facebookMatch  = html.match(/href="(https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/[^"?]+)/)
  const tiktokMatch    = html.match(/href="(https?:\/\/(?:www\.)?tiktok\.com\/@[^"?]+)/)
  if (linkedinMatch)  socials.linkedin_url  = linkedinMatch[1]
  if (instagramMatch) socials.instagram_url = instagramMatch[1]
  if (facebookMatch)  socials.facebook_url  = facebookMatch[1]
  if (tiktokMatch)    socials.tiktok_url    = tiktokMatch[1]
  return socials
}

function detectCMS(html: string, headers: Headers): string | null {
  if (html.includes('wp-content') || html.includes('wordpress')) return 'WordPress'
  if (html.includes('shopify')) return 'Shopify'
  if (html.includes('wix.com') || html.includes('wixsite')) return 'Wix'
  if (html.includes('squarespace')) return 'Squarespace'
  if (html.includes('webflow')) return 'Webflow'
  if (headers.get('x-powered-by')?.includes('PHP')) return 'PHP'
  return null
}

// ── Recherche DuckDuckGo pour trouver le site d'une entreprise ──────────────
async function findWebsiteViaDuckDuckGo(nom: string, ville?: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${nom} ${ville || ''} site officiel`)
    const url = `https://html.duckduckgo.com/html/?q=${query}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadQualif/3.0; +https://leadqualif.com)',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const html = await res.text()

    // Extraire les URLs de résultats DuckDuckGo (format: href="//duckduckgo.com/l/?uddg=ENCODED_URL")
    const uddgMatches = html.matchAll(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^"&]+)/g)
    for (const match of uddgMatches) {
      try {
        const decoded = decodeURIComponent(match[1])
        // Ignorer les résultats génériques (Wikipedia, PagesJaunes, Yelp, etc.)
        const blacklist = ['wikipedia', 'pagesjaunes', 'yelp', 'tripadvisor', 'annuaire',
                           'societe.com', 'infogreffe', 'verif', 'kompass', 'manageo',
                           'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com']
        if (!blacklist.some(b => decoded.includes(b)) && decoded.startsWith('http')) {
          return decoded
        }
      } catch {}
    }

    // Fallback : chercher des URLs directement dans le HTML
    const urlMatches = html.match(/href="(https?:\/\/(?!duckduckgo)[^\s"?#]+\.[a-z]{2,}[^\s"?#]*)"/)
    if (urlMatches) {
      const url = urlMatches[1]
      const blacklist = ['wikipedia', 'pagesjaunes', 'yelp', 'tripadvisor', 'facebook', 'instagram', 'linkedin']
      if (!blacklist.some(b => url.includes(b))) return url
    }

    return null
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[enrich-website] DuckDuckGo timeout')
    } else {
      console.warn('[enrich-website] DuckDuckGo error:', err.message)
    }
    return null
  }
}

// ── Scraper le site web ──────────────────────────────────────────────────────
async function scrapeWebsite(siteUrl: string): Promise<Record<string, any>> {
  let url = siteUrl.trim()
  if (!url.startsWith('http')) url = 'https://' + url

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)

  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LeadQualif/3.0)',
      'Accept': 'text/html',
    },
    redirect: 'follow',
  })
  clearTimeout(timer)

  if (!res.ok) return {}

  const html = await res.text()
  const emails = extractEmails(html)
  const phones = extractPhones(html)
  const socials = extractSocialLinks(html)
  const cms = detectCMS(html, res.headers)

  const enriched: Record<string, any> = { ...socials, cms, site_web: url }
  if (emails.length > 0) enriched.email = emails[0]
  if (phones.length > 0) enriched.telephone_secondaire = phones[0]

  return enriched
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json()
  const { site_web, nom, ville } = body

  // Cas 1 : URL déjà connue → scraper directement
  if (site_web) {
    try {
      const enriched = await scrapeWebsite(site_web)
      return new Response(JSON.stringify({ leads: [enriched], total: 1, found_via: 'direct' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err: any) {
      if (err.name === 'AbortError') console.warn(`[enrich-website] Timeout: ${site_web}`)
      else console.error('[enrich-website] Error:', err)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Cas 2 : Pas d'URL → chercher via DuckDuckGo avec nom + ville
  if (nom) {
    console.log(`[enrich-website] Recherche DuckDuckGo: "${nom}" "${ville || ''}"`)
    const foundUrl = await findWebsiteViaDuckDuckGo(nom, ville)

    if (!foundUrl) {
      console.log(`[enrich-website] Aucun site trouvé pour: ${nom}`)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[enrich-website] Site trouvé: ${foundUrl}`)
    try {
      const enriched = await scrapeWebsite(foundUrl)
      return new Response(JSON.stringify({ leads: [enriched], total: 1, found_via: 'duckduckgo' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err: any) {
      if (err.name === 'AbortError') console.warn(`[enrich-website] Timeout scraping: ${foundUrl}`)
      else console.error('[enrich-website] Scrape error:', err)
      // Au moins on a le site_web même si le scrape a échoué
      return new Response(JSON.stringify({ leads: [{ site_web: foundUrl }], total: 1, found_via: 'duckduckgo_url_only' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Ni site_web ni nom → rien à faire
  return new Response(JSON.stringify({ leads: [] }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
