import { usePlanGuard } from '../components/PlanGuard'

/**
 * usePlan — hook simplifié pour accéder aux droits du plan courant
 *
 * Usage :
 *   const { canUseAgentIA, isTrialing, trialDaysLeft, isPro } = usePlan()
 */
export function usePlan() {
  const {
    userPlan,
    status,
    loading,
    trialEnd,
    leadsThisMonth,
    canAddLead,
    leadsUsagePercent,
    refreshPlan,
  } = usePlanGuard()

  // ── Calcul des jours d'essai restants ───────────────────────────────────
  const trialDaysLeft = () => {
    if (status !== 'trialing' || !trialEnd) return null
    const diff = trialEnd - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const isTrialing = status === 'trialing'
  const isPro      = ['growth', 'enterprise', 'trialing'].includes(userPlan)
  const isExpert   = userPlan === 'enterprise'
  const isSolo     = userPlan === 'starter'
  const isAgence   = userPlan === 'growth'

  // ── Limites du plan ──────────────────────────────────────────────────────
  const leadsLimit = isSolo ? 300 : isAgence ? 1000 : isTrialing ? Infinity : 10
  const usersLimit = isSolo ? 1   : isAgence ? 5    : isExpert   ? Infinity : 1

  // ── Feature flags ────────────────────────────────────────────────────────
  const canUseAgentIA        = isPro
  const canUseBookingAuto    = isPro
  const canUseAnalytics      = isPro
  const canUseWhatsAppSerie  = isPro
  const canUseReports        = isPro
  const canUseTeam           = isPro
  const canUseWhiteLabel     = isExpert
  const canUseMultiAgency    = isExpert
  const canUseUnlimitedVolume = isExpert

  return {
    // Plan courant
    plan:      userPlan,
    status,
    loading,

    // Identité du plan
    isSolo,
    isAgence,
    isExpert,
    isPro,
    isTrialing,

    // Essai
    trialDaysLeft,
    trialEnd,

    // Leads
    leadsLimit,
    leadsThisMonth,
    canAddLead,
    leadsUsagePercent,

    // Utilisateurs
    usersLimit,

    // Feature flags
    canUseAgentIA,
    canUseBookingAuto,
    canUseAnalytics,
    canUseWhatsAppSerie,
    canUseReports,
    canUseTeam,
    canUseWhiteLabel,
    canUseMultiAgency,
    canUseUnlimitedVolume,

    // Utils
    refreshPlan,
  }
}

export default usePlan
