// LeadQualif Scraper Engine v3 — Enrichissement TikTok via SociaVault (~0.005$/profil)
// Deploy: npx supabase functions deploy enrich-tiktok
// Env: SOCIAVAULT_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SOCIAVAULT_KEY = Deno.env.get('SOCIAVAULT_API_KEY')

function extractTikTokUsername(url: string): string | null {
  const match = url.match(/tiktok\.com\/@([^/?]+)/)
  return match ? match[1] : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!SOCIAVAULT_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'SOCIAVAULT_API_KEY manquante — canal TikTok désactivé' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { tiktok_url } = await req.json()
  if (!tiktok_url) return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })

  const username = extractTikTokUsername(tiktok_url)
  if (!username) return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })

  try {
    const res = await fetch(`https://api.sociavault.com/v1/tiktok/profile?username=${username}`, {
      headers: {
        'Authorization': `Bearer ${SOCIAVAULT_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      console.warn(`[enrich-tiktok] HTTP ${res.status}`)
      return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })
    }

    const data = await res.json()
    const profile = data.data || data

    const emailMatch = (profile.bio_link || profile.signature || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)

    const enriched: Record<string, any> = {
      tiktok_url: `https://tiktok.com/@${username}`,
      instagram_data: {
        ...profile,
        platform: 'tiktok',
        username,
        followers: profile.follower_count || profile.fans,
        likes: profile.total_favorited || profile.heart,
        bio: (profile.signature || '').slice(0, 300),
        bio_link: profile.bio_link,
      },
    }
    if (emailMatch) enriched.email = emailMatch[0]
    if (profile.bio_link && !profile.bio_link.includes('tiktok')) {
      enriched.site_web = profile.bio_link
    }

    return new Response(JSON.stringify({ leads: [enriched] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[enrich-tiktok] Error:', err)
    return new Response(JSON.stringify({ leads: [] }), { status: 200, headers: corsHeaders })
  }
})
