import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building, Mail, Phone, User, CheckCircle, AlertCircle } from 'lucide-react'
import { leads } from '../supabaseClient'

export default function Estimation() {
  const [searchParams] = useSearchParams()
  const [agencyId, setAgencyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    type_bien: 'Appartement',
    adresse: '',
    budget: ''
  })

  // Récupérer l'agency_id depuis l'URL
  useEffect(() => {
    const aid = searchParams.get('aid')
    if (aid) {
      setAgencyId(aid)
      console.log('Agency ID détecté:', aid)
    } else {
      setError('ID d\'agence manquant. Veuillez utiliser le lien complet fourni par votre agence.')
    }
  }, [searchParams])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!agencyId) {
      setError('ID d\'agence manquant. Impossible de soumettre le formulaire.')
      setLoading(false)
      return
    }

    try {
      console.log('Soumission du lead...', { ...formData, agency_id: agencyId })
      
      const result = await leads.create({
        ...formData,
        agency_id: agencyId
      })

      console.log('Résultat soumission:', result)

      if (result.success) {
        setSuccess('✅ Votre demande a été enregistrée ! Un agent vous contactera rapidement.')
        // Réinitialiser le formulaire
        setFormData({
          nom: '',
          email: '',
          telephone: '',
          type_bien: 'Appartement',
          adresse: '',
          budget: ''
        })
        
        // Redirection vers page merci après 2 secondes
        setTimeout(() => {
          window.location.href = '/merci'
        }, 2000)
      } else {
        console.error('Erreur soumission:', result.error)
        setError(result.error || 'Erreur lors de l\'enregistrement de votre demande.')
      }
    } catch (error) {
      console.error('Erreur catch soumission:', error)
      setError(`Erreur réseau: ${error.message}`)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Découvrez la valeur de votre bien
            </h1>
            <p className="text-slate-600">
              Analyse intelligente par IA pour votre projet immobilier
            </p>
          </div>

          {/* Formulaire */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <CheckCircle size={20} />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Nom */}
                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-slate-700 mb-2">
                    Nom complet *
                  </label>
                  <div className="relative">
                    <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      id="nom"
                      name="nom"
                      type="text"
                      value={formData.nom}
                      onChange={handleChange}
                      placeholder="Ex: Marie Dupont"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="marie@email.com"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Téléphone */}
                <div>
                  <label htmlFor="telephone" className="block text-sm font-medium text-slate-700 mb-2">
                    Téléphone *
                  </label>
                  <div className="relative">
                    <Phone size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      id="telephone"
                      name="telephone"
                      type="tel"
                      value={formData.telephone}
                      onChange={handleChange}
                      placeholder="06 12 34 56 78"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Type de bien */}
                <div>
                  <label htmlFor="type_bien" className="block text-sm font-medium text-slate-700 mb-2">
                    Type de bien *
                  </label>
                  <select
                    id="type_bien"
                    name="type_bien"
                    value={formData.type_bien}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="Appartement">Appartement</option>
                    <option value="Maison">Maison</option>
                    <option value="Villa">Villa</option>
                    <option value="Terrain">Terrain</option>
                    <option value="Local Commercial">Local Commercial</option>
                  </select>
                </div>

                {/* Adresse */}
                <div className="md:col-span-2">
                  <label htmlFor="adresse" className="block text-sm font-medium text-slate-700 mb-2">
                    Adresse du bien *
                  </label>
                  <input
                    id="adresse"
                    name="adresse"
                    type="text"
                    value={formData.adresse}
                    onChange={handleChange}
                    placeholder="Ex: 75011 Paris, France"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                {/* Budget */}
                <div className="md:col-span-2">
                  <label htmlFor="budget" className="block text-sm font-medium text-slate-700 mb-2">
                    Prix estimé / Budget (€)
                  </label>
                  <input
                    id="budget"
                    name="budget"
                    type="number"
                    value={formData.budget}
                    onChange={handleChange}
                    placeholder="Ex: 350000"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !agencyId}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Analyse IA en cours...
                  </>
                ) : (
                  'Obtenir mon analyse IA'
                )}
              </button>
            </form>

            {/* Info section */}
            <div className="mt-8 p-6 bg-slate-50 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                ✨ Ce que vous allez recevoir
              </h3>
              <div className="space-y-2 text-slate-600">
                <p>• Analyse instantanée de votre projet immobilier</p>
                <p>• Score de qualification personnalisé</p>
                <p>• Contact prioritaire avec nos agents experts</p>
                <p>• Estimation de valeur basée sur votre secteur</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
