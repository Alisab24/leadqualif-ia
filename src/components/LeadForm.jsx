import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { aiService } from '../services/ai'

const LeadForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    lead_role: '', // client ou propriétaire - OBLIGATOIRE
    nom: '',
    email: '',
    telephone: '',
    budget: '',
    type_de_bien: '',
    delai_achat: '',
    message: '',
    source: 'site_web',
    // Champs spécifiques propriétaire
    adresse_bien: '',
    surface: '',
    nb_pieces: '',
    prix_vente: '',
    date_disponibilite: '',
    // Champs spécifiques client
    localisation_souhaitee: '',
    criteres_specifiques: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [qualificationResult, setQualificationResult] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  /**
   * Fonction de qualification simplifiée qui retourne le format demandé
   * @param {Object} leadData - Les données du formulaire
   * @returns {Promise<Object>} - { niveau, score, raison, action_recommandee }
   */
  const qualifyLead = async (leadData) => {
    try {
      // Appel du service IA existant
      const qualification = await aiService.qualifyLead(leadData)
      
      // Extraction des données de qualification
      const evaluation = qualification.evaluation_complete || qualification
      const niveauInteret = qualification.niveau_interet_final || qualification.niveau_interet || evaluation.niveau_interet
      const score = qualification.score_qualification || evaluation.score_qualification || 0
      const raison = qualification.resume || evaluation.raison_classification || qualification.raison || 'Analyse effectuée'
      
      // Déterminer l'action recommandée selon le niveau
      let action_recommandee = ''
      if (niveauInteret === 'CHAUD') {
        action_recommandee = 'Contacter immédiatement. Lead très prometteur avec intention d\'achat claire.'
      } else if (niveauInteret === 'TIÈDE') {
        action_recommandee = 'Contacter sous 24-48h. Nourrir le lead avec des informations pertinentes.'
      } else {
        action_recommandee = 'Ajouter à la liste de suivi. Relancer pour obtenir plus d\'informations si nécessaire.'
      }
      
      // Retourner le format simplifié demandé
      return {
        niveau: niveauInteret.toLowerCase(), // chaud/tiède/froid
        score: Math.max(0, Math.min(100, score)), // Score entre 0 et 100
        raison: raison,
        action_recommandee: action_recommandee
      }
    } catch (error) {
      console.error('Erreur lors de la qualification:', error)
      // En cas d'erreur, retourner un résultat par défaut
      return {
        niveau: 'froid',
        score: 0,
        raison: 'Erreur lors de la qualification automatique',
        action_recommandee: 'Analyser manuellement ce lead'
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setQualificationResult(null)
    setLoading(true)

    // Validation du champ lead_role obligatoire
    if (!formData.lead_role) {
      setError('Veuillez sélectionner le type de contact (Client acheteur ou Propriétaire/bailleur)')
      setLoading(false)
      return
    }

    try {
      // Étape 1 : Qualification du lead
      const result = await qualifyLead(formData)
      setQualificationResult(result)

      // Étape 2 : Créer le lead avec les données de qualification
      const qualification = await aiService.qualifyLead(formData)
      const evaluation = qualification.evaluation_complete || qualification
      const niveauInteret = qualification.niveau_interet_final || qualification.niveau_interet || evaluation.niveau_interet

      const leadData = {
        ...formData,
        score_qualification: result.score,
        niveau_interet: niveauInteret,
        budget_estime: formData.budget || qualification.budget_estime || 'Non spécifié',
        urgence: qualification.urgence || 'moyenne',
        type_bien_recherche: formData.type_de_bien || qualification.type_bien_recherche || 'autre',
        localisation_souhaitee: qualification.localisation_souhaitee || null,
        points_forts: qualification.points_forts || [],
        points_attention: qualification.points_attention || [],
        recommandations: qualification.recommandations || [],
        resume: result.raison,
        qualification_data: qualification,
        evaluation_complete: evaluation
      }

      const { data: newLead, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()
      
      if (error) throw error
      
      if (onSuccess) {
        onSuccess(newLead)
      }
      
      // Ne pas fermer automatiquement, laisser l'utilisateur voir le résultat
      // onClose() sera appelé manuellement après consultation du résultat
    } catch (err) {
      console.error('Erreur lors de la création du lead:', err)
      setError(err.message || 'Une erreur est survenue lors de la création du lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Ajouter un nouveau lead</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* ÉTAPE 1: Rôle du lead - OBLIGATOIRE */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-bold text-blue-900 mb-3">
              Type de contact * <span className="text-xs font-normal">(choix obligatoire)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, lead_role: 'client' }))}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.lead_role === 'client'
                    ? 'border-blue-500 bg-blue-100 text-blue-900'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="text-2xl mb-2">🏠</div>
                <div className="font-semibold">Client acheteur</div>
                <div className="text-xs mt-1">Recherche un bien à acheter/ louer</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, lead_role: 'proprietaire' }))}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.lead_role === 'proprietaire'
                    ? 'border-green-500 bg-green-100 text-green-900'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                }`}
              >
                <div className="text-2xl mb-2">🔑</div>
                <div className="font-semibold">Propriétaire / Bailleur</div>
                <div className="text-xs mt-1">Vend ou loue un bien</div>
              </button>
            </div>
            {formData.lead_role && (
              <div className="mt-3 text-sm text-blue-700">
                ✅ Rôle sélectionné : <strong>{formData.lead_role === 'client' ? 'Client acheteur/locataire' : 'Propriétaire/bailleur'}</strong>
              </div>
            )}
          </div>

          {/* Champs communs */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet *
            </label>
            <input
              type="text"
              id="nom"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Jean Dupont"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="jean.dupont@example.com"
              />
            </div>

            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                id="telephone"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>

          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
              Source du lead
            </label>
            <select
              id="source"
              name="source"
              value={formData.source}
              onChange={handleChange}
              className="input-field"
            >
              <option value="site_web">Site web</option>
              <option value="reseaux_sociaux">Réseaux sociaux</option>
              <option value="reference">Référence</option>
              <option value="publicite">Publicité</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          {/* Champs spécifiques selon le rôle */}
          {formData.lead_role === 'client' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-blue-900">🏠 Informations de recherche</h3>
              
              <div>
                <label htmlFor="localisation_souhaitee" className="block text-sm font-medium text-blue-700 mb-1">
                  Localisation souhaitée *
                </label>
                <input
                  type="text"
                  id="localisation_souhaitee"
                  name="localisation_souhaitee"
                  value={formData.localisation_souhaitee}
                  onChange={handleChange}
                  required={formData.lead_role === 'client'}
                  className="input-field"
                  placeholder="Paris 15ème, Lyon, etc."
                />
              </div>

              <div>
                <label htmlFor="budget" className="block text-sm font-medium text-blue-700 mb-1">
                  Budget maximum (€) *
                </label>
                <input
                  type="number"
                  id="budget"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  required={formData.lead_role === 'client'}
                  className="input-field"
                  placeholder="Ex: 250000"
                  min="0"
                />
              </div>

              <div>
                <label htmlFor="criteres_specifiques" className="block text-sm font-medium text-blue-700 mb-1">
                  Critères spécifiques
                </label>
                <textarea
                  id="criteres_specifiques"
                  name="criteres_specifiques"
                  value={formData.criteres_specifiques}
                  onChange={handleChange}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Nombre de pièces, étage, ascenseur, parking, etc."
                />
              </div>
            </div>
          )}

          {formData.lead_role === 'proprietaire' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-green-900">🔑 Informations du bien</h3>
              
              <div>
                <label htmlFor="adresse_bien" className="block text-sm font-medium text-green-700 mb-1">
                  Adresse du bien *
                </label>
                <input
                  type="text"
                  id="adresse_bien"
                  name="adresse_bien"
                  value={formData.adresse_bien}
                  onChange={handleChange}
                  required={formData.lead_role === 'proprietaire'}
                  className="input-field"
                  placeholder="15 Rue de la Paix, 75001 Paris"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="surface" className="block text-sm font-medium text-green-700 mb-1">
                    Surface (m²) *
                  </label>
                  <input
                    type="number"
                    id="surface"
                    name="surface"
                    value={formData.surface}
                    onChange={handleChange}
                    required={formData.lead_role === 'proprietaire'}
                    className="input-field"
                    placeholder="75"
                    min="0"
                  />
                </div>

                <div>
                  <label htmlFor="nb_pieces" className="block text-sm font-medium text-green-700 mb-1">
                    Nombre de pièces *
                  </label>
                  <select
                    id="nb_pieces"
                    name="nb_pieces"
                    value={formData.nb_pieces}
                    onChange={handleChange}
                    required={formData.lead_role === 'proprietaire'}
                    className="input-field"
                  >
                    <option value="">Sélectionner</option>
                    <option value="1">1 pièce</option>
                    <option value="2">2 pièces</option>
                    <option value="3">3 pièces</option>
                    <option value="4">4 pièces</option>
                    <option value="5">5 pièces</option>
                    <option value="6+">6 pièces et plus</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="prix_vente" className="block text-sm font-medium text-green-700 mb-1">
                    Prix de vente (€) *
                  </label>
                  <input
                    type="number"
                    id="prix_vente"
                    name="prix_vente"
                    value={formData.prix_vente}
                    onChange={handleChange}
                    required={formData.lead_role === 'proprietaire'}
                    className="input-field"
                    placeholder="350000"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="date_disponibilite" className="block text-sm font-medium text-green-700 mb-1">
                  Date de disponibilité *
                </label>
                <select
                  id="date_disponibilite"
                  name="date_disponibilite"
                  value={formData.date_disponibilite}
                  onChange={handleChange}
                  required={formData.lead_role === 'proprietaire'}
                  className="input-field"
                >
                  <option value="">Sélectionner</option>
                  <option value="immediat">Immédiat</option>
                  <option value="1_mois">Dans 1 mois</option>
                  <option value="3_mois">Dans 3 mois</option>
                  <option value="6_mois">Dans 6 mois</option>
                  <option value="plus_6_mois">Plus de 6 mois</option>
                </select>
              </div>
            </div>
          )}

          {/* Masquer les champs standards si rôle défini */}
          {formData.lead_role === 'proprietaire' ? (
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
                Budget souhaité par le propriétaire (€)
              </label>
              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className="input-field"
                placeholder="Budget de référence (optionnel)"
                min="0"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
                Budget (€)
              </label>
              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className="input-field"
                placeholder="Ex: 250000"
                min="0"
              />
            </div>
          )}

          <div>
            <label htmlFor="type_de_bien" className="block text-sm font-medium text-gray-700 mb-1">
              Type de bien
            </label>
            <select
              id="type_de_bien"
              name="type_de_bien"
              value={formData.type_de_bien}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Sélectionnez un type</option>
              <option value="appartement">Appartement</option>
              <option value="maison">Maison</option>
              <option value="studio">Studio</option>
              <option value="villa">Villa</option>
              <option value="terrain">Terrain</option>
              <option value="commercial">Local commercial</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div>
            <label htmlFor="delai_achat" className="block text-sm font-medium text-gray-700 mb-1">
              Délai d'achat
            </label>
            <select
              id="delai_achat"
              name="delai_achat"
              value={formData.delai_achat}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Sélectionnez un délai</option>
              <option value="immediat">Immédiat (moins de 1 mois)</option>
              <option value="court">Court terme (1-3 mois)</option>
              <option value="moyen">Moyen terme (3-6 mois)</option>
              <option value="long">Long terme (plus de 6 mois)</option>
              <option value="indefini">Indéfini / Envisage</option>
            </select>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Message / Besoins
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="input-field resize-none"
              placeholder="Décrivez les besoins du client (localisation, critères spécifiques, etc.)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Qualification en cours...
                </span>
              ) : (
                'Qualifier et enregistrer'
              )}
            </button>
          </div>
        </form>

        {/* Affichage du résultat de qualification */}
        {qualificationResult && (
          <div className="px-6 pb-6">
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              qualificationResult.niveau === 'chaud' 
                ? 'bg-red-50 border-red-300' 
                : qualificationResult.niveau === 'tiède'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-blue-50 border-blue-300'
            }`}>
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                Résultat de la qualification
              </h3>
              
              <div className="space-y-3">
                {/* Niveau */}
                <div>
                  <span className="text-sm font-medium text-gray-700">Niveau : </span>
                  <span className={`font-bold ${
                    qualificationResult.niveau === 'chaud' 
                      ? 'text-red-700' 
                      : qualificationResult.niveau === 'tiède'
                      ? 'text-yellow-700'
                      : 'text-blue-700'
                  }`}>
                    {qualificationResult.niveau.toUpperCase()}
                  </span>
                </div>

                {/* Score IA */}
                <div>
                  <span className="text-sm font-medium text-gray-700">Score IA : </span>
                  <span className="font-bold text-gray-900">{qualificationResult.score}/100</span>
                  <span className="text-gray-400 cursor-help ml-1" title="Calculé automatiquement par l'IA selon le profil et la probabilité de conversion du lead.">ℹ️</span>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        qualificationResult.score >= 75 
                          ? 'bg-red-600' 
                          : qualificationResult.score >= 50
                          ? 'bg-yellow-600'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${qualificationResult.score}%` }}
                    ></div>
                  </div>
                </div>

                {/* Raison */}
                <div>
                  <span className="text-sm font-medium text-gray-700">Raison : </span>
                  <p className="text-gray-800 mt-1">{qualificationResult.raison}</p>
                </div>

                {/* Action recommandée */}
                <div>
                  <span className="text-sm font-medium text-gray-700">Action recommandée : </span>
                  <p className="text-gray-800 mt-1">{qualificationResult.action_recommandee}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-300">
                <button
                  onClick={onClose}
                  className="btn-primary w-full"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LeadForm

