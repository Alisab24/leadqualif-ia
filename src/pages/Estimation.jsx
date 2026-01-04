import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Estimation() {
  const [formData, setFormData] = useState({
    nom_complet: '',
    email: '',
    telephone: '',
    type_bien: '',
    budget_estime: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'success' ou 'error'

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
      // Insertion dans la table leads
      const { data, error } = await supabase
        .from('leads')
        .insert([
          {
            nom: formData.nom_complet,
            email: formData.email,
            telephone: formData.telephone,
            type_bien: formData.type_bien,
            budget: formData.budget_estime,
            statut: 'À traiter',
            source: 'Formulaire Public',
            created_at: new Date().toISOString()
          }
        ])

      if (error) {
        console.error('Erreur insertion:', error)
        setMessage('Une erreur est survenue. Veuillez réessayer.')
        setMessageType('error')
      } else {
        setMessage('Merci ! Un agent va vous contacter.')
        setMessageType('success')
        // Réinitialiser le formulaire
        setFormData({
          nom_complet: '',
          email: '',
          telephone: '',
          type_bien: '',
          budget_estime: ''
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">LQ</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Estimez votre bien en 2 minutes
          </h1>
          <p className="text-gray-600 mt-2">
            Obtenez une estimation gratuite et sans engagement
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom complet */}
            <div>
              <label htmlFor="nom_complet" className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet *
              </label>
              <input
                type="text"
                id="nom_complet"
                name="nom_complet"
                value={formData.nom_complet}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Jean Dupont"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="jean@example.com"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone *
              </label>
              <input
                type="tel"
                id="telephone"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+225 07 00 00 00 00"
              />
            </div>

            {/* Type de bien */}
            <div>
              <label htmlFor="type_bien" className="block text-sm font-medium text-gray-700 mb-2">
                Type de bien *
              </label>
              <select
                id="type_bien"
                name="type_bien"
                value={formData.type_bien}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionnez...</option>
                <option value="Maison">Maison</option>
                <option value="Appartement">Appartement</option>
                <option value="Terrain">Terrain</option>
                <option value="Villa">Villa</option>
                <option value="Bureau">Bureau</option>
                <option value="Commerce">Commerce</option>
              </select>
            </div>

            {/* Budget estimé */}
            <div>
              <label htmlFor="budget_estime" className="block text-sm font-medium text-gray-700 mb-2">
                Budget / Prix estimé (FCFA)
              </label>
              <input
                type="number"
                id="budget_estime"
                name="budget_estime"
                value={formData.budget_estime}
                onChange={handleChange}
                min="0"
                step="100000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10 000 000"
              />
            </div>

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-lg text-sm ${
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
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer ma demande'}
            </button>
          </form>

          {/* Lien retour */}
          <div className="mt-6 text-center">
            <a href="/" className="text-blue-600 hover:text-blue-800 text-sm">
              ← Retour à l'accueil
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
