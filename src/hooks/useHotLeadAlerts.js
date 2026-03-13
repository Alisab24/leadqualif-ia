/**
 * useHotLeadAlerts
 * ─────────────────────────────────────────────────────────────────────────────
 * S'abonne en temps réel aux nouveaux leads via Supabase Realtime.
 * Quand un lead avec score ≥ 70 (ou niveau_interet = 'chaud') est inséré :
 *   1. Affiche une notification browser (si permission accordée)
 *   2. Appelle le webhook configuré dans le profil agence (notification_webhook)
 *   3. Stocke l'alerte dans la table lead_alerts pour éviter les doublons
 *
 * Usage :
 *   useHotLeadAlerts(agencyId, profile)
 */

import { useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const HOT_SCORE_THRESHOLD = 70

function isHotLead(lead) {
  const score = lead.score || lead.score_ia || lead.score_qualification || 0
  const niveau = (lead.niveau_interet || '').toLowerCase()
  return score >= HOT_SCORE_THRESHOLD || niveau === 'chaud'
}

async function hasAlreadyAlerted(leadId) {
  try {
    const { data } = await supabase
      .from('lead_alerts')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

async function markAlerted(leadId, agencyId) {
  try {
    await supabase
      .from('lead_alerts')
      .insert([{ lead_id: leadId, agency_id: agencyId }])
  } catch { /* silencieux si la table n'existe pas encore */ }
}

async function requestBrowserPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission()
    return result === 'granted'
  }
  return false
}

function showBrowserNotification(lead) {
  if (Notification.permission !== 'granted') return
  const score = lead.score || lead.score_ia || 0
  const title = `🔥 Lead chaud — ${lead.nom || 'Nouveau prospect'}`
  const body = [
    score > 0 ? `Score : ${score}/100` : '',
    lead.budget ? `Budget : ${Number(lead.budget).toLocaleString('fr-FR')} €` : '',
    lead.budget_marketing ? `Budget marketing : ${lead.budget_marketing}` : '',
    `Source : ${lead.source || 'formulaire'}`,
  ].filter(Boolean).join(' · ')

  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: `lead-${lead.id}` })
  } catch { /* silencieux */ }
}

async function callWebhook(webhookUrl, lead) {
  if (!webhookUrl) return
  try {
    const payload = {
      event:     'hot_lead',
      lead_id:   lead.id,
      nom:       lead.nom,
      email:     lead.email,
      telephone: lead.telephone,
      score:     lead.score || lead.score_ia || 0,
      source:    lead.source,
      budget:    lead.budget || lead.budget_marketing,
      statut:    lead.statut,
      created_at: lead.created_at,
      dashboard_url: `${window.location.origin}/lead/${lead.id}`,
    }
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (err) {
    console.warn('[useHotLeadAlerts] Webhook call failed:', err.message)
  }
}

export default function useHotLeadAlerts(agencyId, profileWebhook) {
  const webhookRef = useRef(profileWebhook)
  webhookRef.current = profileWebhook

  useEffect(() => {
    if (!agencyId) return

    // Demander la permission pour les notifications browser
    requestBrowserPermission()

    // S'abonner aux insertions sur la table leads
    const channel = supabase
      .channel(`hot-leads-${agencyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'leads',
          filter: `agency_id=eq.${agencyId}`,
        },
        async (payload) => {
          const lead = payload.new
          if (!lead || !isHotLead(lead)) return

          // Anti-doublon : vérifier si on a déjà alerté pour ce lead
          const alreadySent = await hasAlreadyAlerted(lead.id)
          if (alreadySent) return

          // Marquer comme alerté
          await markAlerted(lead.id, agencyId)

          // Notification browser
          showBrowserNotification(lead)

          // Webhook configurable
          if (webhookRef.current) {
            await callWebhook(webhookRef.current, lead)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agencyId])
}
