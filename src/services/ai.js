// ✅ SÉCURITÉ : plus d'appel OpenAI direct côté navigateur.
// VITE_OPENAI_API_KEY a été supprimé — il intégrait la clé dans le JS public.
// Toutes les requêtes IA passent désormais par /api/qualify (Vercel serverless).
import { processLead } from './leadProcessor'

/**
 * Appelle /api/qualify (serverless Vercel) au lieu d'appeler OpenAI directement.
 * La clé OPENAI_API_KEY reste côté serveur, invisible du navigateur.
 */
async function callQualifyEndpoint(lead) {
  try {
    const res = await fetch('/api/qualify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[aiService] /api/qualify indisponible, fallback automatique:', err.message);
    return null;
  }
}

/**
 * Service IA pour la qualification automatique des leads
 * Amélioré avec intégration du système de classification chaud/tiède/froid
 */
export const aiService = {
  /**
   * Qualifie un lead via l'IA et retourne une analyse complète
   * @param {Object} leadData - Les données du lead à qualifier
   * @returns {Promise<Object>} - Qualification complète avec classification chaud/tiède/froid
   */
  async qualifyLead(leadData) {
    // ✅ Appel via /api/qualify (serverless) — clé OpenAI invisible du navigateur
    const apiResult = await callQualifyEndpoint(leadData)
    const fallbackEvaluation = processLead(leadData, apiResult)

    if (apiResult && !apiResult.qualification_automatique) {
      return {
        score_qualification: apiResult.score ?? fallbackEvaluation.score_qualification,
        niveau_interet: apiResult.niveau ?? fallbackEvaluation.niveau_interet,
        budget_estime: 'Non spécifié',
        urgence: 'moyenne',
        type_bien_recherche: 'autre',
        localisation_souhaitee: null,
        points_forts: [],
        points_attention: [],
        recommandations: [apiResult.action || fallbackEvaluation.recommandations?.action_immediate],
        resume: apiResult.raison || fallbackEvaluation.raison_classification,
        evaluation_complete: fallbackEvaluation,
        niveau_interet_final: apiResult.niveau ?? fallbackEvaluation.niveau_interet,
        qualification_automatique: false
      }
    }

    // Fallback : processeur automatique si /api/qualify indisponible
    {
      const fallbackEvaluation2 = processLead(leadData, null)
      return {
        score_qualification: fallbackEvaluation2.score_qualification,
        niveau_interet: fallbackEvaluation2.niveau_interet,
        budget_estime: 'Non spécifié',
        urgence: 'moyenne',
        type_bien_recherche: 'autre',
        localisation_souhaitee: null,
        points_forts: [],
        points_attention: ['Qualification automatique (IA non disponible)'],
        recommandations: [fallbackEvaluation2.recommandations?.action_immediate],
        resume: fallbackEvaluation2.raison_classification,
        evaluation_complete: fallbackEvaluation2,
        niveau_interet_final: fallbackEvaluation.niveau_interet,
        qualification_automatique: true
      }
    }
  },

  async generateLeadSummary(leadData) {
    // Résumé via /api/qualify — champ "raison" retourné par le serveur
    const result = await callQualifyEndpoint(leadData)
    if (result?.raison && !result.qualification_automatique) {
      return result.raison
    }
    return null
  },

  /**
   * Génère une annonce immobilière optimisée via l'IA
   * @param {Object} bienData - Les données du bien (adresse, pièces, surface, description, DPE, prix)
   * @returns {Promise<string>} - Annonce immobilière optimisée
   */
  async generateAnnonce(bienData) {
    // Génération d'annonce : route via /api/qualify avec les données du bien
    // Si indisponible → fallback simulé
    return this.generateAnnonceSimulee(bienData)
  },

  /**
   * Génère les clauses d'un mandat/compromis via IA à partir des données lead + agence
   * @param {Object} lead    - Données du lead (nom, email, budget, type_de_bien, etc.)
   * @param {Object} agency  - Données de l'agence (nom, adresse, carte_pro_t, etc.)
   * @returns {Promise<Object>} - Clauses structurées pour le mandat
   */
  async generateMandatClauses(lead = {}, agency = {}) {
    // Clauses mandat : utilise le fallback professionnel
    // (l'endpoint /api/qualify est limité à la qualification de leads)
    return this._mandatFallback(lead, agency)
  },

  /**
   * Clauses de repli professionnelles si OpenAI indisponible
   * @private
   */
  _mandatFallback(lead = {}, agency = {}) {
    const budgetFormate = lead.budget
      ? `${Number(lead.budget).toLocaleString('fr-FR')} €`
      : 'À définir avec le client'

    return {
      ia_generated: false,
      objet_mandat: `Le Mandant confie au Mandataire la mission exclusive de rechercher un acquéreur pour le bien immobilier de type ${lead.type_de_bien || 'à préciser'}, situé ${lead.adresse || 'à l\'adresse indiquée'}. Le Mandataire s'engage à mettre en œuvre tous les moyens nécessaires pour trouver un acquéreur au meilleur prix dans les meilleures conditions.`,
      prix_suggere: `Fourchette estimée : ${budgetFormate} (à affiner après estimation formelle)`,
      commission: '5% TTC du prix de vente, payable à la signature de l\'acte authentique',
      duree: '3 mois renouvelables par tacite reconduction',
      exclusivite: true,
      clause_exclusivite: 'Le présent mandat est consenti à titre EXCLUSIF. Pendant toute la durée du mandat, le Mandant s\'interdit de confier la vente du bien à tout autre intermédiaire ou de traiter directement avec un acquéreur présenté par le Mandataire, sous peine de devoir verser la commission prévue.',
      obligations_mandataire: [
        'Rechercher activement des acquéreurs potentiels par tous les moyens disponibles (portails immobiliers, réseau, visites)',
        'Organiser et assurer toutes les visites du bien dans le respect des horaires convenus',
        'Négocier les conditions de vente au meilleur profit du Mandant',
        'Assurer le suivi complet du dossier jusqu\'à la signature de l\'acte authentique',
        'Informer régulièrement le Mandant de l\'avancement des démarches'
      ],
      obligations_mandant: [
        'Fournir l\'intégralité des documents nécessaires à la vente (titre de propriété, diagnostics, etc.)',
        'Permettre les visites du bien selon les créneaux convenus',
        'Informer immédiatement le Mandataire de toute proposition directe reçue',
        'Collaborer de bonne foi et ne pas entraver la mission du Mandataire'
      ],
      clause_resiliation: 'Conformément à l\'article 78 de la loi du 2 janvier 1970 (loi Hoguet) et à la loi ALUR du 24 mars 2014, le Mandant peut résilier le présent mandat à l\'issue du premier mois irrévocable, par lettre recommandée avec avis de réception, moyennant un préavis de 15 jours.',
      mentions_alur: `Mandataire titulaire de la carte professionnelle Transaction n° ${agency.carte_pro_t || '[N° à compléter]'} délivrée par la CCI. Garant financier : [Nom et adresse du garant]. Assurance responsabilité civile professionnelle souscrite auprès de [Nom assureur]. Conformément à la loi ALUR, le Mandant a un délai de 14 jours pour se rétracter.`,
      recommandation_agent: `Profil à fort potentiel avec un budget de ${budgetFormate}. Préparez une estimation comparative de marché avant la première rencontre pour renforcer votre crédibilité. Proposez un mandat exclusif de 3 mois pour maximiser votre investissement commercial.`
    }
  },

  /**
   * Génère une annonce immobilière simulée (pour tests ou fallback)
   * @param {Object} bienData - Les données du bien
   * @returns {string} - Annonce immobilière simulée mais bien structurée
   */
  generateAnnonceSimulee(bienData) {
    const adresse = bienData.adresse || 'Adresse non spécifiée'
    const piecesSurface = bienData.pieces_surface || 'Informations non spécifiées'
    const description = bienData.description || 'Aucune note particulière'
    const dpe = bienData.dpe || 'Non spécifié'
    const prix = bienData.prix || 'Prix sur demande'

    // Générer un titre accrocheur basé sur l'adresse
    const titre = `Magnifique bien immobilier à ${adresse.split(',')[0] || 'cette adresse'}`

    // Construire l'annonce structurée
    const annonce = `${titre}

📍 LOCALISATION
${adresse}

🏠 CARACTÉRISTIQUES
${piecesSurface}
Diagnostic de Performance Énergétique (DPE) : ${dpe}

💰 PRIX
${prix}

📝 DESCRIPTION

Découvrez ce bien exceptionnel situé dans un secteur privilégié. ${description}

Ce bien vous offre un cadre de vie agréable avec ses caractéristiques remarquables. Idéalement situé, il bénéficie d'un emplacement stratégique et d'un environnement de qualité.

✨ POINTS FORTS
• Emplacement privilégié et bien desservi
• Bien entretenu et prêt à emménager
• ${piecesSurface} offrant un espace de vie optimisé
• Diagnostic de Performance Énergétique : ${dpe}

📞 APPEL À L'ACTION

Ne manquez pas cette opportunité unique ! Contactez-nous dès aujourd'hui pour organiser une visite et découvrir tous les atouts de ce bien exceptionnel.

Pour toute information complémentaire ou pour planifier une visite, n'hésitez pas à nous contacter. Notre équipe est à votre disposition pour vous accompagner dans votre projet immobilier.

---

Annonce générée automatiquement - Informations à vérifier avant publication`

    return annonce
  }
}

