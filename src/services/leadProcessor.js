/**
 * Lead Processor - Système de traitement et qualification automatique des leads
 * 
 * Ce module analyse automatiquement chaque nouveau lead qui arrive via le formulaire
 * et détermine son niveau d'intérêt selon les critères définis :
 * - Lead CHAUD : intentions d'achat explicites, demande urgente, budget clair, réponses complètes
 * - Lead TIÈDE : intérêt mais hésitation, questions, pas de budget défini
 * - Lead FROID : peu d'informations, pas d'intérêt direct, spam
 * 
 * @module leadProcessor
 */

/**
 * Analyse les mots-clés dans le message pour détecter l'intention d'achat
 * @param {string} message - Le message du lead
 * @returns {Object} - Objet contenant les indicateurs d'intention
 */
function analyzePurchaseIntent(message) {
  if (!message || typeof message !== 'string') {
    return { hasIntent: false, keywords: [], urgency: false }
  }

  const messageLower = message.toLowerCase()
  
  // Mots-clés indiquant une intention d'achat forte (CHAUD)
  const hotKeywords = [
    'acheter', 'achat', 'acquisition', 'investir', 'investissement',
    'urgent', 'rapide', 'immédiat', 'dès que possible', 'le plus tôt',
    'budget de', 'budget', 'prix', 'coût', 'montant',
    'visite', 'visiter', 'voir', 'disponible', 'libre',
    'signer', 'contrat', 'réservation', 'option'
  ]

  // Mots-clés indiquant de l'hésitation (TIÈDE)
  const warmKeywords = [
    'hésite', 'hésitation', 'réfléchir', 'réflexion', 'considérer',
    'peut-être', 'possible', 'envisager', 'souhaiterais', 'aimerais',
    'question', 'questions', 'renseignement', 'renseignements',
    'information', 'informations', 'curieux', 'curiosité'
  ]

  // Mots-clés indiquant peu d'intérêt ou spam (FROID)
  const coldKeywords = [
    'spam', 'publicité', 'marketing', 'promotion',
    'gratuit', 'cadeau', 'gagner', 'loterie'
  ]

  const foundHotKeywords = hotKeywords.filter(keyword => messageLower.includes(keyword))
  const foundWarmKeywords = warmKeywords.filter(keyword => messageLower.includes(keyword))
  const foundColdKeywords = coldKeywords.filter(keyword => messageLower.includes(keyword))

  // Détection d'urgence dans le message
  const urgencyIndicators = ['urgent', 'rapide', 'immédiat', 'dès que possible', 'le plus tôt', 'asap']
  const hasUrgency = urgencyIndicators.some(indicator => messageLower.includes(indicator))

  return {
    hasIntent: foundHotKeywords.length > 0,
    hotKeywords: foundHotKeywords,
    warmKeywords: foundWarmKeywords,
    coldKeywords: foundColdKeywords,
    urgency: hasUrgency,
    messageLength: message.length
  }
}

/**
 * Analyse la complétude des informations fournies par le lead
 * @param {Object} leadData - Les données du lead
 * @returns {Object} - Score de complétude et détails
 */
function analyzeCompleteness(leadData) {
  let completenessScore = 0
  const maxScore = 100
  const details = {
    missingFields: [],
    completeFields: []
  }

  // Vérification des champs obligatoires (40 points)
  if (leadData.nom && leadData.nom.trim().length > 2) {
    completenessScore += 10
    details.completeFields.push('nom')
  } else {
    details.missingFields.push('nom')
  }

  if (leadData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email)) {
    completenessScore += 10
    details.completeFields.push('email')
  } else {
    details.missingFields.push('email')
  }

  if (leadData.telephone && leadData.telephone.trim().length >= 8) {
    completenessScore += 10
    details.completeFields.push('telephone')
  } else {
    details.missingFields.push('telephone')
  }

  if (leadData.message && leadData.message.trim().length > 10) {
    completenessScore += 10
    details.completeFields.push('message')
  } else {
    details.missingFields.push('message')
  }

  // Vérification de la qualité du message (30 points)
  if (leadData.message) {
    const messageLength = leadData.message.trim().length
    if (messageLength > 100) {
      completenessScore += 15
    } else if (messageLength > 50) {
      completenessScore += 10
    } else if (messageLength > 20) {
      completenessScore += 5
    }
  }

  // Vérification de la présence d'informations spécifiques (30 points)
  const message = (leadData.message || '').toLowerCase()
  
  // Budget mentionné (10 points) - Utiliser le champ budget si disponible, sinon chercher dans le message
  if (leadData.budget && leadData.budget.trim() !== '' && !isNaN(parseFloat(leadData.budget))) {
    completenessScore += 10
    details.completeFields.push('budget')
  } else if (/\d+/.test(message) && (message.includes('€') || message.includes('euro') || message.includes('budget') || message.includes('prix'))) {
    completenessScore += 5 // Moins de points si trouvé dans le message
    details.completeFields.push('budget_mentionne')
  }

  // Localisation mentionnée (10 points)
  if (message.includes('paris') || message.includes('lyon') || message.includes('marseille') || 
      message.includes('ville') || message.includes('quartier') || message.includes('secteur')) {
    completenessScore += 10
    details.completeFields.push('localisation_mentionnee')
  }

  // Type de bien mentionné (10 points) - Utiliser le champ type_de_bien si disponible
  if (leadData.type_de_bien && leadData.type_de_bien.trim() !== '') {
    completenessScore += 10
    details.completeFields.push('type_de_bien')
  } else if (message.includes('appartement') || message.includes('maison') || message.includes('terrain') || 
      message.includes('studio') || message.includes('villa') || message.includes('bien')) {
    completenessScore += 5 // Moins de points si trouvé dans le message
    details.completeFields.push('type_bien_mentionne')
  }

  // Bonus pour délai d'achat spécifié (5 points supplémentaires)
  if (leadData.delai_achat && leadData.delai_achat.trim() !== '') {
    completenessScore += 5
    details.completeFields.push('delai_achat')
  }

  return {
    score: Math.min(completenessScore, maxScore),
    percentage: Math.round((completenessScore / maxScore) * 100),
    details
  }
}

/**
 * Détecte si le lead pourrait être du spam
 * @param {Object} leadData - Les données du lead
 * @returns {Object} - Probabilité de spam et raisons
 */
function detectSpam(leadData) {
  const spamIndicators = []
  let spamScore = 0

  // Vérification de l'email suspect
  if (leadData.email) {
    const suspiciousEmailPatterns = [
      /^test/i,
      /^spam/i,
      /^admin/i,
      /@test\./i,
      /@example\./i,
      /@fake\./i
    ]
    
    if (suspiciousEmailPatterns.some(pattern => pattern.test(leadData.email))) {
      spamScore += 30
      spamIndicators.push('Email suspect')
    }
  }

  // Vérification du message trop court ou suspect
  if (leadData.message) {
    const message = leadData.message.toLowerCase()
    
    if (leadData.message.trim().length < 5) {
      spamScore += 20
      spamIndicators.push('Message trop court')
    }

    if (message.includes('spam') || message.includes('test') || message.includes('publicité')) {
      spamScore += 40
      spamIndicators.push('Mots-clés de spam détectés')
    }
  }

  // Vérification de la cohérence des données
  if (!leadData.nom || leadData.nom.trim().length < 2) {
    spamScore += 10
    spamIndicators.push('Nom invalide ou manquant')
  }

  return {
    isSpam: spamScore >= 50,
    score: spamScore,
    indicators: spamIndicators,
    probability: Math.min(spamScore, 100)
  }
}

/**
 * Détermine le niveau d'intérêt du lead (CHAUD, TIÈDE, FROID)
 * @param {Object} leadData - Les données du lead
 * @param {Object} aiQualification - La qualification fournie par l'IA (optionnel)
 * @returns {Object} - Classification complète du lead
 */
export function classifyLeadInterest(leadData, aiQualification = null) {
  // Analyse de l'intention d'achat
  const intentAnalysis = analyzePurchaseIntent(leadData.message || '')
  
  // Analyse de la complétude
  const completenessAnalysis = analyzeCompleteness(leadData)
  
  // Détection de spam
  const spamAnalysis = detectSpam(leadData)
  
  // Si spam détecté, classification automatique en FROID
  if (spamAnalysis.isSpam) {
    return {
      niveau_interet: 'FROID',
      score_qualification: 0,
      raison: 'Spam détecté',
      details: {
        spam: spamAnalysis,
        intent: intentAnalysis,
        completeness: completenessAnalysis
      },
      recommandation: 'Ignorer ce lead ou marquer comme spam'
    }
  }

  // Utilisation du score IA si disponible, sinon calcul manuel
  const aiScore = aiQualification?.score_qualification || null
  const manualScore = calculateManualScore(intentAnalysis, completenessAnalysis, leadData)
  const finalScore = aiScore !== null ? Math.round((aiScore + manualScore) / 2) : manualScore

  // Classification basée sur le score et les indicateurs
  let niveauInteret = 'TIÈDE'
  let raison = 'Intérêt modéré détecté'

  // Critères pour LEAD CHAUD
  // Prendre en compte les nouveaux champs : budget, type_de_bien, delai_achat
  const hasBudget = leadData.budget && leadData.budget.trim() !== '' && !isNaN(parseFloat(leadData.budget))
  const hasTypeBien = leadData.type_de_bien && leadData.type_de_bien.trim() !== ''
  const hasDelaiUrgent = leadData.delai_achat === 'immediat' || leadData.delai_achat === 'court'
  
  if (
    finalScore >= 75 &&
    intentAnalysis.hasIntent &&
    intentAnalysis.hotKeywords.length >= 2 &&
    completenessAnalysis.percentage >= 70 &&
    (intentAnalysis.urgency || aiQualification?.urgence === 'élevée' || hasDelaiUrgent) &&
    (hasBudget || hasTypeBien) // Au moins budget ou type de bien spécifié
  ) {
    niveauInteret = 'CHAUD'
    raison = 'Intention d\'achat forte avec informations complètes et urgence détectée'
    if (hasBudget && hasTypeBien && hasDelaiUrgent) {
      raison = 'Lead très qualifié : budget défini, type de bien spécifié et délai urgent'
    }
  }
  // Critères pour LEAD FROID
  else if (
    finalScore < 40 ||
    completenessAnalysis.percentage < 30 ||
    (intentAnalysis.coldKeywords.length > 0 && !intentAnalysis.hasIntent) ||
    (!intentAnalysis.hasIntent && intentAnalysis.messageLength < 20)
  ) {
    niveauInteret = 'FROID'
    raison = 'Peu d\'informations ou pas d\'intérêt direct détecté'
  }
  // Sinon LEAD TIÈDE
  else {
    niveauInteret = 'TIÈDE'
    raison = 'Intérêt présent mais informations incomplètes ou hésitation détectée'
  }

  return {
    niveau_interet: niveauInteret,
    score_qualification: finalScore,
    raison: raison,
    details: {
      intent: intentAnalysis,
      completeness: completenessAnalysis,
      spam: spamAnalysis,
      ai_qualification: aiQualification
    },
    recommandation: getRecommendation(niveauInteret, finalScore, intentAnalysis, completenessAnalysis)
  }
}

/**
 * Calcule un score manuel basé sur les analyses
 * @param {Object} intentAnalysis - Analyse de l'intention
 * @param {Object} completenessAnalysis - Analyse de la complétude
 * @param {Object} leadData - Données du lead
 * @returns {number} - Score entre 0 et 100
 */
function calculateManualScore(intentAnalysis, completenessAnalysis, leadData) {
  let score = 0

  // Score de base : complétude (40%)
  score += (completenessAnalysis.percentage * 0.4)

  // Score d'intention (40%)
  if (intentAnalysis.hasIntent) {
    score += 30
    score += Math.min(intentAnalysis.hotKeywords.length * 5, 10)
  } else if (intentAnalysis.warmKeywords.length > 0) {
    score += 15
  }

  if (intentAnalysis.urgency) {
    score += 10
  }

  // Bonus pour les nouveaux champs spécifiques (20%)
  // Budget spécifié = indicateur fort d'intention
  if (leadData.budget && leadData.budget.trim() !== '' && !isNaN(parseFloat(leadData.budget))) {
    score += 10
  }

  // Type de bien spécifié = intérêt concret
  if (leadData.type_de_bien && leadData.type_de_bien.trim() !== '') {
    score += 5
  }

  // Délai d'achat = indicateur d'urgence et d'intention
  if (leadData.delai_achat && leadData.delai_achat.trim() !== '') {
    if (leadData.delai_achat === 'immediat' || leadData.delai_achat === 'court') {
      score += 10 // Urgence élevée
    } else if (leadData.delai_achat === 'moyen') {
      score += 5 // Urgence modérée
    } else {
      score += 2 // Intérêt mais pas urgent
    }
  }

  // Pénalité pour mots-clés froids (20%)
  if (intentAnalysis.coldKeywords.length > 0) {
    score -= 20
  }

  // Bonus pour message détaillé
  if (intentAnalysis.messageLength > 100) {
    score += 10
  } else if (intentAnalysis.messageLength < 20) {
    score -= 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Génère une recommandation basée sur la classification
 * @param {string} niveauInteret - Niveau d'intérêt (CHAUD/TIÈDE/FROID)
 * @param {number} score - Score de qualification
 * @param {Object} intentAnalysis - Analyse de l'intention
 * @param {Object} completenessAnalysis - Analyse de la complétude
 * @returns {string} - Recommandation textuelle
 */
function getRecommendation(niveauInteret, score, intentAnalysis, completenessAnalysis) {
  switch (niveauInteret) {
    case 'CHAUD':
      return 'Contacter immédiatement. Lead très prometteur avec intention d\'achat claire et informations complètes.'
    
    case 'TIÈDE':
      return 'Contacter sous 24-48h. Nourrir le lead avec des informations pertinentes et répondre aux questions.'
    
    case 'FROID':
      if (completenessAnalysis.percentage < 30) {
        return 'Relancer pour obtenir plus d\'informations. Si pas de réponse, archiver.'
      }
      return 'Ajouter à la liste de suivi longue durée. Peut devenir intéressant plus tard.'
    
    default:
      return 'Analyser manuellement ce lead.'
  }
}

/**
 * Traite automatiquement un nouveau lead et génère une évaluation complète
 * @param {Object} leadData - Les données brutes du lead
 * @param {Object} aiQualification - La qualification fournie par l'IA (optionnel)
 * @returns {Object} - Évaluation complète du lead au format JSON structuré
 */
export function processLead(leadData, aiQualification = null) {
  // Classification du niveau d'intérêt
  const classification = classifyLeadInterest(leadData, aiQualification)

  // Construction de l'évaluation JSON structurée
  const evaluation = {
    // Classification principale
    niveau_interet: classification.niveau_interet,
    score_qualification: classification.score_qualification,
    raison_classification: classification.raison,
    
    // Métriques détaillées
    metriques: {
      score_global: classification.score_qualification,
      score_completude: classification.details.completeness.score,
      score_intention: classification.details.intent.hasIntent ? 80 : 
                       (classification.details.intent.warmKeywords.length > 0 ? 50 : 20),
      probabilite_spam: classification.details.spam.probability
    },
    
    // Analyse de l'intention
    analyse_intention: {
      intention_achat_detectee: classification.details.intent.hasIntent,
      mots_cles_chauds: classification.details.intent.hotKeywords,
      mots_cles_tiedes: classification.details.intent.warmKeywords,
      mots_cles_froids: classification.details.intent.coldKeywords,
      urgence_detectee: classification.details.intent.urgency,
      longueur_message: classification.details.intent.messageLength
    },
    
    // Analyse de complétude
    analyse_completude: {
      score: classification.details.completeness.score,
      pourcentage: classification.details.completeness.percentage,
      champs_complets: classification.details.completeness.details.completeFields,
      champs_manquants: classification.details.completeness.details.missingFields
    },
    
    // Détection de spam
    detection_spam: {
      est_spam: classification.details.spam.isSpam,
      score: classification.details.spam.score,
      indicateurs: classification.details.spam.indicators
    },
    
    // Qualification IA (si disponible)
    qualification_ia: aiQualification || null,
    
    // Recommandations
    recommandations: {
      action_immediate: classification.recommandation,
      priorite: classification.niveau_interet === 'CHAUD' ? 'HAUTE' : 
                classification.niveau_interet === 'TIÈDE' ? 'MOYENNE' : 'BASSE',
      delai_contact: classification.niveau_interet === 'CHAUD' ? 'Immédiat' :
                     classification.niveau_interet === 'TIÈDE' ? '24-48h' : 'Suivi long terme'
    },
    
    // Timestamp
    date_evaluation: new Date().toISOString(),
    version_processeur: '1.0.0'
  }

  return evaluation
}

/**
 * Export par défaut pour faciliter l'importation
 */
export default {
  processLead,
  classifyLeadInterest,
  analyzePurchaseIntent,
  analyzeCompleteness,
  detectSpam
}

