import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Building, Eye, EyeOff, Mail, Lock, User, CheckCircle, Users } from 'lucide-react'
import { supabase } from '../supabaseClient'

const PLAN_LABELS = { starter: 'Starter — 49€/mois', growth: 'Growth — 149€/mois', enterprise: 'Enterprise' }
const PLAN_COLORS = { starter: 'bg-blue-50 border-blue-200 text-blue-700', growth: 'bg-indigo-50 border-indigo-200 text-indigo-700', enterprise: 'bg-purple-50 border-purple-200 text-purple-700' }

export default function SignUp() {
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    agencyName: '', fullName: '', typeAgence: 'immobilier', telephone: '',
  })
  const [showPassword, setShowPassword]               = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading]   = useState(false)
  const [error, setError]           = useState('')
  const [emailSent, setEmailSent]   = useState(false)

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
          setInviteError('Invitation invalide ou expirée.')
          setInviteLoading(false)
          return
        }
        if (new Date(inv.expires_at) < new Date()) {
          setInviteError("Ce lien d'invitation a expiré.")
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
        setInviteError("Erreur lors du chargement de l'invitation.")
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
      setError('Les mots de passe ne correspondent pas'); setIsLoading(false); return
    }
    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères'); setIsLoading(false); return
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })
      if (authError) {
        setError(authError.message || 'Erreur lors de la création du compte')
        setIsLoading(false); return
      }

      const invitedAgencyId = inviteInfo?.agency_id || null
      const invitedRole     = inviteInfo?.role || 'agent'
      const invitationId    = inviteInfo?.id || null

      const profilePayload = {
        user_id:             authData.user.id,
        agency_id:           invitedAgencyId || authData.user.id,
        email:               formData.email,
        nom_agence:          invitedAgencyId ? inviteInfo?.agencyName : formData.agencyName,
        nom_complet:         formData.fullName,
        telephone:           formData.telephone || undefined,
        type_agence:         invitedAgencyId ? undefined : formData.typeAgence,
        subscription_status: invitedAgencyId ? undefined : 'inactive',
        subscription_plan:   invitedAgencyId ? undefined : 'free',
        role:                invitedAgencyId ? invitedRole : 'owner',
      }
      Object.keys(profilePayload).forEach(k => profilePayload[k] === undefined && delete profilePayload[k])

      const { error: profileError } = await supabase
        .from('profiles').upsert([profilePayload], { onConflict: 'user_id' })
      if (profileError) console.error('Profil error (non bloquant):', profileError)

      if (invitationId) {
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
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Vérifiez votre email</h1>
        <p className="text-slate-600 mb-1">Un email de confirmation a été envoyé à :</p>
        <p className="font-semibold text-blue-700 mb-4">{formData.email}</p>
        {inviteInfo && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 text-sm text-indigo-700">
            ✅ Après confirmation, vous rejoindrez automatiquement l'équipe de <strong>{inviteInfo.agencyName}</strong>.
          </div>
        )}
        <p className="text-slate-500 text-sm mb-6">
          Cliquez sur le lien dans l'email pour activer votre compte. Valable <strong>24 heures</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800 mb-6">
          <p className="font-semibold mb-1">📧 Pas de mail reçu ?</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>Vérifiez votre dossier <strong>Spam / Courrier indésirable</strong></li>
            <li>Attendez 1–2 minutes avant de vérifier</li>
          </ul>
        </div>
        <button onClick={() => navigate('/login')}
          className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm">
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  /* ── Chargement invitation ─────────────────────────────────────────────────── */
  if (inviteToken && inviteLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
        <p className="text-slate-500">Chargement de l'invitation…</p>
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
        <h2 className="text-xl font-bold text-slate-900 mb-2">Invitation invalide</h2>
        <p className="text-slate-500 text-sm mb-6">{inviteError}</p>
        <Link to="/login" className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          Se connecter
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
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Vous êtes invité !</h1>
              {/* Nom de l'agence — bien visible */}
              <div className="mt-3 mb-1 px-5 py-4 bg-indigo-600 rounded-2xl text-white shadow-md">
                <p className="text-xs text-indigo-200 mb-1 font-medium tracking-wide uppercase">Agence</p>
                <p className="text-xl font-bold truncate">🏢 {inviteInfo.agencyName}</p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl mt-2">
                <span className="text-xs text-indigo-600 font-medium">Votre rôle :</span>
                <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold capitalize">
                  {inviteInfo.role === 'admin' ? '🔧 Admin' : inviteInfo.role === 'viewer' ? '👁 Lecture seule' : '👤 Agent'}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-2">Créez votre compte pour rejoindre cette équipe</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Créer votre compte</h1>
              <p className="text-slate-500 text-sm">LeadQualif IA — CRM pour agences SMMA & Immo</p>
            </>
          )}
        </div>

        {!isInvite && selectedPlan && PLAN_LABELS[selectedPlan] && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border mb-5 text-sm font-medium ${PLAN_COLORS[selectedPlan]}`}>
            <CheckCircle size={16} />
            Plan sélectionné : <strong>{PLAN_LABELS[selectedPlan]}</strong>
            <span className="ml-auto text-xs font-normal opacity-70">7 jours gratuits</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Champs agence — cachés si invitation */}
          {!isInvite && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'agence *</label>
                <div className="relative">
                  <Building size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="agencyName" type="text" value={formData.agencyName} onChange={handleChange}
                    placeholder="Immo Dupont / Agence Marketing XYZ"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type d'agence *</label>
                <select name="typeAgence" value={formData.typeAgence} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white">
                  <option value="immobilier">🏠 Agence Immobilière</option>
                  <option value="smma">📱 Agence SMMA / Marketing</option>
                  <option value="autre">💼 Autre</option>
                </select>
              </div>
            </div>
          )}

          {/* Nom + Téléphone */}
          <div className="grid grid-cols-2 gap-3">
            <div className={isInvite ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prénom & nom *</label>
              <div className="relative">
                <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="fullName" type="text" value={formData.fullName} onChange={handleChange}
                  placeholder="Jean Dupont"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
            </div>
            {!isInvite && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                <input name="telephone" type="tel" value={formData.telephone} onChange={handleChange}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
              </div>
            )}
          </div>

          {/* Email + Mots de passe */}
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
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
                <p className="text-xs text-slate-400 mt-1">📧 Email de l'invitation — pré-rempli</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe *</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange}
                    placeholder="Min 6 caractères"
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmer *</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange}
                    placeholder="Confirmer"
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
              💳 Aucune carte bancaire requise maintenant. Le paiement sera demandé uniquement à la fin de votre essai gratuit de 7 jours via Stripe (100% sécurisé).
            </p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>
          )}

          <button type="submit"
            disabled={isLoading || !formData.email || !formData.password || !formData.fullName || (!isInvite && !formData.agencyName)}
            className={`w-full text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm
              ${isInvite ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isLoading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />En cours…</>
              : isInvite
                ? `👥 Rejoindre ${inviteInfo?.agencyName} →`
                : selectedPlan
                  ? `Créer mon compte & choisir ${PLAN_LABELS[selectedPlan]?.split('—')[0].trim()} →`
                  : 'Créer mon compte →'
            }
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-center text-slate-500 text-sm">
            Déjà un compte ?{' '}
            <Link to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
              className="text-blue-600 hover:text-blue-700 font-medium">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
