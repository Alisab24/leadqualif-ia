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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Plan sélectionné depuis la landing page (ex: ?plan=growth ou returnTo contenant plan)
  const planFromParam = searchParams.get('plan')
  const returnTo = searchParams.get('returnTo') || ''
  const planFromReturn = returnTo.match(/plan=([^&]+)/)?.[1]
  const selectedPlan = planFromParam || planFromReturn || null

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

      // 2. Créer le profil agence dans la table profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          user_id: authData.user.id,
          email: formData.email,
          nom_agence: formData.agencyName,
          nom_complet: formData.fullName,
          telephone: formData.telephone,
          type_agence: formData.typeAgence,
          subscription_status: 'inactive',
          subscription_plan: 'free',
        }], { onConflict: 'user_id' })

      if (profileError) {
        console.error('Profil error (non bloquant):', profileError)
        // Non bloquant — on continue quand même
      }

      // 3. Redirection selon contexte
      if (selectedPlan) {
        // Venir de la landing page → aller directement au checkout
        navigate(`/settings?tab=facturation&plan=${selectedPlan}`)
      } else if (returnTo) {
        navigate(decodeURIComponent(returnTo))
      } else {
        navigate('/app')
      }

    } catch (err) {
      console.error('Erreur inattendue:', err)
      setError('Erreur réseau. Veuillez réessayer.')
    }

    setIsLoading(false)
  }

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
