// LeadQualif — Pages Jaunes France v15
// Stratégie: DuckDuckGo "kw zone site:pagesjaunes.fr/pros" → fetch profils SSR
// Pas d'Apify, pas de clé API tierce. Les pages /pros/ sont server-rendered.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SCRAPINGBEE_KEY = Deno.env.get('SCRAPINGBEE_API_KEY')

// ── Recherche DuckDuckGo HTML ─────────────────────────────────────────────────
async function searchDDG(query: string): Promise<string[]> {
  const q = encodeURIComponent(query)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}&kl=fr-fr`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept'         : 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer'        : 'https://duckduckgo.com/',
      },
    })
    clearTimeout(t)
    if (!res.ok) { console.warn(`[ddg] HTTP ${res.status}`); return [] }
    const html = await res.text()

    const urls: string[] = []
    const seen = new Set<string>()
    const uddgMatches = html.matchAll(/uddg=([^"&]+)/g)
    for (const m of uddgMatches) {
      try {
        const url = decodeURIComponent(m[1])
        if (!url.includes('pagesjaunes.fr/pros/') && !url.includes('pagesjaunes.fr/annonces/')) continue
        const clean = url.split('?')[0].split('#')[0]
        if (seen.has(clean)) continue
        seen.add(clean)
        urls.push(clean)
        if (urls.length >= 12) break
      } catch {}
    }
    console.log(`[pj/ddg] query="${query}" → ${urls.length} profils PJ`)
    return urls
  } catch (err: any) {
    clearTimeout(t)
    console.warn(`[pj/ddg] erreur: ${err.message}`)
    return []
  }
}

// ── Parser HTML profil Pages Jaunes (/pros/ — SSR) ───────────────────────────
function parsePJProfil(html: string, profilUrl: string): any | null {
  const nom = html.match(/<h1[^>]*class="[^"]*[dD]enomination[^"]*"[^>]*>([^<]+)/)?.[1]?.trim()
           || html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)/)?.[1]?.trim()
           || html.match(/<h1[^>]*>([^<]{3,80})<\/h1>/)?.[1]?.trim()
  if (!nom) return null

  const tel  = html.match(/(?:data-href|href)="tel:([+\d\s.()\-]{7,18})"/)?.[1]?.trim()
            || html.match(/"telephone"\s*:\s*"([^"]+)"/)?.[1]
            || html.match(/"phoneNumber"\s*:\s*"([^"]+)"/)?.[1]
  const addr = html.match(/itemprop="streetAddress"[^>]*>([^<]+)/)?.[1]?.trim()
            || html.match(/"streetAddress"\s*:\s*"([^"]+)"/)?.[1]
  const cp   = html.match(/itemprop="postalCode"[^>]*>([^<]+)/)?.[1]?.trim()
            || html.match(/"postalCode"\s*:\s*"([^"]+)"/)?.[1]
  const ville= html.match(/itemprop="addressLocality"[^>]*>([^<]+)/)?.[1]?.trim()
            || html.match(/"addressLocality"\s*:\s*"([^"]+)"/)?.[1]
  const site = html.match(/data-pjlink="web"\s+href="([^"]+)"/)?.[1]
            || html.match(/href="([^"]+)"\s+data-pjlink="web"/)?.[1]
  const cat  = html.match(/itemprop="description"[^>]*>([^<]{3,80})/)?.[1]?.trim()

  return {
    nom,
    adresse    : addr  || null,
    ville      : ville || null,
    code_postal: cp    || null,
    telephone  : tel   || null,
    site_web   : site  || null,
    categorie  : cat   || null,
    pj_url     : profilUrl,
    source     : 'pages_jaunes',
    pays       : 'France',
  }
}

// ── Fetch d'un profil PJ ──────────────────────────────────────────────────────
async function fetchPJProfil(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept'         : 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer'        : 'https://www.google.fr/',
        'Cache-Control'  : 'no-cache',
      },
    })
    clearTimeout(t)
    if (!res.ok) { console.warn(`[pj/fetch] ${url} → ${res.status}`); return null }
    const html = await res.text()
    return parsePJProfil(html, url)
  } catch (err: any) {
    console.warn(`[pj/fetch] erreur ${url}: ${err.message}`)
    return null
  }
}

// ── Mode ScrapingBee (si clé dispo — liste complète avec JS) ─────────────────
async function scrapeViaScrapingBee(mots_cles: string[], zones_geo: string[]): Promise<any[]> {
  if (!SCRAPINGBEE_KEY) return []
  const leads: any[] = []
  const seen = new Set<string>()
  for (const kw of mots_cles.slice(0, 2)) {
    for (const zone of (zones_geo.length > 0 ? zones_geo.slice(0, 2) : ['Paris'])) {
      try {
        await new Promise(r => setTimeout(r, 500))
        const targetUrl = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(kw)}&ou=${encodeURIComponent(zone)}`
        const beeUrl    = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=true&premium_proxy=true&country_code=fr`
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000)
        const res  = await fetch(beeUrl, { signal: ctrl.signal }); clearTimeout(t)
        if (!res.ok) continue
        const html = await res.text()
        const blocks = html.match(/<li[^>]*class="[^"]*bi-contact[^"]*"[^>]*>[\s\S]*?<\/li>/g) || []
        for (const block of blocks) {
          const nom = block.match(/class="[^"]*denomination[^"]*"[^>]*>([^<]+)</)?.[1]?.trim()
          if (!nom) continue
          const key = nom.toLowerCase() + zone
          if (seen.has(key)) continue; seen.add(key)
          const tel  = block.match(/data-href="[^"]*(\d{10})"/)?.[1]
          const addr = block.match(/class="[^"]*address[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          const site = block.match(/data-pjlink="web" href="([^"]+)"/)?.[1]
          leads.push({ nom, adresse: addr||null, ville: zone, telephone: tel ? `+33${tel.substring(1)}`:null, site_web: site||null, source:'pages_jaunes', pays:'France' })
        }
      } catch {}
    }
  }
  return leads
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const { mots_cles = [], zones_geo = [] } = await req.json()
  let leads: any[] = []

  // Priorité 1 : ScrapingBee si disponible
  if (SCRAPINGBEE_KEY) {
    console.log('[pj] mode: ScrapingBee')
    leads = await scrapeViaScrapingBee(mots_cles, zones_geo)
  }

  // Priorité 2 : DuckDuckGo → profils PJ SSR (sans Apify)
  if (leads.length === 0) {
    console.log('[pj] mode: DuckDuckGo → profils PJ SSR')
    const keywords = (mots_cles as string[]).slice(0, 2)
    const zones    = (zones_geo as string[]).length > 0 ? (zones_geo as string[]).slice(0, 2) : ['Paris', 'Lyon']

    const allUrls: string[] = []
    const seenUrls = new Set<string>()

    for (const kw of keywords) {
      for (const z of zones) {
        await new Promise(r => setTimeout(r, 600)) // anti rate-limit DDG
        const urls = await searchDDG(`${kw} ${z} site:pagesjaunes.fr/pros`)
        for (const u of urls) {
          if (!seenUrls.has(u)) { seenUrls.add(u); allUrls.push(u) }
        }
      }
    }

    // Fetch tous les profils en parallèle (max 10)
    console.log(`[pj] ${allUrls.length} profils à fetcher`)
    const results = await Promise.all(allUrls.slice(0, 10).map(fetchPJProfil))
    for (const r of results) {
      if (r && r.nom) leads.push(r)
    }
  }

  console.log(`[pj] total: ${leads.length} leads`)
  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
