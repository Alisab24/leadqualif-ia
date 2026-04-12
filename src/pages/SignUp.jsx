import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Building, Eye, EyeOff, Mail, Lock, User, CheckCircle, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'

const PLAN_LABELS = { starter: 'Starter — 49€/mois', growth: 'Growth — 149€/mois', enterprise: 'Enterprise' }
const PLAN_COLORS = { starter: 'bg-blue-50 border-blue-200 text-blue-700', growth: 'bg-indigo-50 border-indigo-200 text-indigo-700', enterprise: 'bg-purple-50 border-purple-200 text-purple-700' }

export default function SignUp() {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    agencyName: '', fullName: '', typeAgence: 'immobilier', telephone: '',
  })
  const [showPassword, setShowPassword]               = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading]         = useState(false)
  const [error, setError]                 = useState('')
  const [emailSent, setEmailSent]         = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)

  // Invitation
  const [inviteInfo, setInviteInfo]       = useState(null)   // { id, agency_id, role, email, agencyName }
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError]     = useState(null)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const planFromParam  = searchParams.get('plan')
  const returnTo       = searchParams.get('returnTo') || ''
  const planFromReturn = returnTo.match(/plan=([^&]+)/)?.[1]
  const selectedPlan   = planFromParam || planFromReturn || null
  const inviteToken    = searchParams.get('invite') || null

  // ── Charger l'invitation dès le montage ──────────────────────────────────────
  useEffect(() => {
    if (!inviteToken) return
    setInviteLoading(true)

    async function loadInvitation() {
      try {
        const { data: inv, error: invErr } = await supabase
          .from('agency_invitations')
          .select('id, agency_id, role, email, status, expires_at')
          .eq('token', inviteToken)
          .eq('status', 'pending')
          .maybeSingle()

        if (invErr || !inv) {
          setInviteError(t('signup.errors.invalidInvite'))
          setInviteLoading(false)
          return
        }
        if (new Date(inv.expires_at) < new Date()) {
          setInviteError(t('signup.errors.expiredInvite'))
          setInviteLoading(false)
          return
        }

        // Récupérer le nom de l'agence qui invite
        // Tentative 1 : profil avec role='owner' dans l'agence
        let agencyName = ''
        const { data: ownerByRole } = await supabase
          .from('profiles')
          .select('nom_agence, nom_complet')
          .eq('agency_id', inv.agency_id)
          .eq('role', 'owner')
          .maybeSingle()
        if (ownerByRole) {
          agencyName = ownerByRole.nom_agence || ownerByRole.nom_complet || ''
        }

        // Tentative 2 : dans cette app, agency_id = user_id du propriétaire
        if (!agencyName) {
          const { data: ownerByUserId } = await supabase
            .from('profiles')
            .select('nom_agence, nom_complet')
            .eq('user_id', inv.agency_id)
            .maybeSingle()
          if (ownerByUserId) {
            agencyName = ownerByUserId.nom_agence || ownerByUserId.nom_complet || ''
          }
        }

        // Tentative 3 : n'importe quel profil de l'agence
        if (!agencyName) {
          const { data: anyMember } = await supabase
            .from('profiles')
            .select('nom_agence, nom_complet')
            .eq('agency_id', inv.agency_id)
            .maybeSingle()
          if (anyMember) {
            agencyName = anyMember.nom_agence || anyMember.nom_complet || ''
          }
        }

        agencyName = agencyName || 'votre agence'
        setInviteInfo({ ...inv, agencyName })
        if (inv.email) setFormData(prev => ({ ...prev, email: inv.email }))
      } catch (err) {
        console.error('Erreur invitation:', err)
        setInviteError(t('signup.inviteError'))
      } finally {
        setInviteLoading(false)
      }
    }
    loadInvitation()
  }, [inviteToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError(t('signup.errors.passwordMismatch')); setIsLoading(false); return
    }
    if (formData.password.length < 6) {
      setError(t('signup.errors.passwordTooShort')); setIsLoading(false); return
    }

    try {
      const invitedAgencyId = inviteInfo?.agency_id || null
      const invitedRole     = inviteInfo?.role || 'agent'
      const invitationId    = inviteInfo?.id || null

      // ── user_metadata : stocké en DB même sans session active ──
      // Permet de récupérer les infos d'invitation après confirmation email
      const userMeta = invitedAgencyId
        ? {
            invited_agency_id: invitedAgencyId,
            invited_role:      invitedRole,
            invitation_id:     invitationId,
            nom_agence:        inviteInfo?.agencyName || '',
            full_name:         formData.fullName,
          }
        : { full_name: formData.fullName }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    formData.email,
        password: formData.password,
        options:  { data: userMeta },
      })
      if (authError) {
        // Supabase retourne "User already registered" pour un email déjà confirmé
        const isAlreadyRegistered =
          authError.message?.toLowerCase().includes('already registered') ||
          authError.message?.toLowerCase().includes('already been registered') ||
          authError.message?.toLowerCase().includes('email already')
        if (isAlreadyRegistered) {
          setAlreadyRegistered(true)
          setIsLoading(false)
          return
        }
        setError(authError.message || t('signup.errors.signupFailed'))
        setIsLoading(false); return
      }

      // ── Détection silencieuse de Supabase : email déjà enregistré ──────────────
      // Quand email confirmation est activée + email déjà confirmé, Supabase retourne
      // un "faux succès" sans envoyer d'email. Signe = identities tableau vide.
      if (authData?.user?.identities?.length === 0) {
        setAlreadyRegistered(true)
        setIsLoading(false)
        return
      }

      const profilePayload = {
        user_id:             authData.user.id,
        agency_id:           invitedAgencyId || authData.user.id,
        email:               formData.email,
        nom_agence:          invitedAgencyId ? (inviteInfo?.agencyName || '') : formData.agencyName,
        nom_complet:         formData.fullName,
        telephone:           formData.telephone || undefined,
        type_agence:         invitedAgencyId ? undefined : formData.typeAgence,
        subscription_status: invitedAgencyId ? undefined : 'inactive',
        subscription_plan:   invitedAgencyId ? undefined : 'free',
        role:                invitedAgencyId ? invitedRole : 'owner',
      }
      Object.keys(profilePayload).forEach(k => profilePayload[k] === undefined && delete profilePayload[k])

      // Tentative de création profil immédiate (fonctionne si pas de confirmation email)
      const { error: profileError } = await supabase
        .from('profiles').upsert([profilePayload], { onConflict: 'user_id' })
      if (profileError) {
        // Normal si confirmation email requise (pas de session = RLS bloque)
        // Le profil sera créé dans AuthConfirm après validation du token
        console.warn('[Signup] Profil différé (confirmation email requise):', profileError.message)
      }

      // Marquer l'invitation comme acceptée si on a une session immédiate
      if (invitationId && authData.session) {
        await supabase.from('agency_invitations')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', invitationId)
      }

      const needsConfirmation = !authData.session
      if (needsConfirmation) {
        setEmailSent(true)
      } else {
        if (inviteToken && invitedAgencyId) navigate('/dashboard')
        else if (selectedPlan) navigate(`/settings?tab=facturation&plan=${selectedPlan}`)
        else if (returnTo) navigate(decodeURIComponent(returnTo))
        else navigate('/dashboard')
      }
    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Erreur réseau. Veuillez réessayer.')
    }
    setIsLoading(false)
  }

  /* ── Écran confirmation email ──────────────────────────────────────────────── */
  if (emailSent) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('signup.checkEmail')}</h1>
        <p className="text-slate-600 mb-1">{t('signup.emailSentTo')}</p>
        <p className="font-semibold text-blue-700 mb-4">{formData.email}</p>
        {inviteInfo && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 text-sm text-indigo-700">
            ✅ Après confirmation, vous rejoindrez automatiquement l'équipe de <strong>{inviteInfo.agencyName}</strong>.
          </div>
        )}
        <p className="text-slate-500 text-sm mb-4">
          Cliquez sur le lien dans l'email pour activer votre compte. Valable 24 heures.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800 mb-4">
          <p className="font-semibold mb-1">📧 Pas de mail reçu ?</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>Vérifiez votre dossier <strong>Spam / Courrier indésirable</strong></li>
            <li>Attendez 1–2 minutes avant de vérifier</li>
            <li>L'email provient de <strong>noreply@mail.supabase.io</strong></li>
          </ul>
        </div>
        {/* Si invitation : donner aussi l'option de se connecter directement */}
        {inviteInfo && inviteToken && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 mb-4">
            <p className="mb-2">Vous avez déjà un compte sur une autre adresse ?</p>
            <Link
              to={`/login?invite=${inviteToken}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-xs hover:bg-indigo-700 transition-colors"
            >
              Se connecter avec un autre compte →
            </Link>
          </div>
        )}
        <button onClick={() => navigate('/login')}
          className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm">
          {t('signup.backToLogin')}
        </button>
      </div>
    </div>
  )

  /* ── Chargement invitation ─────────────────────────────────────────────────── */
  if (inviteToken && inviteLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
        <p className="text-slate-500">{t('signup.loadingInvite')}</p>
      </div>
    </div>
  )

  /* ── Invitation invalide ───────────────────────────────────────────────────── */
  if (inviteToken && inviteError) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{t('signup.invalidInvite')}</h2>
        <p className="text-slate-500 text-sm mb-6">{inviteError}</p>
        <Link to="/login" className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          {t('signup.login')}
        </Link>
      </div>
    </div>
  )

  /* ── Formulaire principal ──────────────────────────────────────────────────── */
  const isInvite = !!inviteInfo

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">

        <div className="text-center mb-6">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${isInvite ? 'bg-indigo-600' : 'bg-blue-600'}`}>
            {isInvite ? <Users size={22} className="text-white" /> : <Building size={22} className="text-white" />}
          </div>
          {isInvite ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{t('signup.invitedTitle')}</h1>
              {/* Nom de l'agence — bien visible */}
              <div className="mt-3 mb-1 px-5 py-4 bg-indigo-600 rounded-2xl text-white shadow-md">
                <p className="text-xs text-indigo-200 mb-1 font-medium tracking-wide uppercase">{t('signup.agencyLabel')}</p>
                <p className="text-xl font-bold truncate">🏢 {inviteInfo.agencyName}</p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl mt-2">
                <span className="text-xs text-indigo-600 font-medium">{t('signup.yourRole')}</span>
                <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold capitalize">
                  {inviteInfo.role === 'admin' ? '🔧 Admin' : inviteInfo.role === 'viewer' ? '👁 Viewer' : '👤 Agent'}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-2">{t('signup.joinTeamDesc')}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{t('signup.title')}</h1>
              <p className="text-slate-500 text-sm">{t('signup.subtitle')}</p>
            </>
          )}
        </div>

        {!isInvite && selectedPlan && PLAN_LABELS[selectedPlan] && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border mb-5 text-sm font-medium ${PLAN_COLORS[selectedPlan]}`}>
            <CheckCircle size={16} />
            {t('signup.selectedPlan')} <strong>{PLAN_LABELS[selectedPlan]}</strong>
            <span className="ml-auto text-xs font-normal opacity-70">{t('signup.trialDays')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Champs agence — cachés si invitation */}
          {!isInvite && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.agencyName')} *</label>
                <div className="relative">
                  <Building size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="agencyName" type="text" value={formData.agencyName} onChange={handleChange}
                    placeholder="Immo Dupont / Agence Marketing XYZ"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.agencyType')} *</label>
                <select name="typeAgence" value={formData.typeAgence} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white">
                  <option value="immobilier">🏠 {t('signup.immo')}</option>
                  <option value="smma">📱 {t('signup.smma')}</option>
                  <option value="autre">{t('signup.agencyTypeOther')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Nom + Téléphone */}
          <div className="grid grid-cols-2 gap-3">
            <div className={isInvite ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.fullName')} *</label>
              <div className="relative">
                <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="fullName" type="text" value={formData.fullName} onChange={handleChange}
                  placeholder="Jean Dupont"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
            </div>
            {!isInvite && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.phone')}</label>
                <input name="telephone" type="tel" value={formData.telephone} onChange={handleChange}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
              </div>
            )}
          </div>

          {/* Email + Mots de passe */}
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.email')} *</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="email" type="email" value={formData.email} onChange={handleChange}
                  placeholder="contact@agence.fr"
                  readOnly={isInvite && !!inviteInfo?.email}
                  className={`w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm
                    ${isInvite && inviteInfo?.email ? 'bg-slate-50 text-slate-500 cursor-default' : ''}`}
                  required autoComplete="email" />
              </div>
              {isInvite && inviteInfo?.email && (
                <p className="text-xs text-slate-400 mt-1">{t('signup.emailPreFilled')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.password')} *</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange}
                    placeholder={t('signup.passwordMin')}
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('signup.confirmPassword')} *</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange}
                    placeholder={t('signup.confirmPassword')}
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required autoComplete="new-password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!isInvite && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100">
              {t('signup.noCardRequired')}
            </p>
          )}

          {alreadyRegistered && (
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 text-sm text-blue-900">
              <p className="font-semibold mb-1">✉️ Vous avez déjà un compte !</p>
              <p className="text-blue-700 mb-3">
                Cet email est déjà associé à un compte LeadQualif.
                {inviteInfo && <> Connectez-vous pour rejoindre <strong>{inviteInfo.agencyName}</strong>.</>}
              </p>
              <Link
                to={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors"
              >
                Se connecter →
              </Link>
            </div>
          )}

          {!alreadyRegistered && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>
          )}

          <button type="submit"
            disabled={isLoading || !formData.email || !formData.password || !formData.fullName || (!isInvite && !formData.agencyName)}
            className={`w-full text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm
              ${isInvite ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isLoading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('signup.inProgress')}</>
              : isInvite
                ? t('signup.joinTeamBtn', { agency: inviteInfo?.agencyName })
                : selectedPlan
                  ? `${t('signup.submitBtn')} — ${PLAN_LABELS[selectedPlan]?.split('—')[0].trim()} →`
                  : `${t('signup.submitBtn')} →`
            }
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-center text-slate-500 text-sm">
            {t('signup.alreadyAccount')}{' '}
            <Link
              to={
                inviteToken
                  ? `/login?invite=${inviteToken}`
                  : returnTo
                    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
                    : '/login'
              }
              className="text-blue-600 hover:text-blue-700 font-medium">{t('signup.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
