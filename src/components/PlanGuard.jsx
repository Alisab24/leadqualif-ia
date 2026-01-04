import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// PlanGuard - Utilitaire pour gérer les restrictions selon le plan de l'utilisateur
export function usePlanGuard() {
  const [userPlan, setUserPlan] = useState('starter') // 'starter', 'pro', 'agency'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserPlan()
  }, [])

  const fetchUserPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserPlan('starter')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .single()

      const plan = profile?.plan || 'starter'
      setUserPlan(plan)
      console.log('Plan actuel de l\'utilisateur (PlanGuard) :', plan)
    } catch (error) {
      console.error('Erreur chargement plan utilisateur:', error)
      setUserPlan('starter')
    } finally {
      setLoading(false)
    }
  }

  const canAccess = (feature) => {
    switch (feature) {
      case 'stats':
        return userPlan === 'pro' || userPlan === 'agency'
      case 'templates':
        return userPlan === 'pro' || userPlan === 'agency'
      case 'multiUsers':
        return userPlan === 'agency'
      case 'customLogo':
        return userPlan === 'agency'
      case 'unlimitedDocs':
        return userPlan === 'pro' || userPlan === 'agency'
      default:
        return true
    }
  }

  const getPlanName = () => {
    switch (userPlan) {
      case 'starter': return 'Starter'
      case 'pro': return 'Pro'
      case 'agency': return 'Agency'
      default: return 'Starter'
    }
  }

  const getPlanColor = () => {
    switch (userPlan) {
      case 'starter': return 'text-gray-600'
      case 'pro': return 'text-blue-600'
      case 'agency': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  return {
    userPlan,
    loading,
    canAccess,
    getPlanName,
    getPlanColor,
    refreshPlan: fetchUserPlan
  }
}

// Composant de bannière d'upgrade
export function UpgradeBanner() {
  const { userPlan } = usePlanGuard()

  if (userPlan !== 'starter') return null

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg shadow-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚀</span>
          <span className="font-medium">
            Passez au plan PRO pour débloquer les statistiques et les templates illimités.
          </span>
        </div>
        <button 
          onClick={() => window.open('/pricing', '_blank')}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        >
          Voir les offres
        </button>
      </div>
    </div>
  )
}

// Composant de restriction pour les fonctionnalités
export function FeatureGate({ feature, children, fallback }) {
  const { canAccess, loading } = usePlanGuard()

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-8 w-32"></div>
  }

  if (!canAccess(feature)) {
    return fallback || (
      <div className="relative inline-block">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
            🔒 PRO
          </span>
        </div>
      </div>
    )
  }

  return children
}
