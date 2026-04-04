// LeadQualif — Facebook Pages v14
// Stratégie: DuckDuckGo HTML search "kw zone site:facebook.com"
// → extrait URLs + métadonnées des snippets Google sans Apify ni clé API
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FB_SKIP = ['/search', '/groups', '/events', '/watch', '/marketplace',
  '/help', '/login', '/video', '/photos', '/posts', '/stories', '/people',
  '/friends', '/notifications', '/settings', '/pages/create', '/hashtag',
  '/reel', '/live', '/fundraisers', '/games', '/ads', '/privacy', '/terms']

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
    const p = new URL(url)
    const segs = p.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    return `https://www.facebook.com/${segs[0]}`
  } catch { return url }
}

// ── Recherche DuckDuckGo HTML (pas d'API, pas de clé) ─────────────────────────
async function searchDDG(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  const q = encodeURIComponent(query)
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${q}&kl=fr-fr`

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(ddgUrl, {
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

    const results: { url: string; title: string; snippet: string }[] = []

    // Extraire les vraies URLs depuis les redirects DDG
    const uddgRe = /href="\/\/duckduckgo\.com\/l\/\?uddg=([^"&]+)[^"]*"[^>]*>([^<]*)<\/a>[\s\S]{0,500}?class="result__snippet">([^<]*)/g
    let m: RegExpExecArray | null
    while ((m = uddgRe.exec(html)) !== null && results.length < 15) {
      try {
        const url     = decodeURIComponent(m[1])
        const title   = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
        const snippet = m[3].replace(/&amp;/g, '&').trim()
        results.push({ url, title, snippet })
      } catch {}
    }

    // Fallback si le regex ci-dessus échoue — chercher les uddg seuls
    if (results.length === 0) {
      const uddgSimple = html.matchAll(/uddg=([^"&]+)/g)
      for (const match of uddgSimple) {
        try {
          const url = decodeURIComponent(match[1])
          results.push({ url, title: '', snippet: '' })
          if (results.length >= 15) break
        } catch {}
      }
    }

    console.log(`[ddg] query="${query}" → ${results.length} résultats`)
    return results
  } catch (err: any) {
    clearTimeout(t)
    console.warn(`[ddg] erreur: ${err.message}`)
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
      await new Promise(r => setTimeout(r, 500)) // anti rate-limit DDG
      const query = `${kw} ${z} site:facebook.com`
      const results = await searchDDG(query)

      for (const result of results) {
        if (!isFbBusinessUrl(result.url)) continue
        const cleanUrl = cleanFbUrl(result.url)
        if (seen.has(cleanUrl)) continue
        seen.add(cleanUrl)

        const nom = result.title
          .replace(/\s*[\|—\-–]\s*Facebook\s*$/i, '')
          .replace(/\s*\|.*$/, '')
          .trim() || cleanUrl.split('/').pop() || 'Page Facebook'

        leads.push({
          nom,
          facebook_url : cleanUrl,
          description  : result.snippet.slice(0, 300) || null,
          ville        : z !== 'France' ? z : null,
          source       : 'facebook_pages',
          pays         : 'France',
        })
      }
    }
  }

  console.log(`[facebook] ${leads.length} leads extraits`)
  return new Response(JSON.stringify({ leads, total: leads.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
