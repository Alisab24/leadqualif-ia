// LeadQualif — Pages Jaunes France v12
// Stratégie: DirectFetch (header browser) → ScrapingBee → Apify web-scraper
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIFY_KEY       = Deno.env.get('APIFY_API_KEY')
const SCRAPINGBEE_KEY = Deno.env.get('SCRAPINGBEE_API_KEY')

// ── Parser HTML Pages Jaunes ──────────────────────────────────────────────────
function parsePJ(html: string, ville: string): any[] {
  const results: any[] = []
  const blocks = html.match(/<li[^>]*class="[^"]*bi-contact[^"]*"[^>]*>[\s\S]*?<\/li>/g) || []
  for (const block of blocks) {
    const nom   = block.match(/class="[^"]*denomination[^"]*"[^>]*>([^<]+)</)?.[1]?.trim()
    const tel   = block.match(/data-href="[^"]*(\d{10})"/)?.[1]
    const addr  = block.match(/class="[^"]*address[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]
                       ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const site  = block.match(/data-pjlink="web" href="([^"]+)"/)?.[1]
                || block.match(/href="([^"]+)"[^>]*data-pjlink="web"/)?.[1]
    const cat   = block.match(/class="[^"]*categorie[^"]*"[^>]*>([^<]+)</)?.[1]?.trim()
    if (!nom) continue
    results.push({
      nom,
      adresse : addr   || null,
      ville   : ville  || null,
      telephone: tel ? `+33${tel.substring(1)}` : null,
      site_web: site   || null,
      categorie: cat   || null,
      source  : 'pages_jaunes',
      pays    : 'France',
    })
  }
  return results
}

// ── Mode 1 : Fetch direct avec headers navigateur ─────────────────────────────
async function scrapeDirectFetch(mots_cles: string[], zones_geo: string[]): Promise<any[]> {
  const leads: any[] = []
  const seen  = new Set<string>()
  const keywords = mots_cles.slice(0, 2)
  const zones    = zones_geo.length > 0 ? zones_geo.slice(0, 2) : ['Paris', 'Lyon']

  for (const kw of keywords) {
    for (const zone of zones) {
      try {
        await new Promise(r => setTimeout(r, 400))
        const url = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(kw)}&ou=${encodeURIComponent(zone)}`
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 12000)
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer'        : 'https://www.pagesjaunes.fr/',
            'Cache-Control'  : 'no-cache',
            'Pragma'         : 'no-cache',
            'Sec-Fetch-Dest' : 'document',
            'Sec-Fetch-Mode' : 'navigate',
            'Sec-Fetch-Site' : 'same-origin',
            'Upgrade-Insecure-Requests': '1',
          },
        })
        clearTimeout(t)
        if (!res.ok) {
          console.warn(`[pj/direct] ${url} → ${res.status}`)
          continue
        }
        const html = await res.text()
        console.log(`[pj/direct] ${kw}+${zone} → ${res.status}, ${html.length} chars`)
        const parsed = parsePJ(html, zone)
        console.log(`[pj/direct] parsed ${parsed.length} entries`)
        for (const item of parsed) {
          const key = item.telephone || `${item.nom}_${zone}`.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          leads.push({ ...item, ville: item.ville || zone })
        }
      } catch (err: any) {
        console.warn(`[pj/direct] Error: ${err.message}`)
      }
    }
  }
  return leads
}

// ── Mode 2 : ScrapingBee ──────────────────────────────────────────────────────
async function scrapeViaScrapingBee(mots_cles: string[], zones_geo: string[]): Promise<any[]> {
  if (!SCRAPINGBEE_KEY) return []
  const leads: any[] = []
  const seen = new Set<string>()
  for (const kw of mots_cles.slice(0, 2)) {
    for (const zone of (zones_geo.length > 0 ? zones_geo.slice(0, 2) : ['Paris'])) {
      try {
        await new Promise(r => setTimeout(r, 600))
        const targetUrl = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(kw)}&ou=${encodeURIComponent(zone)}`
        const beeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=true&premium_proxy=true&country_code=fr`
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000)
        const res = await fetch(beeUrl, { signal: ctrl.signal }); clearTimeout(t)
        if (!res.ok) continue
        const html = await res.text()
        for (const item of parsePJ(html, zone)) {
          const key = item.telephone || `${item.nom}_${zone}`
          if (seen.has(key)) continue; seen.add(key)
          leads.push({ ...item, ville: item.ville || zone })
        }
      } catch {}
    }
  }
  return leads
}

// ── Mode 3 : Apify web-scraper (actor officiel Apify, toujours dispo) ─────────
async function scrapeViaApify(mots_cles: string[], zones_geo: string[]): Promise<any[]> {
  if (!APIFY_KEY) return []
  const keywords = mots_cles.slice(0, 2)
  const zones    = zones_geo.length > 0 ? zones_geo.slice(0, 2) : ['Paris', 'Lyon']

  const startUrls = keywords.flatMap(kw =>
    zones.map(z => ({
      url: `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(kw)}&ou=${encodeURIComponent(z)}`,
    }))
  ).slice(0, 4)

  // Page function Cheerio pour extraire les résultats Pages Jaunes
  const pageFunction = `
async function pageFunction(context) {
  const { $, request, log } = context
  const results = []
  const zone = new URL(request.url).searchParams.get('ou') || ''
  $('[class*="bi-contact"]').each((i, el) => {
    const nom = $(el).find('[class*="denomination"]').first().text().trim()
    if (!nom) return
    const telHref = $(el).find('[class*="tel"]').first().attr('data-href') || ''
    const telM = telHref.match(/\\/(\\d{10})$/)
    const telephone = telM ? '+33' + telM[1].substring(1) : null
    const adresse = $(el).find('[class*="address"]').first().text().replace(/\\s+/g, ' ').trim()
    const siteEl = $(el).find('[data-pjlink="web"]').first()
    const site = siteEl.attr('href') || siteEl.attr('data-href') || null
    results.push({ nom, telephone, adresse: adresse || null, site_web: site, ville: zone, source: 'pages_jaunes', pays: 'France' })
  })
  log.info('PJ extracted ' + results.length + ' results from ' + request.url)
  return results
}
`

  try {
    const runRes = await fetch(`https://api.apify.com/v2/acts/apify~web-scraper/runs?token=${APIFY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls,
        pageFunction,
        maxRequestsPerCrawl: 4,
        proxyConfiguration: { useApifyProxy: true, apifyProxyCountry: 'FR' },
      }),
    })
    if (!runRes.ok) {
      console.warn(`[pj/apify] run start failed ${runRes.status}: ${(await runRes.text()).slice(0, 200)}`)
      return []
    }
    const runData = await runRes.json()
    const runId = runData.data?.id
    if (!runId) return []
    console.log(`[pj/apify] run ${runId} started`)

    let attempts = 0, lastStatus = '', finished = false
    while (attempts < 15 && !finished) {
      await new Promise(r => setTimeout(r, 4000))
      attempts++
      const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`)).json()
      lastStatus = s.data?.status || ''
      console.log(`[pj/apify] attempt ${attempts}: ${lastStatus}`)
      if (lastStatus === 'SUCCEEDED') { finished = true; break }
      if (['FAILED','TIMED-OUT','ABORTED'].includes(lastStatus)) break
    }

    const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&format=json&limit=100`)
    if (!itemsRes.ok) return []
    const items = await itemsRes.json()
    const flat = Array.isArray(items) ? items.flat() : []
    console.log(`[pj/apify] ${flat.length} items from dataset (status: ${lastStatus})`)
    return flat.filter((i: any) => i.nom).slice(0, 40)
  } catch (err) {
    console.error('[pj/apify] error:', err)
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const { mots_cles = [], zones_geo = [] } = await req.json()
  let leads: any[] = []

  if (SCRAPINGBEE_KEY) {
    console.log('[pj] mode: ScrapingBee')
    leads = await scrapeViaScrapingBee(mots_cles, zones_geo)
  }

  if (leads.length === 0) {
    console.log('[pj] mode: direct fetch')
    leads = await scrapeDirectFetch(mots_cles, zones_geo)
  }

  if (leads.length === 0 && APIFY_KEY) {
    console.log('[pj] mode: Apify web-scraper')
    leads = await scrapeViaApify(mots_cles, zones_geo)
  }

  console.log(`[pj] total: ${leads.length} leads`)
  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
