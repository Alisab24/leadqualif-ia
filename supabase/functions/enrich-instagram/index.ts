// LeadQualif Scraper Engine v3 — Enrichissement Instagram via SociaVault (~0.005$/profil)
// Deploy: npx supabase functions deploy enrich-instagram
// Env: SOCIAVAULT_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SOCIAVAULT_KEY = Deno.env.get('SOCIAVAULT_API_KEY')

function extractInstagramUsername(url: string): string | null {
  const match = url.match(/instagram\.com\/([^/?]+)/)
  return match ? match[1] : null
}

function extractEmailFromBio(bio: string): string | null {
  const match = bio?.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!SOCIAVAULT_KEY) {
    return new Response(JSON.stringify({ leads: [], error: 'SOCIAVAULT_API_KEY manquante — canal Instagram désactivé' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { instagram_url } = await req.json()
  if (!instagram_url) {
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const username = extractInstagramUsername(instagram_url)
  if (!username) {
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch(`https://api.sociavault.com/v1/instagram/profile?username=${username}`, {
      headers: {
        'Authorization': `Bearer ${SOCIAVAULT_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      console.warn(`[enrich-instagram] HTTP ${res.status}`)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const profile = data.data || data

    const emailFromBio = extractEmailFromBio(profile.biography || profile.bio || '')

    const enriched: Record<string, any> = {
      instagram_url: `https://instagram.com/${username}`,
      instagram_data: {
        username,
        followers: profile.followers_count || profile.follower_count,
        following: profile.following_count,
        posts: profile.media_count,
        bio: (profile.biography || profile.bio || '').slice(0, 300),
        is_business: profile.is_business_account || profile.is_business,
        category: profile.category,
        external_url: profile.external_url,
      },
    }
    if (emailFromBio) enriched.email = emailFromBio
    if (profile.external_url && !profile.external_url.includes('instagram')) {
      enriched.site_web = profile.external_url
    }

    return new Response(JSON.stringify({ leads: [enriched] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[enrich-instagram] Error:', err)
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
