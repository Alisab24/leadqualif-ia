import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Estimation() {
  const [formData, setFormData] = useState({
    nom_complet: '',
    email: '',
    telephone: '',
    type_bien: '',
    budget_estime: '',
    localisation: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Insertion dans la table leads - directement dans le pipeline "À traiter"
      const { data, error } = await supabase
        .from('leads')
        .insert([
          {
            nom: formData.nom_complet,
            email: formData.email,
            telephone: formData.telephone,
            type_bien: formData.type_bien,
            budget: formData.budget_estime,
            localisation: formData.localisation,
            message: formData.message,
            statut: 'À traiter', // Directement dans le pipeline
            source: 'Formulaire Public LeadQualif',
            pays: 'FR', // Par défaut France
            created_at: new Date().toISOString()
          }
        ])

      if (error) {
        console.error('Erreur insertion:', error)
        setMessage('Une erreur est survenue. Veuillez réessayer.')
        setMessageType('error')
      } else {
        setMessage('✅ Merci ! Votre demande a été enregistrée et un agent va vous contacter dans les plus brefs délais.')
        setMessageType('success')
        // Réinitialiser le formulaire
        setFormData({
          nom_complet: '',
          email: '',
          telephone: '',
          type_bien: '',
          budget_estime: '',
          localisation: '',
          message: ''
        })
      }
    } catch (error) {
      console.error('Erreur:', error)
      setMessage('Une erreur est survenue. Veuillez réessayer.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">LQ</span>
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-4">
            Estimez votre bien en 2 minutes
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Obtenez une estimation gratuite et sans engagement par un professionnel certifié
          </p>
          <div className="flex justify-center items-center space-x-4 mt-6">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
              🔒 RGPD Compliant
            </span>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              🇫🇷 Service France
            </span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations personnelles */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nom_complet" className="block text-sm font-semibold text-gray-700 mb-3">
                  Nom complet *
                </label>
                <input
                  type="text"
                  id="nom_complet"
                  name="nom_complet"
                  value={formData.nom_complet}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-3">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="jean.dupont@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="telephone" className="block text-sm font-semibold text-gray-700 mb-3">
                Téléphone *
              </label>
              <input
                type="tel"
                id="telephone"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="06 12 34 56 78"
              />
            </div>

            {/* Informations sur le bien */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="type_bien" className="block text-sm font-semibold text-gray-700 mb-3">
                  Type de bien *
                </label>
                <select
                  id="type_bien"
                  name="type_bien"
                  value={formData.type_bien}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Sélectionnez...</option>
                  <option value="Maison">Maison</option>
                  <option value="Appartement">Appartement</option>
                  <option value="Terrain">Terrain</option>
                  <option value="Villa">Villa</option>
                  <option value="Studio">Studio</option>
                  <option value="Loft">Loft</option>
                  <option value="Immeuble">Immeuble</option>
                </select>
              </div>

              <div>
                <label htmlFor="budget_estime" className="block text-sm font-semibold text-gray-700 mb-3">
                  Budget estimé (€)
                </label>
                <input
                  type="number"
                  id="budget_estime"
                  name="budget_estime"
                  value={formData.budget_estime}
                  onChange={handleChange}
                  min="0"
                  step="10000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="300 000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="localisation" className="block text-sm font-semibold text-gray-700 mb-3">
                Localisation *
              </label>
              <input
                type="text"
                id="localisation"
                name="localisation"
                value={formData.localisation}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Paris 8ème arrondissement"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-3">
                Message (optionnel)
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                placeholder="Décrivez votre projet..."
              />
            </div>

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-xl text-sm ${
                messageType === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Envoi en cours...' : '🚀 Envoyer ma demande'}
            </button>

            {/* Mentions */}
            <div className="text-center text-sm text-gray-500">
              <p>
                En soumettant ce formulaire, vous acceptez notre 
                <a href="#" className="text-blue-600 hover:underline ml-1">politique de confidentialité</a>.
                Vos données sont traitées conformément au RGPD.
              </p>
            </div>
          </form>

          {/* Lien retour */}
          <div className="mt-8 text-center">
            <a href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Retour à l'accueil
            </a>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-12 text-center">
          <div className="flex justify-center items-center space-x-8 text-gray-600">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🔒</span>
              <span className="text-sm">Données sécurisées</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🇫🇷</span>
              <span className="text-sm">Service France</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">⚡</span>
              <span className="text-sm">Réponse sous 24h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
