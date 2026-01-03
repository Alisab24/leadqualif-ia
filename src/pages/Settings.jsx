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
    nom_agence: '',
    signataire: '',
    identifiant_fiscal: '',
    adresse_agence: '',
    telephone_agence: '',
    email_agence: '',
    site_web: '',
    logo_url: '',
    devise: 'FCFA',
    pays: 'Bénin'
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
        nom_agence: profileData.nom_agence || '',
        signataire: profileData.signataire || '',
        identifiant_fiscal: profileData.identifiant_fiscal || '',
        adresse_agence: profileData.adresse_agence || '',
        telephone_agence: profileData.telephone_agence || '',
        email_agence: profileData.email_agence || '',
        site_web: profileData.site_web || '',
        logo_url: profileData.logo_url || '',
        devise: profileData.devise || 'FCFA',
        pays: profileData.pays || 'Bénin'
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

      // Nettoyage des données - aucune valeur undefined
      const dataToSave = {
        user_id: session.user.id,
        nom_agence: formData.nom_agence || '',
        signataire: formData.signataire || '',
        identifiant_fiscal: formData.identifiant_fiscal || '',
        adresse_agence: formData.adresse_agence || '',
        telephone_agence: formData.telephone_agence || '',
        email_agence: formData.email_agence || '',
        site_web: formData.site_web || '',
        logo_url: formData.logo_url || '',
        devise: formData.devise || 'FCFA',
        pays: formData.pays || 'Bénin'
      }

      console.log('Données envoyées:', dataToSave)

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(dataToSave, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })

      if (upsertError) {
        console.error('Erreur upsert:', upsertError)
        setError(`Erreur lors de la sauvegarde: ${upsertError.message}`)
      } else {
        setSuccess('✅ Paramètres enregistrés avec succès !')
        // Mettre à jour le profil local
        setProfile({ ...profile, ...dataToSave })
      }

    } catch (error) {
      console.error('Erreur handleSave:', error)
      setError(`Erreur lors de la sauvegarde: ${error.message}`)
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
                  name="nom_agence"
                  value={formData.nom_agence}
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
                  name="signataire"
                  value={formData.signataire}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Identifiant Fiscal (IFU, SIRET...) *
                </label>
                <input
                  type="text"
                  name="identifiant_fiscal"
                  value={formData.identifiant_fiscal}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 01234567890123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  name="telephone_agence"
                  value={formData.telephone_agence}
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
                  name="email_agence"
                  value={formData.email_agence}
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
                  name="site_web"
                  value={formData.site_web}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.agence.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL du Logo
                </label>
                <input
                  type="url"
                  name="logo_url"
                  value={formData.logo_url}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Devise *
                </label>
                <select
                  name="devise"
                  value={formData.devise}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="FCFA">FCFA (CFA)</option>
                  <option value="€">€ (Euro)</option>
                  <option value="$">$ (Dollar)</option>
                  <option value="£">£ (Livre)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pays *
                </label>
                <select
                  name="pays"
                  value={formData.pays}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Bénin">Bénin</option>
                  <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                  <option value="Sénégal">Sénégal</option>
                  <option value="Togo">Togo</option>
                  <option value="Burkina Faso">Burkina Faso</option>
                  <option value="Mali">Mali</option>
                  <option value="Niger">Niger</option>
                  <option value="Guinée">Guinée</option>
                  <option value="Cameroun">Cameroun</option>
                  <option value="Congo">Congo</option>
                  <option value="RDC">RD Congo</option>
                  <option value="Gabon">Gabon</option>
                  <option value="Tchad">Tchad</option>
                  <option value="Centrafrique">Centrafrique</option>
                  <option value="France">France</option>
                  <option value="Belgique">Belgique</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Canada">Canada</option>
                  <option value="Maroc">Maroc</option>
                  <option value="Tunisie">Tunisie</option>
                  <option value="Algérie">Algérie</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Adresse</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse complète *
                </label>
                <input
                  type="text"
                  name="adresse_agence"
                  value={formData.adresse_agence}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Rue de l'Immobilier"
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
