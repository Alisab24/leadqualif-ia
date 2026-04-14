import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { redirectToCheckout } from '../services/stripeService'

/**
 * UpgradeModal — modale déclenchée quand un utilisateur Solo
 * tente d'accéder à une fonctionnalité réservée au plan Agence ou Expert.
 *
 * Usage :
 *   const [showUpgrade, setShowUpgrade] = useState(false)
 *   <UpgradeModal
 *     isOpen={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     feature="Agent IA"          // optionnel — nom de la feature bloquée
 *     targetPlan="growth"         // 'growth' (défaut) | 'enterprise'
 *   />
 */
export default function UpgradeModal({
  isOpen,
  onClose,
  feature = null,
  targetPlan = 'growth',
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  if (!isOpen) return null

  const isExpert = targetPlan === 'enterprise'

  const AGENCE_FEATURES = [
    { icon: '🤖', label: 'Agent IA de qualification automatique' },
    { icon: '📅', label: 'Booking automatique IA (Calendly-like)' },
    { icon: '📊', label: 'Analytics avancés & rapports' },
    { icon: '📲', label: 'Séries WhatsApp automatisées' },
    { icon: '👥', label: "Gestion d'équipe (5 utilisateurs)" },
    { icon: '📥', label: 'Inbox unifiée multi-canaux' },
    { icon: '📂', label: 'Leads illimités (jusqu\'à 1 000/mois)' },
  ]

  const EXPERT_FEATURES = [
    ...AGENCE_FEATURES,
    { icon: '🏷️', label: 'White-label (votre marque)' },
    { icon: '🏢', label: 'Multi-agences illimitées' },
    { icon: '♾️', label: 'Volume de leads illimité' },
    { icon: '🛡️', label: 'SLA & support prioritaire' },
  ]

  const features = isExpert ? EXPERT_FEATURES : AGENCE_FEATURES

  const planLabel = isExpert ? 'Expert' : 'Agence'
  const planPrice = isExpert ? 'Sur devis' : '149 €/mois'
  const planKey   = isExpert ? 'enterprise' : 'growth'

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Vous devez être connecté')

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_name')
        .eq('user_id', user.id)
        .single()

      const result = await redirectToCheckout({
        plan: planKey,
        userId: user.id,
        userEmail: user.email,
        agencyName: profile?.agency_name || '',
      })

      if (!result.success) throw new Error(result.error)
    } catch (err) {
      setError(err.message || 'Erreur lors de la redirection Stripe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header gradient */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔒</span>
            <h2 className="text-xl font-bold">Fonctionnalité {planLabel}</h2>
          </div>
          <p className="text-indigo-100 text-sm">
            {feature
              ? `"${feature}" est disponible à partir du plan ${planLabel}.`
              : `Cette fonctionnalité est disponible à partir du plan ${planLabel}.`
            }
          </p>
        </div>

        {/* Features list */}
        <div className="px-6 py-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Avec le plan <span className="text-indigo-600">{planLabel}</span> vous débloquez :
          </p>
          <ul className="space-y-2">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                <span className="text-base w-5 flex-shrink-0">{f.icon}</span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {isExpert ? (
            <a
              href="/settings?tab=abonnement"
              onClick={onClose}
              className="w-full text-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Contacter l'équipe pour un devis →
            </a>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Redirection…
                </>
              ) : (
                `Passer au plan Agence — ${planPrice}`
              )}
            </button>
          )}

          <button
            onClick={() => { onClose(); window.location.href = '/settings?tab=abonnement' }}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
          >
            Voir tous les plans →
          </button>

          <p className="text-center text-xs text-gray-400">
            14 jours gratuits • Sans engagement • Annulation à tout moment
          </p>
        </div>
      </div>
    </div>
  )
}
