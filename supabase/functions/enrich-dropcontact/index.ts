// LeadQualif Scraper Engine v3 — Enrichissement Dropcontact (email + tél pro FR)
// Deploy: npx supabase functions deploy enrich-dropcontact
// Env: DROPCONTACT_API_KEY
// API async : POST /batch (submit) → GET /batch/{id} (poll jusqu'à completed)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_URL = 'https://api.dropcontact.com'

// ── Polling Dropcontact jusqu'à completion ──────────────────────────────────
// Dropcontact traite les contacts en ~3-15 secondes (asynchrone)
async function pollDropcontact(requestId: string): Promise<any> {
  const MAX_ATTEMPTS = 8
  const DELAY_MS     = 2500

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    // Attente progressive
    await new Promise(r => setTimeout(r, i === 0 ? 3000 : DELAY_MS))

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${BASE_URL}/batch/${requestId}`, {
        headers: { 'X-Access-Token': Deno.env.get('DROPCONTACT_API_KEY') || '' },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) continue
      const data = await res.json()

      if (data.error) {
        console.error('[Dropcontact] Poll error:', data.reason)
        return null
      }

      if (data.completed || (data.data && data.data.length > 0)) {
        return data
      }
    } catch (e: any) {
      console.warn(`[Dropcontact] Poll tentative ${i + 1} échouée:`, e.message)
    }
  }

  console.warn('[Dropcontact] Timeout polling — abandon après', MAX_ATTEMPTS, 'tentatives')
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const dropcontactKey = Deno.env.get('DROPCONTACT_API_KEY')
  if (!dropcontactKey) {
    console.warn('[Dropcontact] DROPCONTACT_API_KEY non configurée')
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const { prenom, nom, site_web, nom_entreprise } = body

  if (!nom && !site_web && !nom_entreprise) {
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── 1. Soumettre le batch ────────────────────────────────────────────────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const submitRes = await fetch(`${BASE_URL}/batch`, {
      method: 'POST',
      headers: {
        'X-Access-Token': dropcontactKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [{
          first_name: prenom || '',
          last_name:  nom    || '',
          website:    site_web || nom_entreprise || '',
        }],
        siren:    true,
        language: 'fr',
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    const submitData = await submitRes.json()

    if (submitData.error || !submitData.request_id) {
      console.error('[Dropcontact] Submit échoué:', submitData.reason || submitData)
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Dropcontact] Batch soumis: ${submitData.request_id}`)

    // ── 2. Polling jusqu'à completion ────────────────────────────────────────
    const result = await pollDropcontact(submitData.request_id)
    if (!result?.data?.[0]) {
      return new Response(JSON.stringify({ leads: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contact = result.data[0]
    const enriched: Record<string, any> = {}

    // Email : prendre le premier email "valid" ou le premier disponible
    const validEmail = contact.email?.find((e: any) => e.qualification === 'valid') || contact.email?.[0]
    if (validEmail?.email) enriched.email = validEmail.email

    // Téléphone pro
    const phone = contact.phone?.[0]?.number
    if (phone) enriched.telephone_secondaire = phone

    // LinkedIn
    if (contact.linkedin) enriched.linkedin_url = contact.linkedin

    // SIREN
    if (contact.company?.siren) enriched.siren = contact.company.siren

    console.log(`[Dropcontact] Enrichi: email=${enriched.email || '—'} tél=${enriched.telephone_secondaire || '—'}`)

    return new Response(JSON.stringify({ leads: [enriched], total: 1 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[Dropcontact] Fatal error:', err.message)
    return new Response(JSON.stringify({ leads: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
