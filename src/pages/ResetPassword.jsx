import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Zap, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const navigate = useNavigate()

  // Supabase envoie le token de récupération dans le hash de l'URL
  // Il est automatiquement capté par onAuthStateChange avec l'event PASSWORD_RECOVERY
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
        setCheckingSession(false)
      } else if (event === 'SIGNED_IN' && session) {
        // Déjà authentifié via le lien magique
        setValidSession(true)
        setCheckingSession(false)
      }
    })

    // Timeout si l'event ne se déclenche pas (lien expiré ou invalide)
    const timeout = setTimeout(() => {
      setCheckingSession(false)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/app'), 3000)
    }
  }

  // Chargement initial
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Vérification du lien...</p>
        </div>
      </div>
    )
  }

  // Lien invalide ou expiré
  if (!validSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Lien invalide ou expiré</h2>
          <p className="text-slate-500 text-sm mb-6">
            Ce lien de réinitialisation n'est plus valide. Veuillez en demander un nouveau.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full opacity-5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">LeadQualif IA</h1>
          <p className="text-slate-400 text-sm">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!success ? (
            <>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Nouveau mot de passe</h2>
              <p className="text-slate-500 text-sm mb-6">Choisissez un nouveau mot de passe sécurisé.</p>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 caractères"
                      className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmer le mot de passe"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Indicateur de force */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                          password.length >= i * 3
                            ? password.length >= 10 ? 'bg-green-500' : password.length >= 7 ? 'bg-yellow-500' : 'bg-red-400'
                            : 'bg-slate-200'
                        }`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      {password.length < 6 ? 'Trop court' : password.length < 8 ? 'Acceptable' : password.length < 10 ? 'Bon' : '✅ Excellent'}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirmPassword}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement...</>
                    : 'Enregistrer le nouveau mot de passe'
                  }
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Mot de passe mis à jour !</h2>
              <p className="text-slate-500 text-sm mb-1">Votre mot de passe a été réinitialisé avec succès.</p>
              <p className="text-slate-400 text-xs">Redirection vers votre dashboard dans 3 secondes...</p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          © 2025 LeadQualif · <a href="https://nexapro.tech" className="hover:text-slate-300">NexaPro</a>
        </p>
      </div>
    </div>
  )
}
