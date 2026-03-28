// LeadQualif Scraper Engine v3 — Enrichissement site web (scraper maison, gratuit)
// Deploy: npx supabase functions deploy enrich-website
// Extrait : emails, réseaux sociaux, téléphone secondaire

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractEmails(html: string): string[] {
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(regex) || []
  // Filtrer les emails génériques/systems
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
  const linkedinMatch = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"?]+)/)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { site_web } = await req.json()

  if (!site_web) {
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    let url = site_web.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadQualif/3.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) {
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = await res.text()
    const emails = extractEmails(html)
    const phones = extractPhones(html)
    const socials = extractSocialLinks(html)
    const cms = detectCMS(html, res.headers)

    const enriched: Record<string, any> = {
      ...socials,
      cms,
    }
    if (emails.length > 0) enriched.email = emails[0]
    if (phones.length > 0) enriched.telephone_secondaire = phones[0]

    return new Response(JSON.stringify({ leads: [enriched], total: 1 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[enrich-website] Timeout: ${site_web}`)
    } else {
      console.error('[enrich-website] Error:', err)
    }
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
