/**
 * RoleGate — Contrôle d'accès par rôle utilisateur
 *
 * Charge le rôle depuis Supabase AVANT de monter la page enfant.
 * Si le rôle est insuffisant → affiche une page "Accès réservé" propre
 * au lieu de laisser la page crasher et déclencher ErrorBoundary.
 *
 * Usage dans App.jsx :
 *   <Route path="/stats"   element={<RoleGate allowed={['owner','admin']}><Stats /></RoleGate>} />
 *   <Route path="/scraper" element={<RoleGate allowed={['owner','admin','agent']}><ScraperPage /></RoleGate>} />
 */
import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// ─── Page "Accès réservé" ────────────────────────────────────────────────────
export function AccessDeniedPage({ reason = 'role' }) {
  const isRole = reason === 'role'

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <span className="text-5xl mb-5 block">{isRole ? '🔒' : '🚀'}</span>

        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {isRole ? 'Accès non autorisé' : 'Fonctionnalité Premium'}
        </h2>

        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          {isRole
            ? 'Cette section n\'est pas accessible avec votre rôle actuel. Contactez l\'administrateur de votre agence pour obtenir les droits nécessaires.'
            : 'Cette fonctionnalité est réservée aux plans supérieurs. Mettez à niveau votre abonnement pour y accéder.'}
        </p>

        <div className="flex flex-col gap-2">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            ← Retour au tableau de bord
          </a>
          {!isRole && (
            <a
              href="/settings?tab=facturation"
              className="inline-flex items-center justify-center gap-2 border border-indigo-200 text-indigo-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors"
            >
              Voir les offres →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Composant RoleGate ──────────────────────────────────────────────────────
/**
 * @param {string[]} allowed  - Rôles autorisés, ex: ['owner','admin']
 * @param {React.ReactNode} children - Page à afficher si accès OK
 */
export default function RoleGate({ allowed = ['owner', 'admin', 'agent', 'viewer'], children }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'allowed' | 'denied'

  useEffect(() => {
    let cancelled = false

    async function checkRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setStatus('allowed') // PrivateRoute gère déjà le cas non-authentifié
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return

        // Si pas de profil ou pas de rôle → accès par défaut (owner historique)
        const role = profile?.role || 'owner'
        const isAllowed = allowed.includes(role)
        setStatus(isAllowed ? 'allowed' : 'denied')
      } catch (err) {
        console.error('[RoleGate] erreur:', err)
        if (!cancelled) setStatus('allowed') // fail-open : ne pas bloquer sur erreur réseau
      }
    }

    checkRole()
    return () => { cancelled = true }
  }, [allowed.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Chargement : spinner discret (même style que PrivateRoute)
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // Accès refusé
  if (status === 'denied') {
    return <AccessDeniedPage reason="role" />
  }

  // Accès accordé → on monte la page normalement
  return children
}
