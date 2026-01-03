import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Settings() {
  // --- ÉTATS ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // --- FORM DATA ---
  const [formData, setFormData] = useState({
    agency_name: '',
    signatory_name: '',
    siret: '',
    address: '',
    postal_code: '',
    city: '',
    website: '',
    phone: '',
    email: ''
  })

  // --- CHARGEMENT ---
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session non trouvée')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (profileError) {
        console.error('Erreur profil:', profileError)
        setError('Erreur de chargement du profil')
        return
      }

      setProfile(profileData)
      setFormData({
        agency_name: profileData.agency_name || '',
        signatory_name: profileData.signatory_name || '',
        siret: profileData.siret || '',
        address: profileData.address || '',
        postal_code: profileData.postal_code || '',
        city: profileData.city || '',
        website: profileData.website || '',
        phone: profileData.phone || '',
        email: profileData.email || ''
      })

    } catch (error) {
      console.error('Erreur loadProfile:', error)
      setError('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // --- SAUVEGARDE ---
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session non trouvée')
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          agency_name: formData.agency_name,
          signatory_name: formData.signatory_name,
          siret: formData.siret,
          address: formData.address,
          postal_code: formData.postal_code,
          city: formData.city,
          website: formData.website,
          phone: formData.phone,
          email: formData.email
        })
        .eq('user_id', session.user.id)

      if (updateError) {
        console.error('Erreur mise à jour:', updateError)
        setError('Erreur lors de la sauvegarde')
      } else {
        setSuccess('✅ Paramètres enregistrés avec succès !')
        // Mettre à jour le profil local
        setProfile({ ...profile, ...formData })
      }

    } catch (error) {
      console.error('Erreur handleSave:', error)
      setError('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // --- CHANGEMENT FORMULAIRE ---
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // --- ÉTATS ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des paramètres...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">⚙️ Paramètres</h1>
          <Link 
            to="/app" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            ← Retour au Dashboard
          </Link>
        </div>
        <p className="text-gray-600">Personnalisez les informations de votre agence</p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✅</span>
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Informations principales */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Informations de l'agence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'agence *
                </label>
                <input
                  type="text"
                  name="agency_name"
                  value={formData.agency_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Immobilier Pro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du signataire (Gérant) *
                </label>
                <input
                  type="text"
                  name="signatory_name"
                  value={formData.signatory_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SIRET / N° Enregistrement
                </label>
                <input
                  type="text"
                  name="siret"
                  value={formData.siret}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 12345678901234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 0612345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@agence.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Web
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.agence.fr"
                />
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Adresse</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Rue de l'Immobilier"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code Postal *
                </label>
                <input
                  type="text"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="75001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Paris"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IBAN (pour factures)
                </label>
                <input
                  type="text"
                  name="iban"
                  value={formData.iban || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="FR7630006000011234567890189"
                />
              </div>
            </div>
          </div>

          {/* Bouton de sauvegarde */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  💾 Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Informations supplémentaires */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Informations importantes</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Les champs marqués d'un * sont obligatoires</p>
          <p>• Ces informations seront utilisées dans tous vos documents (mandats, factures, etc.)</p>
          <p>• Le SIRET et l'IBAN sont requis pour les documents légaux</p>
          <p>• Vous pouvez modifier ces informations à tout moment</p>
        </div>
      </div>
    </div>
  )
}
