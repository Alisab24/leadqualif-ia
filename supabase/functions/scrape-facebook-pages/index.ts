// LeadQualif — Facebook Pages v15
// Stratégie: Bing HTML search "kw zone site:facebook.com" (Bing tolère les IPs datacenter)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FB_SKIP = ['/search', '/groups', '/events', '/watch', '/marketplace',
  '/help', '/login', '/video', '/photos', '/posts', '/stories', '/people',
  '/friends', '/notifications', '/settings', '/pages/create', '/hashtag',
  '/reel', '/live', '/fundraisers', '/games', '/ads', '/privacy', '/terms',
  '/sharer', '/dialog', '/plugins']

function isFbBusinessUrl(url: string): boolean {
  try {
    const p = new URL(url)
    if (!p.hostname.includes('facebook.com') && !p.hostname.includes('fb.com')) return false
    const path = p.pathname.replace(/\/$/, '')
    if (!path || path === '') return false
    if (FB_SKIP.some(s => path.startsWith(s))) return false
    if (/^\/\d+$/.test(path)) return false
    return true
  } catch { return false }
}

function cleanFbUrl(url: string): string {
  try {
    const segs = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean)
    // Garder /pages/nom/id ou /slug directement
    if (segs[0] === 'pages' && segs.length >= 2) return `https://www.facebook.com/pages/${segs[1]}/${segs[2] || ''}`
    return `https://www.facebook.com/${segs[0]}`
  } catch { return url }
}

async function searchBing(query: string): Promise<{ url: string; title: string }[]> {
  const q = encodeURIComponent(query)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(
      `https://www.bing.com/search?q=${q}&cc=fr&setmkt=fr-FR&setlang=fr-FR&count=10&first=1`,
      {
        signal: ctrl.signal,
        headers: {
          'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer'        : 'https://www.bing.com/',
          'Cache-Control'  : 'no-cache',
        },
      }
    )
    clearTimeout(t)
    if (!res.ok) { console.warn(`[bing] HTTP ${res.status} pour: ${query}`); return [] }
    const html = await res.text()
    console.log(`[bing] réponse ${html.length} chars pour: ${query}`)

    const results: { url: string; title: string }[] = []
    const seen = new Set<string>()

    // Bing structure: <h2><a href="URL" h="...">TITLE</a></h2> dans <li class="b_algo">
    const re = /<h2[^>]*>\s*<a\s+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const url   = m[1].split('&')[0] // retirer les paramètres de tracking Bing
      const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()
      if (seen.has(url)) continue
      seen.add(url)
      results.push({ url, title })
    }

    // Fallback: chercher toutes les href dans les résultats
    if (results.length === 0) {
      const re2 = /href="(https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/[^"?&]+)"/g
      while ((m = re2.exec(html)) !== null) {
        if (!seen.has(m[1])) { seen.add(m[1]); results.push({ url: m[1], title: '' }) }
      }
    }

    console.log(`[bing] ${results.length} résultats pour: ${query}`)
    return results
  } catch (err: any) {
    clearTimeout(t)
    console.warn(`[bing] erreur: ${err.message}`)
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { mots_cles = [], zones_geo = [] } = await req.json()
  const keywords = (mots_cles as string[]).slice(0, 3)
  const zones    = (zones_geo as string[]).length > 0 ? (zones_geo as string[]).slice(0, 3) : ['France']

  const leads: any[] = []
  const seen = new Set<string>()

  for (const kw of keywords) {
    for (const z of zones) {
      await new Promise(r => setTimeout(r, 800)) // anti rate-limit
      const results = await searchBing(`${kw} ${z} site:facebook.com`)

      for (const r of results) {
        if (!isFbBusinessUrl(r.url)) continue
        const cleanUrl = cleanFbUrl(r.url)
        if (seen.has(cleanUrl)) continue
        seen.add(cleanUrl)

        const nom = r.title
          .replace(/\s*[\|—\-–]\s*Facebook\s*$/i, '')
          .replace(/\s*\|.*$/, '')
          .trim() || cleanUrl.split('/').filter(Boolean).pop() || 'Page Facebook'

        leads.push({
          nom,
          facebook_url: cleanUrl,
          ville       : z !== 'France' ? z : null,
          source      : 'facebook_pages',
          pays        : 'France',
        })
      }
    }
  }

  console.log(`[facebook] ${leads.length} leads extraits`)
  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
