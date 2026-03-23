import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Zap, CheckCircle, ArrowRight } from 'lucide-react'

const PLAN_INFO = {
  starter: { label: 'Starter', price: '49€/mois', color: 'from-blue-500 to-blue-600', badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  growth:  { label: 'Growth',  price: '149€/mois', color: 'from-indigo-500 to-indigo-600', badge: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  enterprise: { label: 'Enterprise', price: 'Sur mesure', color: 'from-purple-500 to-purple-600', badge: 'bg-purple-50 border-purple-200 text-purple-700' },
}

const ERROR_MESSAGES = {
  'Invalid login credentials': 'Email ou mot de passe incorrect.',
  'Email not confirmed': 'Veuillez confirmer votre email avant de vous connecter.',
  'Too many requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'User not found': 'Aucun compte associé à cet email.',
}

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const returnTo    = searchParams.get('returnTo') || ''
  const inviteToken = searchParams.get('invite')   || null
  const planFromReturn = returnTo.match(/plan=([^&]+)/)?.[1]
  const planInfo = planFromReturn ? PLAN_INFO[planFromReturn] : null

  const signupLink = inviteToken
    ? `/signup?invite=${inviteToken}`
    : returnTo
      ? `/signup?returnTo=${searchParams.get('returnTo')}`
      : '/signup'

  // ── Appliquer une invitation sur un compte existant ──────────────
  const applyInvitationAfterLogin = async (userId, userEmail) => {
    if (!inviteToken) return
    try {
      // 1. Charger l'invitation par token
      const { data: inv, error: invErr } = await supabase
        .from('agency_invitations')
        .select('id, agency_id, role, email, status, expires_at')
        .eq('token', inviteToken)
        .maybeSingle()

      if (invErr || !inv) { console.warn('[Login] Invitation introuvable:', inviteToken); return }
      if (inv.status !== 'pending') { console.warn('[Login] Invitation déjà traitée:', inv.status); return }
      if (new Date(inv.expires_at) < new Date()) { console.warn('[Login] Invitation expirée'); return }

      // 2. Lire le profil actuel
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id, agency_id')
        .eq('user_id', userId)
        .maybeSingle()

      // Déjà lié à une autre agence → ne pas écraser
      const alreadyLinked = existing?.agency_id && existing.agency_id !== userId
      if (alreadyLinked) { console.log('[Login] Profil déjà lié à une agence'); return }

      // 3. Mettre à jour / créer le profil avec la bonne agency
      const profilePayload = {
        user_id:    userId,
        email:      userEmail,
        agency_id:  inv.agency_id,
        role:       inv.role || 'agent',
        nom_agence: '',
      }
      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert([profilePayload], { onConflict: 'user_id' })
      if (upsertErr) { console.error('[Login] Erreur upsert profil invitation:', upsertErr.message); return }

      // 4. Marquer l'invitation comme acceptée
      await supabase
        .from('agency_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', inv.id)

      console.log('[Login] Invitation appliquée avec succès → agency_id:', inv.agency_id)
    } catch (err) {
      console.error('[Login] applyInvitationAfterLogin:', err)
    }
  }

  // ── LOGIN ──────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const friendly = Object.entries(ERROR_MESSAGES).find(([k]) =>
        error.message.includes(k)
      )
      setError(friendly ? friendly[1] : error.message)
      setLoading(false)
    } else {
      // Si un token d'invitation est présent, l'appliquer avant de rediriger
      if (inviteToken && data?.user) {
        await applyInvitationAfterLogin(data.user.id, data.user.email)
      }
      navigate(returnTo ? decodeURIComponent(returnTo) : '/app')
    }
  }

  // ── MOT DE PASSE OUBLIÉ ──────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: 'https://www.leadqualif.com/reset-password',
    })

    setForgotLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setForgotSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">

      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full opacity-5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo + titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">LeadQualif IA</h1>
          <p className="text-slate-400 text-sm">CRM intelligent pour agences SMMA & Immo</p>
        </div>

        {/* Badge plan sélectionné */}
        {planInfo && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-4 text-sm font-medium ${planInfo.badge}`}>
            <CheckCircle size={15} />
            Plan sélectionné : <strong>{planInfo.label}</strong> — {planInfo.price}
            <span className="ml-auto text-xs opacity-70">7 jours gratuits</span>
          </div>
        )}

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {!showForgot ? (
            <>
              <h2 className="text-xl font-semibold text-slate-800 mb-6">
                {planInfo ? t('auth.loginTitlePlan') : t('auth.loginTitle')}
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@agence.fr"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-medium text-slate-700">{t('auth.password')}</label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotEmail(email); setError('') }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Erreur */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Bouton connexion */}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('auth.loggingIn')}</>
                  ) : (
                    <>{planInfo ? t('auth.loginBtn') : t('auth.loginBtn')} <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-slate-500 text-sm">
                  {t('auth.noAccount')}{' '}
                  <Link to={signupLink} className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                    {t('auth.signup')} →
                  </Link>
                </p>
              </div>
            </>
          ) : (

            /* ── MOT DE PASSE OUBLIÉ ── */
            <>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setError('') }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
              >
                ← Retour à la connexion
              </button>

              {!forgotSent ? (
                <>
                  <h2 className="text-xl font-semibold text-slate-800 mb-2">Réinitialiser le mot de passe</h2>
                  <p className="text-slate-500 text-sm mb-6">
                    Entrez votre email et nous vous enverrons un lien de réinitialisation.
                  </p>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="contact@agence.fr"
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                        ⚠️ {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {forgotLoading
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</>
                        : 'Envoyer le lien de réinitialisation'
                      }
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-800 mb-2">Email envoyé !</h2>
                  <p className="text-slate-500 text-sm mb-1">
                    Un lien de réinitialisation a été envoyé à
                  </p>
                  <p className="font-semibold text-slate-800 text-sm mb-5">{forgotEmail}</p>
                  <p className="text-xs text-slate-400">
                    Vérifiez vos spams si vous ne le recevez pas dans 2 minutes.
                  </p>
                  <button
                    onClick={() => { setShowForgot(false); setForgotSent(false); setError('') }}
                    className="mt-6 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    ← Retour à la connexion
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bas de page */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © 2025 LeadQualif · <a href="https://nexapro.tech" className="hover:text-slate-300 transition-colors">NexaPro</a>
          {' · '}
          <a href="mailto:contact@nexapro.tech" className="hover:text-slate-300 transition-colors">Support</a>
        </p>
      </div>
    </div>
  )
}
