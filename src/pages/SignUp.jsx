import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Building, Eye, EyeOff, Mail, Lock, User, CheckCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'

const PLAN_LABELS = { starter: 'Starter — 49€/mois', growth: 'Growth — 149€/mois', enterprise: 'Enterprise' }
const PLAN_COLORS = { starter: 'bg-blue-50 border-blue-200 text-blue-700', growth: 'bg-indigo-50 border-indigo-200 text-indigo-700', enterprise: 'bg-purple-50 border-purple-200 text-purple-700' }

export default function SignUp() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    agencyName: '',
    fullName: '',
    typeAgence: 'immobilier',
    telephone: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)   // ← nouvel état
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Plan sélectionné depuis la landing page (ex: ?plan=growth ou returnTo contenant plan)
  const planFromParam = searchParams.get('plan')
  const returnTo = searchParams.get('returnTo') || ''
  const planFromReturn = returnTo.match(/plan=([^&]+)/)?.[1]
  const selectedPlan = planFromParam || planFromReturn || null

  // Token d'invitation d'équipe (ex: /signup?invite=TOKEN)
  const inviteToken = searchParams.get('invite') || null

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setIsLoading(false)
      return
    }
    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      setIsLoading(false)
      return
    }

    try {
      // 1. Créer le compte Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })
      if (authError) {
        setError(authError.message || 'Erreur lors de la création du compte')
        setIsLoading(false)
        return
      }

      // 2. Résoudre l'invitation si un token est présent
      let invitedAgencyId = null
      let invitedRole = 'agent'
      let invitationId = null

      if (inviteToken) {
        const { data: invitation, error: invErr } = await supabase
          .from('agency_invitations')
          .select('id, agency_id, role, email, status, expires_at')
          .eq('token', inviteToken)
          .eq('status', 'pending')
          .single()

        if (!invErr && invitation) {
          // Vérifier que l'invitation n'est pas expirée
          if (new Date(invitation.expires_at) > new Date()) {
            invitedAgencyId = invitation.agency_id
            invitedRole     = invitation.role || 'agent'
            invitationId    = invitation.id
          }
        }
      }

      // 3. Créer le profil agence dans la table profiles
      const profilePayload = {
        user_id:             authData.user.id,
        agency_id:           invitedAgencyId || authData.user.id,  // si invité → agence de l'invitant
        email:               formData.email,
        nom_agence:          invitedAgencyId ? formData.agencyName || formData.fullName : formData.agencyName,
        nom_complet:         formData.fullName,
        telephone:           formData.telephone,
        type_agence:         formData.typeAgence,
        subscription_status: invitedAgencyId ? undefined : 'inactive',
        subscription_plan:   invitedAgencyId ? undefined : 'free',
        role:                invitedAgencyId ? invitedRole : 'owner',
      }
      // Nettoyer les champs undefined
      Object.keys(profilePayload).forEach(k => profilePayload[k] === undefined && delete profilePayload[k])

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([profilePayload], { onConflict: 'user_id' })

      if (profileError) {
        console.error('Profil error (non bloquant):', profileError)
        // Non bloquant — on continue quand même
      }

      // 4. Marquer l'invitation comme acceptée
      if (invitationId) {
        await supabase
          .from('agency_invitations')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', invitationId)
      }

      // 5. Vérifier si l'email doit être confirmé
      const needsConfirmation = !authData.session
      if (needsConfirmation) {
        // Supabase a envoyé un mail de confirmation → afficher l'écran d'attente
        setEmailSent(true)
      } else {
        // Email déjà confirmé (ex: config Supabase sans confirmation) → rediriger
        if (inviteToken && invitedAgencyId) {
          navigate('/dashboard')
        } else if (selectedPlan) {
          navigate(`/settings?tab=facturation&plan=${selectedPlan}`)
        } else if (returnTo) {
          navigate(decodeURIComponent(returnTo))
        } else {
          navigate('/dashboard')
        }
      }

    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Erreur réseau. Veuillez réessayer.')
    }

    setIsLoading(false)
  }

  /* ── Écran "vérifie ton email" ── */
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
        <p className="text-slate-600 mb-1">
          Un email de confirmation a été envoyé à :
        </p>
        <p className="font-semibold text-blue-700 mb-6">{formData.email}</p>
        <p className="text-slate-500 text-sm mb-8">
          Cliquez sur le lien dans l'email pour activer votre compte.
          Le lien est valable <strong>24 heures</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800 mb-6">
          <p className="font-semibold mb-1">📧 Pas de mail reçu ?</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>Vérifiez votre dossier <strong>Spam / Courrier indésirable</strong></li>
            <li>L'email vient de <strong>noreply@leadqualif.com</strong></li>
            <li>Attendez 1–2 minutes avant de vérifier</li>
          </ul>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-blue-600 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Créer votre compte</h1>
          <p className="text-slate-500 text-sm">LeadQualif IA — CRM pour agences SMMA & Immo</p>
        </div>

        {/* Badge plan sélectionné */}
        {selectedPlan && PLAN_LABELS[selectedPlan] && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border mb-5 text-sm font-medium ${PLAN_COLORS[selectedPlan]}`}>
            <CheckCircle size={16} />
            Plan sélectionné : <strong>{PLAN_LABELS[selectedPlan]}</strong>
            <span className="ml-auto text-xs font-normal opacity-70">7 jours gratuits</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Infos agence */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'agence *</label>
              <div className="relative">
                <Building size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="agencyName" type="text" value={formData.agencyName} onChange={handleChange}
                  placeholder="Immo Dupont / Agence Marketing XYZ"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Votre prénom & nom *</label>
              <div className="relative">
                <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="fullName" type="text" value={formData.fullName} onChange={handleChange}
                  placeholder="Jean Dupont"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
              <input name="telephone" type="tel" value={formData.telephone} onChange={handleChange}
                placeholder="+33 6 00 00 00 00"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Type d'agence *</label>
              <select name="typeAgence" value={formData.typeAgence} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white">
                <option value="immobilier">🏠 Agence Immobilière</option>
                <option value="smma">📱 Agence SMMA / Marketing</option>
                <option value="autre">💼 Autre</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email professionnel *</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="email" type="email" value={formData.email} onChange={handleChange}
                  placeholder="contact@agence.fr"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required autoComplete="email" />
              </div>
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

          {/* Note paiement */}
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100">
            💳 Aucune carte bancaire requise maintenant. Le paiement sera demandé uniquement à la fin de votre essai gratuit de 7 jours via Stripe (100% sécurisé).
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          <button type="submit"
            disabled={isLoading || !formData.email || !formData.password || !formData.agencyName || !formData.fullName}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
            {isLoading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Création en cours...</>
            ) : (
              selectedPlan ? `Créer mon compte & choisir ${PLAN_LABELS[selectedPlan]?.split('—')[0].trim()} →` : 'Créer mon compte →'
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-center text-slate-500 text-sm">
            Déjà un compte ?{' '}
            <Link
              to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
              className="text-blue-600 hover:text-blue-700 font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
