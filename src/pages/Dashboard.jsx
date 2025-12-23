import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { aiService } from '../services/ai'

// URL de l'API Flask backend
const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  
  // État pour le KPI manuel (peut être mis à jour via la fonction mettreAJourKPILeads)
  const [kpiLeadsManuel, setKpiLeadsManuel] = useState(null)
  
  // État pour le formulaire de génération d'annonce
  const [annonceForm, setAnnonceForm] = useState({
    adresse: '',
    pieces_surface: '',
    description: '',
    dpe: '',
    prix: ''
  })
  const [annonceLoading, setAnnonceLoading] = useState(false)
  const [annonceGeneree, setAnnonceGeneree] = useState(null)
  const [annonceError, setAnnonceError] = useState(null)
  
  // État pour le KPI "Temps économisé ce mois"
  const [tempsEconomise, setTempsEconomise] = useState(5) // Valeur initiale : 5 heures

  // Données simulées de 5 leads qualifiés (au moins 3 avec score >= 8)
  const leadsSimules = [
    {
      id: 1,
      nom: 'Mme Durand',
      email: 'durand.marie@email.com',
      score_qualification: 90, // Score 9/10
      urgence: 'chaud',
      statut: 'Prioritaire',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      nom: 'M. Lefevre',
      email: 'lefevre.pierre@email.com',
      score_qualification: 50, // Score 5/10
      urgence: 'tiède',
      statut: 'En cours',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      nom: 'M. Dubois',
      email: 'dubois.jean@email.com',
      score_qualification: 100, // Score 10/10
      urgence: 'chaud',
      statut: 'Prioritaire',
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      nom: 'Mme Martin',
      email: 'martin.sophie@email.com',
      score_qualification: 85, // Score 8.5/10
      urgence: 'chaud',
      statut: 'Prioritaire',
      created_at: new Date().toISOString()
    },
    {
      id: 5,
      nom: 'M. Bernard',
      email: 'bernard.paul@email.com',
      score_qualification: 40, // Score 4/10
      urgence: 'froid',
      statut: 'En attente',
      created_at: new Date().toISOString()
    }
  ]

  // Données simulées des 3 prochains RDV pour la semaine
  const rdvSimules = [
    {
      id: 1,
      nom: 'Marie Dupont',
      type: 'Visite de bien',
      adresse: '45 Avenue des Champs-Élysées, 75008 Paris',
      date: 'Lundi 15 Janvier 2024',
      heure: '14:00',
      statut: 'Confirmé'
    },
    {
      id: 2,
      nom: 'Jean Martin',
      type: 'Signature de compromis',
      adresse: '12 Rue de la République, 69001 Lyon',
      date: 'Mercredi 17 Janvier 2024',
      heure: '10:30',
      statut: 'Confirmé'
    },
    {
      id: 3,
      nom: 'Sophie Bernard',
      type: 'Estimation de bien',
      adresse: '78 Boulevard Saint-Michel, 75005 Paris',
      date: 'Vendredi 19 Janvier 2024',
      heure: '16:00',
      statut: 'En attente'
    }
  ]

  // Charger les leads chauds depuis l'API Flask backend
  useEffect(() => {
    const fetchLeadsChauds = async () => {
      setLoading(true)
      
      try {
        // Appeler l'API Flask pour récupérer les leads chauds
        const response = await fetch(`${API_BACKEND_URL}/leads-chauds`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Mode cors est activé par défaut, mais on le spécifie explicitement
          mode: 'cors',
        })
        
        if (!response.ok) {
          // Vérifier si c'est une erreur CORS
          if (response.status === 0 || response.type === 'opaque') {
            throw new Error('Erreur CORS : Le serveur backend n\'est peut-être pas accessible. Vérifiez que le serveur Flask est lancé sur le port 5000.')
          }
          throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (result.status === 'success' && result.data) {
          // Convertir les données de l'API au format attendu par le Dashboard
          const leadsFormates = result.data.map(lead => ({
            id: lead.id,
            nom: lead.nom_client,
            email: lead.email_client,
            score_qualification: lead.score_qualification_ia * 10, // Convertir 1-10 en 10-100 pour compatibilité
            urgence: lead.score_qualification_ia >= 9 ? 'chaud' : lead.score_qualification_ia >= 8 ? 'tiède' : 'froid',
            recommandations: lead.recommandation_ia || '',
            created_at: lead.created_at,
            statut_rdv: lead.statut_rdv
          }))
          
          setLeads(leadsFormates.length > 0 ? leadsFormates : leadsSimules)
        } else {
          // En cas d'erreur ou pas de données, utiliser les données simulées
          console.warn('[DASHBOARD] Aucune donnée de l\'API, utilisation des données simulées')
          setLeads(leadsSimules)
        }
      } catch (err) {
        console.error('[DASHBOARD] Erreur lors du chargement des leads depuis l\'API:', err)
        
        // Afficher un message d'erreur plus détaillé pour les erreurs CORS
        if (err.message && err.message.includes('CORS')) {
          console.warn('[DASHBOARD] Erreur CORS détectée. Vérifiez :')
          console.warn('  1. Le serveur Flask est lancé sur http://localhost:5005')
          console.warn('  2. flask-cors est installé et configuré')
          console.warn('  3. L\'origine http://localhost:5173 est autorisée dans app.py')
        } else if (err.message && err.message.includes('Failed to fetch')) {
          console.warn('[DASHBOARD] Impossible de se connecter au serveur backend.')
          console.warn('  Vérifiez que le serveur Flask est lancé : python backend/run.py')
        }
        
        // En cas d'erreur, utiliser les données simulées
        setLeads(leadsSimules)
      } finally {
        setLoading(false)
      }
    }

    fetchLeadsChauds()
  }, [])

  // Calculer les stats UNIQUEMENT à partir de leads (champs réels de Supabase)
  const total = leads.length
  const scoreMoyen =
    total === 0
      ? 0
      : Math.round(
          leads.reduce((sum, l) => {
            const score = l.score_qualification || 0
            return sum + score
          }, 0) / total
        )

  // Utiliser le champ urgence (qui contient le niveau : chaud/tiède/froid)
  const chauds = leads.filter(l => l.urgence === 'chaud').length
  const tiedes = leads.filter(l => l.urgence === 'tiède').length
  const froids = leads.filter(l => l.urgence === 'froid').length

  // Convertir score 0-100 en 0-10 pour l'affichage
  const scoreTo10 = (score) => {
    return Math.round((score / 100) * 10)
  }

  // Déterminer le statut d'un lead
  const getStatut = (lead) => {
    const score = lead.score_qualification || 0
    if (score > 80) return 'Prioritaire'
    if (score > 50) return 'En cours'
    return 'En attente'
  }

  // Leads chauds avec score >= 80 (équivalent à >= 8 sur 10)
  // C'est le compte exact utilisé pour le KPI
  const leadsChauds = leads.filter(l => {
    const score = l.score_qualification || 0
    return score >= 80 // Score >= 8 sur 10 (80/100)
  })

  // Préparer les leads pour l'affichage dans le tableau
  // Utiliser UNIQUEMENT les leads réels qualifiés par l'IA
  const leadsAffiches = leads.map(lead => {
    const score = lead.score_qualification || 0
    const score10 = scoreTo10(score)
    
    // Convertir urgence (chaud/tiède/froid) en format d'affichage
    let urgenceDisplay = 'Faible'
    if (lead.urgence === 'chaud') urgenceDisplay = 'Élevée'
    else if (lead.urgence === 'tiède') urgenceDisplay = 'Moyenne'
    
    return {
      id: lead.id,
      nom: lead.nom,
      email: lead.email,
      score: score10,
      scoreOriginal: score, // Garder le score original pour la mise en évidence
      urgence: urgenceDisplay,
      statut: getStatut(lead),
      created_at: lead.created_at
    }
  }).sort((a, b) => {
    // Trier par score décroissant (les meilleurs en premier)
    return b.scoreOriginal - a.scoreOriginal
  })

  // ============================================
  // FONCTIONS D'ASSISTANCE SIMPLES
  // ============================================

  /**
   * Fonction pour mettre à jour la valeur du KPI dans la Carte de Qualification
   * @param {number} nombre - Le nouveau nombre de leads qualifiés
   */
  const mettreAJourKPILeads = (nombre) => {
    if (typeof nombre === 'number' && nombre >= 0) {
      setKpiLeadsManuel(nombre)
      console.log(`[Dashboard] KPI Leads mis à jour : ${nombre}`)
    } else {
      console.warn('[Dashboard] mettreAJourKPILeads : nombre invalide, doit être un nombre >= 0')
    }
  }

  /**
   * Fonction pour afficher le texte de l'annonce générée dans la Carte de Production
   * @param {string} texte - Le texte de l'annonce à afficher
   */
  const afficherAnnonceGeneree = (texte) => {
    if (typeof texte === 'string' && texte.trim()) {
      setAnnonceGeneree(texte)
      setAnnonceError(null)
      console.log('[Dashboard] Annonce générée affichée')
    } else {
      console.warn('[Dashboard] afficherAnnonceGeneree : texte invalide ou vide')
    }
  }

  /**
   * Fonction pour simuler la génération d'annonce par l'IA
   * Génère un texte d'annonce professionnelle de 4-5 paragraphes
   * @param {Object} donnees - Les données du formulaire
   * @returns {string} - Le texte de l'annonce générée
   */
  const simulerGenerationAnnonceIA = (donnees) => {
    const { adresse, prix, dpe, pieces_surface, description } = donnees
    
    // Extraire le nombre de pièces et la surface si possible
    const piecesMatch = pieces_surface.match(/(\d+)\s*pièces?/i)
    const surfaceMatch = pieces_surface.match(/(\d+)\s*m²/i)
    const nbPieces = piecesMatch ? piecesMatch[1] : 'X'
    const surface = surfaceMatch ? surfaceMatch[1] : 'XX'
    
    // Générer une annonce professionnelle de 4-5 paragraphes
    const annonce = `🏠 ${nbPieces} pièces, ${surface} m² - ${adresse}

${description ? `✨ ${description}` : '✨ Appartement exceptionnel'}

Situé à ${adresse}, ce bien immobilier de ${nbPieces} pièces et ${surface} m² représente une opportunité rare sur le marché. 

Le Diagnostic de Performance Énergétique (DPE) classe ce bien en catégorie ${dpe}, témoignant d'une consommation énergétique optimisée et d'un confort de vie remarquable.

Avec un prix de vente de ${prix}, cette propriété offre un excellent rapport qualité-prix dans un secteur recherché. L'emplacement privilégié garantit un cadre de vie agréable avec tous les commerces et services à proximité.

N'hésitez pas à nous contacter pour organiser une visite et découvrir tous les atouts de ce bien exceptionnel.`

    return annonce
  }

  /**
   * Fonction pour planifier un RDV via l'API backend
   * @param {number} leadId - ID du lead pour lequel planifier le RDV
   */
  const planifierRDV = async (leadId) => {
    try {
      const response = await fetch(`${API_BACKEND_URL}/planifier-rdv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({ lead_id: leadId })
      })

      if (!response.ok) {
        // Vérifier si c'est une erreur CORS
        if (response.status === 0 || response.type === 'opaque') {
          throw new Error('Erreur CORS : Impossible de communiquer avec le serveur backend.')
        }
        throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`)
      }

      const result = await response.json()

      if (result.status === 'success') {
        alert(`RDV planifié avec succès pour ${result.data.nom_client}!\n${result.data.statut_rdv}`)
        
        // Recharger les leads pour mettre à jour le statut
        const refreshResponse = await fetch(`${API_BACKEND_URL}/leads-chauds`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors',
        })
        if (refreshResponse.ok) {
          const refreshResult = await refreshResponse.json()
          if (refreshResult.status === 'success' && refreshResult.data) {
            const leadsFormates = refreshResult.data.map(lead => ({
              id: lead.id,
              nom: lead.nom_client,
              email: lead.email_client,
              score_qualification: lead.score_qualification_ia * 10, // Convertir 1-10 en 10-100
              urgence: lead.score_qualification_ia >= 9 ? 'chaud' : lead.score_qualification_ia >= 8 ? 'tiède' : 'froid',
              recommandations: lead.recommandation_ia || '',
              created_at: lead.created_at,
              statut_rdv: lead.statut_rdv
            }))
            setLeads(leadsFormates.length > 0 ? leadsFormates : leadsSimules)
          }
        }
      } else {
        alert(`Erreur: ${result.message}`)
      }
    } catch (error) {
      console.error('[DASHBOARD] Erreur lors de la planification du RDV:', error)
      alert(`Erreur lors de la planification du RDV: ${error.message}`)
    }
  }

  /**
   * Fonction pour soumettre la génération d'annonce
   * Capture les 5 champs du formulaire, simule une annonce IA et l'affiche
   */
  const soumettreGenerationAnnonce = () => {
    // Capturer les 5 champs du formulaire
    const { adresse, prix, dpe, pieces_surface, description } = annonceForm

    // Validation des champs requis
    if (!adresse || !prix || !dpe || !pieces_surface) {
      setAnnonceError('Veuillez remplir tous les champs requis (Adresse, Prix, DPE, Pièces et Surface).')
      return
    }

    // Réinitialiser les erreurs
    setAnnonceError(null)
    setAnnonceLoading(true)

    // Simuler un délai de génération (pour l'effet réaliste)
    setTimeout(() => {
      // Simulation IA : Générer une annonce professionnelle
      const annonceGeneree = simulerGenerationAnnonceIA({
        adresse,
        prix,
        dpe,
        pieces_surface,
        description: description || ''
      })

      // Afficher l'annonce générée
      afficherAnnonceGeneree(annonceGeneree)

      // Mettre à jour le KPI "Temps économisé ce mois"
      // Après le premier clic, passer de 5 à 6 heures
      setTempsEconomise(prev => prev + 1)

      setAnnonceLoading(false)
      
      console.log('[Dashboard] Annonce générée avec succès :', {
        adresse,
        prix,
        dpe,
        pieces_surface,
        description: description || '(vide)'
      })
    }, 800) // Délai de 800ms pour simuler le traitement IA
  }

  // Gestion du formulaire d'annonce
  const handleAnnonceChange = (e) => {
    const { name, value } = e.target
    setAnnonceForm(prev => ({
      ...prev,
      [name]: value
    }))
    if (annonceError) setAnnonceError(null)
  }

  const handleAnnonceSubmit = async (e) => {
    e.preventDefault()
    
    // Pour l'instant, utiliser la fonction simple qui affiche juste une alerte
    soumettreGenerationAnnonce()
    
    // Code commenté pour l'intégration future avec l'IA
    /*
    setAnnonceLoading(true)
    setAnnonceError(null)
    setAnnonceGeneree(null)

    // Validation des champs requis
    if (!annonceForm.adresse || !annonceForm.pieces_surface || !annonceForm.dpe || !annonceForm.prix) {
      setAnnonceError('Veuillez remplir tous les champs requis.')
      setAnnonceLoading(false)
      return
    }

    try {
      const annonce = await aiService.generateAnnonce(annonceForm)
      afficherAnnonceGeneree(annonce)
      
      // Réinitialiser le formulaire après succès
      setAnnonceForm({
        adresse: '',
        pieces_surface: '',
        description: '',
        dpe: '',
        prix: ''
      })
      
      // Forcer le rechargement de la page pour mettre à jour le Dashboard
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      console.error('Erreur lors de la génération de l\'annonce:', error)
      setAnnonceError(error.message || 'Erreur lors de la génération de l\'annonce. Veuillez réessayer.')
      setAnnonceLoading(false)
    }
    */
  }

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ fontFamily: 'Inter, Roboto, system-ui, sans-serif', backgroundColor: '#f8f9fa' }}>
      {/* Barre de navigation horizontale - Large espacement horizontal (30px) entre les liens */}
      <nav className="bg-white border-b border-gray-200 px-8 py-5" style={{ fontFamily: 'Inter, Roboto, system-ui, sans-serif' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">LeadQualif IA</h1>
          <div className="flex items-center" style={{ gap: '30px' }}>
            <NavLink to="/dashboard" currentPath={location.pathname}>
              Tableau de bord
            </NavLink>
            <NavLink to="/" currentPath={location.pathname}>
              Qualification
            </NavLink>
            <NavLink to="/biens" currentPath={location.pathname}>
              Biens
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Contenu principal - Plein écran (100% largeur et hauteur) */}
      <main className="h-[calc(100vh-81px)] w-full p-6 overflow-y-auto" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="h-full flex flex-col" style={{ gap: '20px' }}>

          {/* Grille PC - 2 colonnes côte à côte (50%/50% de la largeur disponible) */}
          <div className="grid grid-cols-2 flex-shrink-0" style={{ gap: '20px' }}>
            {/* Colonne 1 (50% largeur) : Carte Qualification des Leads */}
            <div 
              className="bg-white rounded-lg border border-gray-200"
              style={{ 
                boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
                padding: '20px'
              }}
            >
              <h2 className="text-xl font-semibold" style={{ color: '#007bff', marginBottom: '20px' }}>
                Qualification des Leads
              </h2>
              
              {/* KPI : Leads Qualifiés Chauds (Score > 8) */}
              <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <p className="text-sm text-gray-600" style={{ marginBottom: '20px' }}>
                  Leads Qualifiés Chauds (Score {'>'} 8)
                </p>
                <p 
                  id="kpiLeadsChauds"
                  className="text-6xl font-bold text-[#007bff]"
                >
                  {loading ? '0' : (kpiLeadsManuel !== null ? kpiLeadsManuel : leadsChauds.length)}
                </p>
              </div>

              {/* Tableau des leads - S'étend sur toute la largeur disponible */}
              {loading ? (
                <p className="text-gray-500 text-sm">Chargement des leads...</p>
              ) : leadsAffiches.length === 0 ? (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm" style={{ width: '100%' }}>
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-4 px-4 font-semibold text-gray-700">
                          Nom
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-gray-700">
                          Score IA
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-gray-700">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan="3" className="py-8 px-4 text-center text-gray-500 text-sm">
                          Aucun lead qualifié pour le moment
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm" style={{ width: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-4 px-4 font-semibold text-gray-700">
                          Nom
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-gray-700">
                          Score IA
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-gray-700">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsAffiches.slice(0, 10).map(lead => {
                        const scoreEleve = lead.score >= 8
                        const action = lead.statut || 'En attente'
                        return (
                          <tr 
                            key={lead.id} 
                            className={`border-b transition-colors ${
                              scoreEleve 
                                ? 'bg-blue-50 border-[#007bff] hover:bg-blue-100' 
                                : 'border-gray-100 hover:bg-gray-50'
                            }`}
                            style={scoreEleve ? { borderLeft: '3px solid #007bff' } : {}}
                          >
                            <td className="py-4 px-4">
                              <p className={`font-medium ${scoreEleve ? 'text-gray-900' : 'text-gray-700'}`}>
                                {lead.nom}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <span 
                                className={scoreEleve 
                                  ? 'font-bold text-[#007bff] text-lg' 
                                  : 'font-semibold text-gray-900'
                                }
                              >
                                {lead.score}/10
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              {scoreEleve ? (
                                <button
                                  onClick={() => planifierRDV(lead.id)}
                                  className="bg-[#007bff] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0056b3] transition-colors shadow-sm"
                                  style={{ minWidth: '120px' }}
                                >
                                  Planifier RDV
                                </button>
                              ) : (
                                <button
                                  onClick={() => planifierRDV(lead.id)}
                                  className="bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-300 transition-colors"
                                >
                                  Planifier RDV
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Colonne 2 (50% largeur) : Carte Outil de Production : Annonces */}
            <div 
              className="bg-white rounded-lg border border-gray-200"
              style={{ 
                boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
                padding: '20px'
              }}
            >
              <h2 className="text-xl font-semibold" style={{ color: '#007bff', marginBottom: '20px' }}>
                Outil de Production : Annonces
              </h2>
              
              {/* KPI : Temps économisé ce mois */}
              <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <p className="text-sm text-gray-600" style={{ marginBottom: '8px' }}>
                  Temps économisé ce mois
                </p>
                <p className="text-2xl font-bold text-[#007bff]">
                  {tempsEconomise} {tempsEconomise > 1 ? 'heures' : 'heure'}
                </p>
      </div>

              {/* Formulaire de génération d'annonce - Largeur limitée à 300px pour un design aéré et professionnel */}
              <form onSubmit={handleAnnonceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '300px', marginTop: '20px' }}>
                {/* Adresse complète */}
                <div>
                    <label htmlFor="adresse" className="block text-sm font-medium text-gray-700" style={{ marginBottom: '10px' }}>
                      Adresse
                    </label>
                  <input
                    type="text"
                    id="adresse"
                    name="adresse"
                    value={annonceForm.adresse}
                    onChange={handleAnnonceChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff] outline-none"
                    placeholder="Ex: 123 Rue de la Paix, 75001 Paris"
                  />
                </div>

                {/* Prix */}
                <div>
                    <label htmlFor="prix" className="block text-sm font-medium text-gray-700" style={{ marginBottom: '10px' }}>
                      Prix
                    </label>
                  <input
                    type="text"
                    id="prix"
                    name="prix"
                    value={annonceForm.prix}
                    onChange={handleAnnonceChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff] outline-none"
                    placeholder="Ex: 450 000 €"
                  />
                </div>

                {/* DPE */}
                <div>
                    <label htmlFor="dpe" className="block text-sm font-medium text-gray-700" style={{ marginBottom: '10px' }}>
                      DPE
                    </label>
                  <input
                    type="text"
                    id="dpe"
                    name="dpe"
                    value={annonceForm.dpe}
                    onChange={handleAnnonceChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff] outline-none"
                    placeholder="Ex: C"
                  />
                </div>

                {/* Nombre de pièces et surface */}
                <div>
                    <label htmlFor="pieces_surface" className="block text-sm font-medium text-gray-700" style={{ marginBottom: '10px' }}>
                      Pièces et Surface
                    </label>
                  <input
                    type="text"
                    id="pieces_surface"
                    name="pieces_surface"
                    value={annonceForm.pieces_surface}
                    onChange={handleAnnonceChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff] outline-none"
                    placeholder="Ex: 4 pièces, 85 m²"
                  />
                </div>

                {/* Description brute */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700" style={{ marginBottom: '10px' }}>
                      Description
                    </label>
                  <textarea
                    id="description"
                    name="description"
                    value={annonceForm.description}
                    onChange={handleAnnonceChange}
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff] outline-none"
                    placeholder="Ex: Appartement lumineux, balcon, proche métro..."
                  />
                </div>

                {/* Message d'erreur */}
                {annonceError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {annonceError}
                  </div>
                )}

                {/* Bouton de soumission - Lié à soumettreGenerationAnnonce() */}
                <button
                  type="submit"
                  disabled={annonceLoading}
                  onClick={(e) => {
                    e.preventDefault()
                    soumettreGenerationAnnonce()
                  }}
                  className="w-full bg-[#007bff] text-white font-semibold py-4 px-6 rounded-lg hover:bg-[#0056b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {annonceLoading ? 'Génération en cours...' : 'Générer Annonce Optimisée'}
                </button>
              </form>

              {/* Zone de texte pour afficher le résultat de l'IA - ID: resultatAnnonceIA */}
              <div 
                id="resultatAnnonceIA"
                className="border-t border-gray-200"
                style={{ minHeight: '100px', paddingTop: '20px', marginTop: '20px' }}
              >
                {annonceGeneree ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-semibold text-gray-900">Résultat Généré</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(annonceGeneree)
                          alert('Annonce copiée dans le presse-papiers !')
                        }}
                        className="bg-[#007bff] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#0056b3] transition-colors"
                      >
                        Copier le Texte
      </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                        {annonceGeneree}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <p className="text-sm text-gray-500 italic">
                      Le résultat de l'annonce générée par l'IA apparaîtra ici...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* En Bas (Pleine Largeur - 100%) : Carte Suivi des Actions & RDV */}
          <div 
            className="bg-white rounded-lg border border-gray-200 flex-1 flex flex-col min-h-0"
            style={{ 
              boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
              padding: '20px'
            }}
          >
            <h2 className="text-xl font-semibold" style={{ color: '#007bff', marginBottom: '20px' }}>
              Suivi des Actions & RDV
            </h2>
            
            <div className="flex-1 overflow-y-auto">
              {/* Tableau simulé des 3 prochains RDV pour la semaine */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm" style={{ width: '100%' }}>
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Nom du Client
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Type de RDV
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Adresse
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Date & Heure
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdvSimules.map(rdv => (
                      <tr 
                        key={rdv.id} 
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">{rdv.nom}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-700">{rdv.type}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-700 text-sm">{rdv.adresse}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">{rdv.date}</p>
                          <p className="text-sm text-gray-600">{rdv.heure}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`text-xs font-medium px-3 py-1 rounded ${
                              rdv.statut === 'Confirmé'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {rdv.statut.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Composant pour les liens de navigation - Espacement horizontal large
function NavLink({ to, currentPath, children }) {
  const isActive = currentPath === to
  return (
    <Link
      to={to}
      className={`px-5 py-2 rounded-lg transition-colors text-sm font-medium ${
        isActive
          ? 'bg-[#007bff] text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      // Marges horizontales généreuses pour espacer clairement les liens,
      // même si les classes Tailwind ou la propriété gap ne sont pas appliquées.
      style={{ marginLeft: '20px', marginRight: '20px', textDecoration: 'none' }}
    >
      {children}
    </Link>
  )
}
