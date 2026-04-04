// LeadQualif — Pages Jaunes France v16
// Stratégie: Bing "kw zone site:pagesjaunes.fr/pros" → fetch profils SSR individuels
// Bing tolère les IPs datacenter mieux que DuckDuckGo
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SCRAPINGBEE_KEY = Deno.env.get('SCRAPINGBEE_API_KEY')

// ── Bing HTML Search ──────────────────────────────────────────────────────────
async function searchBing(query: string): Promise<string[]> {
  const q = encodeURIComponent(query)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(
      `https://www.bing.com/search?q=${q}&cc=fr&setmkt=fr-FR&setlang=fr-FR&count=10`,
      {
        signal: ctrl.signal,
        headers: {
          'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Referer'        : 'https://www.bing.com/',
        },
      }
    )
    clearTimeout(t)
    if (!res.ok) { console.warn(`[bing] HTTP ${res.status}`); return [] }
    const html = await res.text()

    const urls: string[] = []
    const seen = new Set<string>()

    // Extraire les URLs pagesjaunes.fr/pros depuis les liens Bing
    const re = /href="(https?:\/\/(?:www\.)?pagesjaunes\.fr\/(?:pros|annonces)\/[^"?&]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const clean = m[1].split('?')[0].split('#')[0]
      if (!seen.has(clean)) { seen.add(clean); urls.push(clean) }
      if (urls.length >= 12) break
    }

    console.log(`[pj/bing] "${query}" → ${urls.length} profils PJ`)
    return urls
  } catch (err: any) {
    clearTimeout(t)
    console.warn(`[pj/bing] erreur: ${err.message}`)
    return []
  }
}

// ── Parser page profil PJ (SSR — pas de JS requis) ───────────────────────────
function parsePJProfil(html: string, url: string): any | null {
  // Essais successifs pour le nom
  const nom = html.match(/class="[^"]*denomination[^"]*"[^>]*>([^<]{2,80})/)?.[1]?.trim()
           || html.match(/itemprop="name"[^>]*>([^<]{2,80})/)?.[1]?.trim()
           || html.match(/<h1[^>]*>([^<]{3,80})<\/h1>/)?.[1]?.trim()
           || html.match(/"name"\s*:\s*"([^"]{3,80})"/)?.[1]
  if (!nom || nom.length < 2) return null

  const tel   = html.match(/href="tel:([+\d\s.()\-]{7,20})"/)?.[1]?.replace(/\s/g,'').trim()
             || html.match(/"telephone"\s*:\s*"([^"]{7,20})"/)?.[1]
  const addr  = html.match(/itemprop="streetAddress"[^>]*>([^<]{3,100})/)?.[1]?.trim()
             || html.match(/"streetAddress"\s*:\s*"([^"]{3,100})"/)?.[1]
  const cp    = html.match(/itemprop="postalCode"[^>]*>([^<]{4,10})/)?.[1]?.trim()
             || html.match(/"postalCode"\s*:\s*"([^"]{4,10})"/)?.[1]
  const ville = html.match(/itemprop="addressLocality"[^>]*>([^<]{2,60})/)?.[1]?.trim()
             || html.match(/"addressLocality"\s*:\s*"([^"]{2,60})"/)?.[1]
  const site  = html.match(/data-pjlink="web"\s+href="([^"]+)"/)?.[1]
             || html.match(/href="([^"]+)"\s+[^>]*data-pjlink="web"/)?.[1]

  return { nom, adresse:addr||null, ville:ville||null, code_postal:cp||null,
           telephone:tel||null, site_web:site||null, pj_url:url,
           source:'pages_jaunes', pays:'France' }
}

async function fetchPJProfil(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept'         : 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer'        : 'https://www.bing.com/',
      },
    })
    clearTimeout(t)
    if (!res.ok) { console.warn(`[pj/fetch] ${res.status} — ${url}`); return null }
    const html = await res.text()
    const result = parsePJProfil(html, url)
    if (result) console.log(`[pj/fetch] ✓ ${result.nom}`)
    return result
  } catch { return null }
}

// ── ScrapingBee (si clé dispo) ────────────────────────────────────────────────
async function scrapeViaScrapingBee(mots_cles: string[], zones_geo: string[]): Promise<any[]> {
  if (!SCRAPINGBEE_KEY) return []
  const leads: any[] = []; const seen = new Set<string>()
  for (const kw of mots_cles.slice(0,2)) {
    for (const zone of (zones_geo.length>0?zones_geo.slice(0,2):['Paris'])) {
      try {
        await new Promise(r=>setTimeout(r,600))
        const targetUrl=`https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(kw)}&ou=${encodeURIComponent(zone)}`
        const beeUrl=`https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=true&premium_proxy=true&country_code=fr`
        const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),20000)
        const res=await fetch(beeUrl,{signal:ctrl.signal}); clearTimeout(t)
        if(!res.ok)continue
        const html=await res.text()
        for(const block of (html.match(/<li[^>]*class="[^"]*bi-contact[^"]*"[^>]*>[\s\S]*?<\/li>/g)||[])){
          const nom=block.match(/class="[^"]*denomination[^"]*"[^>]*>([^<]+)</)?.[1]?.trim()
          if(!nom)continue
          if(seen.has(nom+zone))continue; seen.add(nom+zone)
          const tel=block.match(/data-href="[^"]*(\d{10})"/)?.[1]
          const addr=block.match(/class="[^"]*address[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
          const site=block.match(/data-pjlink="web" href="([^"]+)"/)?.[1]
          leads.push({nom,adresse:addr||null,ville:zone,telephone:tel?`+33${tel.substring(1)}`:null,site_web:site||null,source:'pages_jaunes',pays:'France'})
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

  if (SCRAPINGBEE_KEY) {
    console.log('[pj] mode: ScrapingBee')
    leads = await scrapeViaScrapingBee(mots_cles, zones_geo)
  }

  if (leads.length === 0) {
    console.log('[pj] mode: Bing → profils PJ SSR')
    const keywords = (mots_cles as string[]).slice(0,2)
    const zones    = (zones_geo as string[]).length>0 ? (zones_geo as string[]).slice(0,2) : ['Paris','Lyon']

    const allUrls: string[] = []; const seenUrls = new Set<string>()
    for (const kw of keywords) {
      for (const z of zones) {
        await new Promise(r=>setTimeout(r,800))
        for (const u of await searchBing(`${kw} ${z} site:pagesjaunes.fr/pros`)) {
          if (!seenUrls.has(u)) { seenUrls.add(u); allUrls.push(u) }
        }
      }
    }

    console.log(`[pj] ${allUrls.length} profils à fetcher en parallèle`)
    const results = await Promise.all(allUrls.slice(0,10).map(fetchPJProfil))
    for (const r of results) { if (r && r.nom) leads.push(r) }
  }

  console.log(`[pj] total: ${leads.length} leads`)
  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
