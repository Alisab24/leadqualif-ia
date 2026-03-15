import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

// ──────────────────────────────────────
// Limites par plan
// ──────────────────────────────────────
export const PLAN_LIMITS = {
  free:       { leads_per_month: 10,   docs: false, stats: false, ia: false, multiUsers: false, maxUsers: 1 },
  starter:    { leads_per_month: 100,  docs: true,  stats: false, ia: false, multiUsers: true,  maxUsers: 3 },
  growth:     { leads_per_month: null, docs: true,  stats: true,  ia: true,  multiUsers: true,  maxUsers: 5 },
  enterprise: { leads_per_month: null, docs: true,  stats: true,  ia: true,  multiUsers: true,  maxUsers: null },
  trialing:   { leads_per_month: null, docs: true,  stats: true,  ia: true,  multiUsers: true,  maxUsers: 5 },
}

export const PLAN_LABELS = {
  free:       '🆓 Gratuit',
  starter:    '🚀 Starter',
  growth:     '⭐ Growth',
  enterprise: '🏢 Enterprise',
  trialing:   '🎯 Essai gratuit',
}

export const PLAN_PRICES = {
  starter:    '49 €/mois',     // Solo
  growth:     '149 €/mois',   // Agence
  enterprise: '399 €/mois',   // Expert
}

export const PLAN_ANNUAL_PRICES = {
  starter:    '39 €/mois',    // facturé 468 €/an
  growth:     '119 €/mois',   // facturé 1 428 €/an
  enterprise: '319 €/mois',   // facturé 3 828 €/an
}

// ──────────────────────────────────────
// Hook principal usePlanGuard
// ──────────────────────────────────────
export function usePlanGuard() {
  const [profile, setProfile]               = useState(null)
  const [userPlan, setUserPlan]             = useState('free')
  const [status, setStatus]                 = useState('inactive')
  const [trialEnd, setTrialEnd]             = useState(null)
  const [leadsThisMonth, setLeadsThisMonth] = useState(0)
  const [loading, setLoading]               = useState(true)

  const fetchPlanData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // subscription_plan est mis à jour par le webhook Stripe
      const { data: p } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status, subscription_current_period_end, stripe_subscription_id, agency_id, plan')
        .eq('user_id', user.id)
        .single()

      if (!p) { setLoading(false); return }
      setProfile(p)

      // Résoudre le plan effectif
      let effectivePlan   = p.subscription_plan || p.plan || 'free'
      let effectiveStatus = p.subscription_status || 'inactive'

      // Normaliser les anciens noms de plans
      if (effectivePlan === 'pro')    effectivePlan = 'growth'
      if (effectivePlan === 'agency') effectivePlan = 'enterprise'

      // Si statut trialing → accès Growth pendant l'essai
      if (effectiveStatus === 'trialing') effectivePlan = 'trialing'

      // Si inactive/canceled sans plan actif → forcer free
      if (['inactive', 'canceled'].includes(effectiveStatus) && !p.stripe_subscription_id) {
        effectivePlan = 'free'
      }

      setUserPlan(effectivePlan)
      setStatus(effectiveStatus)

      // Date de fin de période (essai ou abonnement)
      if (p.subscription_current_period_end) {
        setTrialEnd(new Date(p.subscription_current_period_end))
      }

      // Compteur leads du mois (seulement pour les plans limités)
      if (['free', 'starter'].includes(effectivePlan) && p.agency_id) {
        const start = new Date()
        start.setDate(1)
        start.setHours(0, 0, 0, 0)

        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', p.agency_id)
          .gte('created_at', start.toISOString())

        setLeadsThisMonth(count || 0)
      }
    } catch (err) {
      console.error('[PlanGuard]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlanData() }, [fetchPlanData])

  // ── Accès aux features ──
  const canAccess = (feature) => {
    const limits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free
    switch (feature) {
      case 'docs':       return limits.docs
      case 'stats':      return limits.stats
      case 'ia':         return limits.ia
      case 'multiUsers': return limits.multiUsers
      case 'addLead':    return canAddLead()
      default:           return true
    }
  }

  // ── Peut-on ajouter un lead ? ──
  const canAddLead = () => {
    const limit = PLAN_LIMITS[userPlan]?.leads_per_month
    if (limit === null || limit === undefined) return true
    return leadsThisMonth < limit
  }

  // ── Jours d'essai restants ──
  const trialDaysLeft = () => {
    if (status !== 'trialing' || !trialEnd) return null
    const diff = trialEnd - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  // ── % du quota leads utilisé ──
  const leadsUsagePercent = () => {
    const limit = PLAN_LIMITS[userPlan]?.leads_per_month
    if (!limit) return null
    return Math.min(100, Math.round((leadsThisMonth / limit) * 100))
  }

  return {
    profile,
    userPlan,
    status,
    loading,
    trialEnd,
    leadsThisMonth,
    canAccess,
    canAddLead,
    trialDaysLeft,
    leadsUsagePercent,
    refreshPlan: fetchPlanData,
    isActive: ['active', 'trialing'].includes(status),
  }
}

// ──────────────────────────────────────
// Bannière : Essai gratuit en cours
// ──────────────────────────────────────
export function TrialBanner() {
  const { status, trialDaysLeft } = usePlanGuard()
  if (status !== 'trialing') return null

  const days   = trialDaysLeft()
  const urgent = days !== null && days <= 3

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-4 shadow-sm ${urgent ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">{urgent ? '⏰' : '🎯'}</span>
        <span className={`font-medium ${urgent ? 'text-orange-700' : 'text-blue-700'}`}>
          {days === null
            ? 'Essai gratuit actif — toutes les fonctionnalités débloquées'
            : days === 0
            ? 'Votre essai se termine aujourd\'hui'
            : `Essai gratuit : ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`
          }
        </span>
      </div>
      <button
        onClick={() => window.location.href = '/settings?tab=facturation'}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${urgent ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
      >
        {urgent ? 'Continuer sans interruption →' : 'Choisir un plan →'}
      </button>
    </div>
  )
}

// ──────────────────────────────────────
// Bannière : Quota leads Starter / Free
// ──────────────────────────────────────
export function LeadQuotaBanner() {
  const { userPlan, leadsThisMonth, leadsUsagePercent, canAddLead } = usePlanGuard()

  const limit = PLAN_LIMITS[userPlan]?.leads_per_month
  if (!limit) return null

  const percent  = leadsUsagePercent()
  const isFull   = !canAddLead()

  if (percent < 80) return null

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-4 border ${isFull ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{isFull ? '🚫' : '⚠️'}</span>
        <div>
          <p className={`text-sm font-semibold ${isFull ? 'text-red-700' : 'text-amber-700'}`}>
            {isFull
              ? `Quota atteint — ${leadsThisMonth}/${limit} leads ce mois`
              : `${leadsThisMonth}/${limit} leads utilisés ce mois (${percent}%)`
            }
          </p>
          <p className={`text-xs mt-0.5 ${isFull ? 'text-red-500' : 'text-amber-500'}`}>
            {isFull
              ? 'Passez au plan Growth pour des leads illimités'
              : `Il vous reste ${limit - leadsThisMonth} leads pour ce mois`
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block w-32 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-amber-400'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <button
          onClick={() => window.location.href = '/settings?tab=facturation'}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${isFull ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
        >
          Passer au Growth →
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────
// Bannière : Plan Free (upgrade générique)
// ──────────────────────────────────────
export function UpgradeBanner({ feature } = {}) {
  const { userPlan } = usePlanGuard()
  if (userPlan !== 'free') return null

  const messages = {
    docs:    'Générez des devis, factures et mandats professionnels',
    stats:   'Accédez aux statistiques avancées et rapports',
    ia:      'Débloquez la qualification IA et les suggestions automatiques',
    default: 'Débloquez toutes les fonctionnalités premium',
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg shadow-md mb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚀</span>
          <span className="text-sm font-medium">
            {messages[feature] || messages.default} — à partir de 49 €/mois
          </span>
        </div>
        <button
          onClick={() => window.location.href = '/settings?tab=facturation'}
          className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-50 whitespace-nowrap transition-colors"
        >
          Voir les offres →
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────
// FeatureGate — verrouiller un composant selon le plan
// ──────────────────────────────────────
export function FeatureGate({ feature, children, fallback }) {
  const { canAccess, loading, userPlan } = usePlanGuard()

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-8 w-32" />
  }

  if (!canAccess(feature)) {
    if (fallback) return fallback

    return (
      <div className="relative w-full">
        <div className="opacity-40 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-lg border border-dashed border-gray-300">
          <span className="text-2xl mb-1">🔒</span>
          <span className="text-xs font-semibold text-gray-600 mb-2">
            {feature === 'stats' || feature === 'ia' ? 'Plan Growth requis' : 'Plan Starter requis'}
          </span>
          <button
            onClick={() => window.location.href = '/settings?tab=facturation'}
            className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full hover:bg-indigo-700 transition-colors"
          >
            Débloquer →
          </button>
        </div>
      </div>
    )
  }

  return children
}

// ──────────────────────────────────────
// AddLeadGate — bloquer la création de lead si quota atteint
// ──────────────────────────────────────
export function AddLeadGate({ children, onBlocked }) {
  const { canAddLead, userPlan, leadsThisMonth } = usePlanGuard()
  const limit = PLAN_LIMITS[userPlan]?.leads_per_month

  if (!canAddLead()) {
    const handleClick = () => {
      if (onBlocked) {
        onBlocked()
      } else {
        window.location.href = '/settings?tab=facturation'
      }
    }

    return (
      <div onClick={handleClick} className="cursor-pointer" title={`Quota atteint : ${leadsThisMonth}/${limit} leads ce mois`}>
        <div className="pointer-events-none opacity-60">{children}</div>
      </div>
    )
  }

  return children
}
