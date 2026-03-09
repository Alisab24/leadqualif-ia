import OpenAI from 'openai'
import { processLead } from './leadProcessor'

const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || ''

// Créer le client OpenAI seulement si la clé est disponible
// Cela permet à l'app de démarrer même sans clé API
const openai = openaiApiKey 
  ? new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true // Note: En production, utilisez un backend pour sécuriser la clé API
    })
  : null

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
    // Si OpenAI n'est pas configuré, utiliser uniquement le processeur automatique
    if (!openai) {
      console.warn('OpenAI non configuré. Utilisation du processeur automatique uniquement.')
      const fallbackEvaluation = processLead(leadData, null)
      
      return {
        score_qualification: fallbackEvaluation.score_qualification,
        niveau_interet: fallbackEvaluation.niveau_interet,
        budget_estime: 'Non spécifié',
        urgence: 'moyenne',
        type_bien_recherche: 'autre',
        localisation_souhaitee: null,
        points_forts: [],
        points_attention: ['Qualification automatique (IA non disponible)'],
        recommandations: [fallbackEvaluation.recommandations.action_immediate],
        resume: fallbackEvaluation.raison_classification,
        evaluation_complete: fallbackEvaluation,
        niveau_interet_final: fallbackEvaluation.niveau_interet,
        qualification_automatique: true
      }
    }

    const prompt = `Tu es un expert en qualification de leads immobiliers. Analyse les informations suivantes et fournis une qualification détaillée au format JSON avec les champs suivants:
- score_qualification (nombre entre 0 et 100)
- niveau_interet (CHAUD, TIÈDE, ou FROID selon ces critères:
  * CHAUD: intentions d'achat explicites, demande urgente, budget clair, réponses complètes
  * TIÈDE: intérêt mais hésitation, questions, pas de budget défini
  * FROID: peu d'informations, pas d'intérêt direct, spam)
- budget_estime (montant estimé ou "Non spécifié")
- urgence (faible, moyenne, élevée)
- type_bien_recherche (appartement, maison, terrain, commercial, autre)
- localisation_souhaitee (si mentionnée)
- points_forts (tableau de 3-5 points positifs)
- points_attention (tableau de 2-3 points à surveiller)
- recommandations (tableau de 2-3 recommandations pour l'agent)
- resume (résumé en 2-3 phrases)
- intention_achat_explicite (true/false)
- budget_clair (true/false)
- demande_urgente (true/false)

Informations du lead:
- Nom: ${leadData.nom || 'Non spécifié'}
- Email: ${leadData.email || 'Non spécifié'}
- Téléphone: ${leadData.telephone || 'Non spécifié'}
- Budget: ${leadData.budget ? leadData.budget + ' €' : 'Non spécifié'}
- Type de bien: ${leadData.type_de_bien || 'Non spécifié'}
- Délai d'achat: ${leadData.delai_achat || 'Non spécifié'}
- Message: ${leadData.message || 'Aucun message'}
- Source: ${leadData.source || 'Non spécifié'}

Réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire.`

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant expert en qualification de leads immobiliers. Tu réponds toujours en JSON valide. Tu dois classifier chaque lead en CHAUD, TIÈDE ou FROID selon les critères fournis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })

      const qualification = JSON.parse(completion.choices[0].message.content)
      
      // Intégration avec le leadProcessor pour une évaluation complète
      // Le processeur combine l'analyse IA avec l'analyse algorithmique
      const completeEvaluation = processLead(leadData, qualification)
      
      // Retourner la qualification enrichie avec l'évaluation complète
      return {
        ...qualification,
        evaluation_complete: completeEvaluation,
        niveau_interet_final: completeEvaluation.niveau_interet
      }
    } catch (error) {
      console.error('Erreur lors de la qualification IA:', error)
      
      // En cas d'erreur IA, utiliser uniquement le processeur automatique
      console.warn('Utilisation du processeur automatique uniquement (sans IA)')
      const fallbackEvaluation = processLead(leadData, null)
      
      return {
        score_qualification: fallbackEvaluation.score_qualification,
        niveau_interet: fallbackEvaluation.niveau_interet,
        budget_estime: 'Non spécifié',
        urgence: 'moyenne',
        type_bien_recherche: 'autre',
        localisation_souhaitee: null,
        points_forts: [],
        points_attention: ['Qualification automatique (IA non disponible)'],
        recommandations: [fallbackEvaluation.recommandations.action_immediate],
        resume: fallbackEvaluation.raison_classification,
        evaluation_complete: fallbackEvaluation,
        niveau_interet_final: fallbackEvaluation.niveau_interet,
        qualification_automatique: true
      }
    }
  },

  async generateLeadSummary(leadData) {
    if (!openai) {
      console.warn('OpenAI non configuré. Résumé non disponible.')
      return null
    }

    const prompt = `Génère un résumé professionnel et concis (3-4 phrases maximum) pour ce lead immobilier:

Nom: ${leadData.nom}
Email: ${leadData.email}
Téléphone: ${leadData.telephone}
Message: ${leadData.message || 'Aucun message'}
Score de qualification: ${leadData.score_qualification || 'N/A'}
Budget estimé: ${leadData.budget_estime || 'Non spécifié'}
Urgence: ${leadData.urgence || 'Non spécifiée'}

Le résumé doit être professionnel, informatif et aider l'agent à comprendre rapidement le profil du lead.`

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant qui génère des résumés professionnels pour des leads immobiliers."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 200
      })

      return completion.choices[0].message.content.trim()
    } catch (error) {
      console.error('Erreur lors de la génération du résumé:', error)
      return null
    }
  },

  /**
   * Génère une annonce immobilière optimisée via l'IA
   * @param {Object} bienData - Les données du bien (adresse, pièces, surface, description, DPE, prix)
   * @returns {Promise<string>} - Annonce immobilière optimisée
   */
  async generateAnnonce(bienData) {
    // Si OpenAI n'est pas configuré, utiliser la fonction de simulation
    if (!openai) {
      console.warn('OpenAI non configuré. Utilisation de la génération simulée.')
      return this.generateAnnonceSimulee(bienData)
    }

    const prompt = `Tu es un expert en rédaction d'annonces immobilières. Génère une annonce immobilière professionnelle, attractive et optimisée pour la vente à partir des informations suivantes :

Adresse complète : ${bienData.adresse || 'Non spécifiée'}
Nombre de pièces et surface : ${bienData.pieces_surface || 'Non spécifié'}
Description brute (notes de l'agent) : ${bienData.description || 'Aucune note'}
Diagnostic de Performance Énergétique (DPE) : ${bienData.dpe || 'Non spécifié'}
Prix de vente : ${bienData.prix || 'Non spécifié'}

L'annonce doit :
- Être professionnelle et engageante
- Mettre en valeur les atouts du bien
- Être structurée avec un titre accrocheur, une description détaillée et des points clés
- Respecter les normes de communication immobilière
- Inclure les informations essentielles (surface, nombre de pièces, DPE, prix)
- Être optimisée pour attirer les acheteurs potentiels

Génère une annonce complète et prête à être publiée.`

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un expert en rédaction d'annonces immobilières. Tu génères des annonces professionnelles, attractives et optimisées pour la vente."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })

      return completion.choices[0].message.content.trim()
    } catch (error) {
      console.error('Erreur lors de la génération de l\'annonce:', error)
      // En cas d'erreur, utiliser la génération simulée comme fallback
      console.warn('Utilisation de la génération simulée en fallback.')
      return this.generateAnnonceSimulee(bienData)
    }
  },

  /**
   * Génère les clauses d'un mandat/compromis via IA à partir des données lead + agence
   * @param {Object} lead    - Données du lead (nom, email, budget, type_de_bien, etc.)
   * @param {Object} agency  - Données de l'agence (nom, adresse, carte_pro_t, etc.)
   * @returns {Promise<Object>} - Clauses structurées pour le mandat
   */
  async generateMandatClauses(lead = {}, agency = {}) {
    if (!openai) {
      console.warn('OpenAI non configuré. Utilisation des clauses par défaut.')
      return this._mandatFallback(lead, agency)
    }

    const budgetFormate = lead.budget
      ? `${Number(lead.budget).toLocaleString('fr-FR')} €`
      : 'À définir'

    const prompt = `Tu es un juriste expert en droit immobilier français (loi Hoguet, loi ALUR).
Génère les clauses professionnelles pour un mandat de vente immobilier au format JSON avec les champs suivants :

- objet_mandat       : description précise du bien et de la mission (2-3 phrases)
- prix_suggere       : fourchette de prix recommandée basée sur le budget indiqué
- commission         : taux de commission recommandé (entre 4% et 7%) avec justification courte
- duree              : durée conseillée du mandat (ex: "3 mois renouvelables")
- exclusivite        : true ou false selon le profil du bien
- clause_exclusivite : texte juridique de la clause d'exclusivité (ou clause simple si non-exclusif)
- obligations_mandataire : tableau de 5 obligations principales de l'agent
- obligations_mandant    : tableau de 4 obligations principales du client
- clause_resiliation : conditions et délai de résiliation (loi ALUR)
- mentions_alur      : mentions légales obligatoires (carte pro, assurance RCP, garant)
- recommandation_agent : conseil personnalisé pour l'agent basé sur le profil du lead (2-3 phrases)

Données du bien / client :
- Client : ${lead.nom || 'Non spécifié'}
- Budget / prix souhaité : ${budgetFormate}
- Type de bien : ${lead.type_de_bien || lead.type_bien || 'Non spécifié'}
- Localisation : ${lead.localisation_souhaitee || lead.adresse || 'Non spécifiée'}
- Délai souhaité : ${lead.delai_achat || lead.delai || 'Non spécifié'}
- Message : ${lead.message || 'Aucun'}

Agence mandataire :
- Nom : ${agency.nom || agency.nom_agence || 'Non spécifié'}
- Carte Pro Transaction : ${agency.carte_pro_t || 'Non spécifiée'}
- Carte Pro Syndic : ${agency.carte_pro_s || 'Non spécifiée'}

Réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire. Adapte le langage juridique au contexte français.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es un juriste expert en droit immobilier français. Tu génères des clauses contractuelles professionnelles et conformes à la loi ALUR et à la loi Hoguet. Tu réponds toujours en JSON valide.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })

      const clauses = JSON.parse(completion.choices[0].message.content)
      return { ...clauses, ia_generated: true }
    } catch (error) {
      console.error('Erreur generateMandatClauses:', error)
      return this._mandatFallback(lead, agency)
    }
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

