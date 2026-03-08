/**
 * AuthConfirm.jsx — Page de confirmation email Supabase
 *
 * Supabase redirige ici après clic sur le lien de confirmation :
 *   https://www.leadqualif.com/auth/confirm#access_token=...
 *   https://www.leadqualif.com/auth/confirm#error=access_denied&...
 *
 * La page lit le hash, échange le token contre une session,
 * puis redirige vers /dashboard (succès) ou affiche l'erreur.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AuthConfirm() {
  const navigate  = useNavigate()
  const [status, setStatus]   = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const hash   = window.location.hash   // #access_token=... ou #error=...
    const search = window.location.search // ?token_hash=...&type=signup (nouvelle API Supabase)

    /* ── Cas 1 : erreur explicite dans le hash ── */
    if (hash.includes('error')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const desc   = params.get('error_description') || 'Lien invalide ou expiré'
      setMessage(decodeURIComponent(desc.replace(/\+/g, ' ')))
      setStatus('error')
      return
    }

    /* ── Cas 2 : nouvelle API Supabase (token_hash dans la query string) ── */
    const qParams = new URLSearchParams(search)
    const tokenHash = qParams.get('token_hash')
    const type      = qParams.get('type')
    if (tokenHash && type) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        .then(({ error }) => {
          if (error) {
            setMessage(error.message || 'Lien invalide ou expiré.')
            setStatus('error')
          } else {
            setStatus('success')
            setTimeout(() => navigate('/dashboard', { replace: true }), 2500)
          }
        })
      return
    }

    /* ── Cas 3 : ancienne API (access_token dans le hash) ── */
    if (hash.includes('access_token')) {
      // Le SDK Supabase lit automatiquement le hash au getSession()
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (session) {
          setStatus('success')
          setTimeout(() => navigate('/dashboard', { replace: true }), 2500)
        } else {
          setMessage(error?.message || 'Session introuvable. Veuillez vous reconnecter.')
          setStatus('error')
        }
      })
      return
    }

    /* ── Cas 4 : aucun token dans l'URL (accès direct) ── */
    navigate('/login', { replace: true })
  }, [navigate])

  /* ─────────────── RENDU ─────────────── */

  if (status === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Validation de votre email…</p>
        <p className="text-slate-400 text-sm mt-1">Veuillez patienter quelques secondes</p>
      </div>
    </div>
  )

  if (status === 'success') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Email confirmé !</h1>
        <p className="text-slate-600 mb-6">
          Votre compte est activé. Vous êtes redirigé vers votre tableau de bord…
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      </div>
    </div>
  )

  // status === 'error'
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Lien expiré</h1>
        <p className="text-slate-600 mb-2">{message}</p>
        <p className="text-slate-400 text-sm mb-8">
          Les liens de confirmation expirent après 24h. Recréez un compte ou reconnectez-vous.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/signup')}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Créer un nouveau compte
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  )
}
