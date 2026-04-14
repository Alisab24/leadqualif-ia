import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

// ──────────────────────────────────────
// Limites par plan
// ──────────────────────────────────────
export const PLAN_LIMITS = {
  free: {
    leads_per_month: 10, docs: false, stats: false, ia: false, multiUsers: false, maxUsers: 1,
    canUseAgentIA: false, canUseBookingAuto: false, canUseAnalytics: false,
    canUseWhatsAppSerie: false, canUseReports: false, canUseTeam: false,
    canUseWhiteLabel: false, canUseMultiAgency: false,
  },
  starter: {
    leads_per_month: 300, docs: true, stats: false, ia: false, multiUsers: false, maxUsers: 1,
    canUseAgentIA: false, canUseBookingAuto: false, canUseAnalytics: false,
    canUseWhatsAppSerie: false, canUseReports: false, canUseTeam: false,
    canUseWhiteLabel: false, canUseMultiAgency: false,
  },
  growth: {
    leads_per_month: 1000, docs: true, stats: true, ia: true, multiUsers: true, maxUsers: 5,
    canUseAgentIA: true, canUseBookingAuto: true, canUseAnalytics: true,
    canUseWhatsAppSerie: true, canUseReports: true, canUseTeam: true,
    canUseWhiteLabel: false, canUseMultiAgency: false,
  },
  enterprise: {
    leads_per_month: null, docs: true, stats: true, ia: true, multiUsers: true, maxUsers: null,
    canUseAgentIA: true, canUseBookingAuto: true, canUseAnalytics: true,
    canUseWhatsAppSerie: true, canUseReports: true, canUseTeam: true,
    canUseWhiteLabel: true, canUseMultiAgency: true,
  },
  trialing: {
    leads_per_month: null, docs: true, stats: true, ia: true, multiUsers: true, maxUsers: 5,
    canUseAgentIA: true, canUseBookingAuto: true, canUseAnalytics: true,
    canUseWhatsAppSerie: true, canUseReports: true, canUseTeam: true,
    canUseWhiteLabel: false, canUseMultiAgency: false,
  },
}

export const PLAN_LABELS = {
  free:       '🆓 Gratuit',
  starter:    '🚀 Solo',
  growth:     '⭐ Agence',
  enterprise: '🏢 Expert',
  trialing:   '🎯 Essai gratuit',
}

export const PLAN_PRICES = {
  starter:    '79 €/mois',    // Solo
  growth:     '149 €/mois',  // Agence
  enterprise: 'Sur devis',   // Expert
}

export const PLAN_ANNUAL_PRICES = {
  starter:    '63 €/mois',   // facturé 756 €/an
  growth:     '119 €/mois',  // facturé 1 428 €/an
  enterprise: 'Sur devis',
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
        .select('subscription_plan, subscription_status, subscription_current_period_end, stripe_subscription_id, agency_id, plan, role')
        .eq('user_id', user.id)
        .single()

      if (!p) { setLoading(false); return }
      setProfile(p)

      // ── Héritage de plan pour les membres invités ──────────────────────────
      // Un membre a : role != 'owner' OU agency_id != user.id
      // Dans ce cas, on lit l'abonnement du propriétaire de l'agence
      let planSource = p  // par défaut : profil de l'utilisateur courant
      const isMember = p.role && p.role !== 'owner'
      const hasOwnerAgency = p.agency_id && p.agency_id !== user.id

      if (isMember || hasOwnerAgency) {
        const ownerAgencyId = p.agency_id
        if (ownerAgencyId) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('subscription_plan, subscription_status, subscription_current_period_end, stripe_subscription_id, plan')
            .eq('user_id', ownerAgencyId)
            .single()

          if (ownerProfile) {
            planSource = { ...ownerProfile, agency_id: p.agency_id }
          }
        }
      }

      // Résoudre le plan effectif
      let effectivePlan   = planSource.subscription_plan || planSource.plan || 'free'
      let effectiveStatus = planSource.subscription_status || 'inactive'

      // Normaliser les anciens noms de plans
      if (effectivePlan === 'pro')    effectivePlan = 'growth'
      if (effectivePlan === 'agency') effectivePlan = 'enterprise'

      // Détecter un essai expiré côté client (webhook Stripe pas encore reçu)
      // Si le statut est encore "trialing" mais que la date de fin est passée,
      // on force le statut à "inactive" pour afficher le mur d'abonnement.
      const periodEnd = planSource.subscription_current_period_end
      if (effectiveStatus === 'trialing' && periodEnd && new Date(periodEnd) < new Date()) {
        effectiveStatus = 'inactive'
      }

      // Si statut trialing (essai toujours actif) → accès Growth complet
      if (effectiveStatus === 'trialing') effectivePlan = 'trialing'

      // Si inactive/canceled → forcer le plan free
      // (on ne vérifie plus stripe_subscription_id ici : la détection de l'essai
      //  expiré ci-dessus suffit à distinguer "jamais abonné" de "abonnement terminé")
      if (['inactive', 'canceled'].includes(effectiveStatus)) {
        effectivePlan = 'free'
      }

      setUserPlan(effectivePlan)
      setStatus(effectiveStatus)

      // Date de fin de période (essai ou abonnement)
      if (planSource.subscription_current_period_end) {
        setTrialEnd(new Date(planSource.subscription_current_period_end))
      }

      // Compteur leads du mois (seulement pour les plans limités)
      if (['free', 'starter', 'growth'].includes(effectivePlan) && p.agency_id) {
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
      case 'docs':               return limits.docs
      case 'stats':              return limits.stats
      case 'ia':                 return limits.ia
      case 'multiUsers':         return limits.multiUsers
      case 'addLead':            return canAddLead()
      case 'agentIA':            return limits.canUseAgentIA
      case 'bookingAuto':        return limits.canUseBookingAuto
      case 'analytics':          return limits.canUseAnalytics
      case 'whatsappSerie':      return limits.canUseWhatsAppSerie
      case 'reports':            return limits.canUseReports
      case 'team':               return limits.canUseTeam
      case 'whiteLabel':         return limits.canUseWhiteLabel
      case 'multiAgency':        return limits.canUseMultiAgency
      default:                   return true
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
  const { status, trialDaysLeft, trialEnd } = usePlanGuard()

  // Essai expiré : statut repassé à inactive/free mais une date de fin existe dans le passé
  const isExpired = status !== 'trialing' && trialEnd && new Date(trialEnd) < new Date()
  const isTrialing = status === 'trialing'

  if (!isTrialing && !isExpired) return null

  const days = isTrialing ? trialDaysLeft() : 0

  // ── Essai expiré ──────────────────────────────────────────────
  if (isExpired) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-lg mb-4 shadow-sm bg-red-50 border border-red-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">🔴</span>
          <span className="font-semibold text-red-700">
            Votre période d'essai est terminée — accès limité
          </span>
        </div>
        <button
          onClick={() => window.location.href = '/settings?tab=abonnement'}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
        >
          Choisir un plan →
        </button>
      </div>
    )
  }

  // ── Essai actif : ≤ 7 jours (orange) ─────────────────────────
  if (days !== null && days <= 7) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-lg mb-4 shadow-sm bg-orange-50 border border-orange-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">⚠️</span>
          <span className="font-medium text-orange-700">
            {days === 0
              ? "Votre essai se termine aujourd'hui — choisissez un plan pour continuer"
              : `Plus que ${days} jour${days > 1 ? 's' : ''} d'essai ! Choisissez votre plan pour ne pas perdre vos données.`
            }
          </span>
        </div>
        <button
          onClick={() => window.location.href = '/settings?tab=abonnement'}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-orange-600 text-white hover:bg-orange-700 whitespace-nowrap"
        >
          Continuer sans interruption →
        </button>
      </div>
    )
  }

  // ── Essai actif : > 7 jours (bleu) ───────────────────────────
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg mb-4 shadow-sm bg-blue-50 border border-blue-200">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">🎉</span>
        <span className="font-medium text-blue-700">
          {days === null
            ? 'Période d\'essai — toutes les fonctionnalités débloquées gratuitement'
            : `Période d'essai — Il vous reste ${days} jour${days > 1 ? 's' : ''} pour explorer toutes les fonctionnalités`
          }
        </span>
      </div>
      <button
        onClick={() => window.location.href = '/settings?tab=abonnement'}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
      >
        Voir les offres →
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
              ? 'Passez au plan Agence (1 000 leads/mois) ou achetez des crédits leads'
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
          Passer au plan Agence →
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
            {messages[feature] || messages.default} — à partir de 79 €/mois
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

// Quel plan minimum est requis pour chaque feature
const FEATURE_REQUIRED_PLAN = {
  docs:           { name: 'Solo',   key: 'starter'    },
  stats:          { name: 'Agence', key: 'growth'     },
  ia:             { name: 'Agence', key: 'growth'     },
  multiUsers:     { name: 'Agence', key: 'growth'     },
  agentIA:        { name: 'Agence', key: 'growth'     },
  bookingAuto:    { name: 'Agence', key: 'growth'     },
  analytics:      { name: 'Agence', key: 'growth'     },
  whatsappSerie:  { name: 'Agence', key: 'growth'     },
  reports:        { name: 'Agence', key: 'growth'     },
  team:           { name: 'Agence', key: 'growth'     },
  whiteLabel:     { name: 'Expert', key: 'enterprise' },
  multiAgency:    { name: 'Expert', key: 'enterprise' },
}

// Mode : 'blur' (overlay flou) | 'banner' (bannière en haut) | 'hide' (cache le contenu)
export function FeatureGate({ feature, children, fallback, mode = 'blur' }) {
  const { canAccess, loading, userPlan } = usePlanGuard()

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-xl h-24 w-full" />
  }

  if (!canAccess(feature)) {
    if (fallback) return fallback

    const required = FEATURE_REQUIRED_PLAN[feature]
    const planName = required?.name || 'supérieur'

    if (mode === 'hide') return null

    if (mode === 'banner') {
      return (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <span className="text-3xl mb-3 block">🔒</span>
          <p className="font-bold text-slate-700 text-base mb-1">Fonctionnalité réservée au plan {planName}</p>
          <p className="text-sm text-slate-500 mb-4">Passez au plan {planName} pour débloquer cette section et bien plus encore.</p>
          <button
            onClick={() => window.location.href = '/settings?tab=facturation'}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            Débloquer le plan {planName} →
          </button>
          <p className="text-xs text-slate-400 mt-3">14 jours gratuits · Sans carte bancaire · Annulation à tout moment</p>
        </div>
      )
    }

    // mode = 'blur' (défaut)
    return (
      <div className="relative w-full rounded-xl overflow-hidden">
        <div className="opacity-30 pointer-events-none select-none blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-xl">
          <span className="text-3xl mb-2">🔒</span>
          <p className="text-sm font-bold text-slate-700 mb-1">Plan {planName} requis</p>
          <p className="text-xs text-slate-500 mb-3 text-center px-8">
            Cette fonctionnalité est disponible à partir du plan {planName}.
          </p>
          <button
            onClick={() => window.location.href = '/settings?tab=facturation'}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Débloquer →
          </button>
          <p className="text-xs text-slate-400 mt-2">14 jours offerts · Sans carte bancaire</p>
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
