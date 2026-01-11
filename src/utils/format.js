// Fonctions utilitaires de formatage

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export const formatCurrency = (amount, currency = 'EUR') => {
  if (!amount || amount === 'Non spécifié') return 'Non spécifié'
  if (typeof amount === 'string') return amount
  
  // 🎯 CORRECTION: Convertir le symbole € en code ISO 4217
  // Intl.NumberFormat n'accepte que les codes ISO, pas les symboles
  const normalizedCurrency = currency === '€' ? 'EUR' : currency;
  
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: normalizedCurrency
    }).format(amount)
  } catch (error) {
    console.warn('⚠️ Erreur formatCurrency avec devise:', currency, error);
    // Fallback en cas d'erreur
    return `${amount.toLocaleString('fr-FR')} ${currency}`;
  }
}

export const formatPhone = (phone) => {
  if (!phone) return 'N/A'
  // Format français: 06 12 34 56 78
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }
  return phone
}

export const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-600 bg-green-100'
  if (score >= 60) return 'text-yellow-600 bg-yellow-100'
  if (score >= 40) return 'text-orange-600 bg-orange-100'
  return 'text-red-600 bg-red-100'
}

export const getUrgencyColor = (urgency) => {
  switch (urgency?.toLowerCase()) {
    case 'élevée':
    case 'elevee':
    case 'high':
      return 'text-red-600 bg-red-100'
    case 'moyenne':
    case 'medium':
      return 'text-yellow-600 bg-yellow-100'
    case 'faible':
    case 'low':
      return 'text-green-600 bg-green-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

/**
 * Retourne les classes CSS pour la classification du niveau d'intérêt (CHAUD/TIÈDE/FROID)
 * @param {string} niveauInteret - Le niveau d'intérêt (CHAUD, TIÈDE, FROID)
 * @returns {string} - Classes CSS Tailwind pour le badge
 */
export const getInterestLevelColor = (niveauInteret) => {
  switch (niveauInteret?.toUpperCase()) {
    case 'CHAUD':
      return 'text-red-700 bg-red-100 border-red-300'
    case 'TIÈDE':
    case 'TIEDE':
      return 'text-yellow-700 bg-yellow-100 border-yellow-300'
    case 'FROID':
      return 'text-blue-700 bg-blue-100 border-blue-300'
    default:
      return 'text-gray-700 bg-gray-100 border-gray-300'
  }
}

/**
 * Retourne l'icône appropriée pour le niveau d'intérêt
 * @param {string} niveauInteret - Le niveau d'intérêt (CHAUD, TIÈDE, FROID)
 * @returns {string} - Nom de l'icône ou emoji
 */
export const getInterestLevelIcon = (niveauInteret) => {
  switch (niveauInteret?.toUpperCase()) {
    case 'CHAUD':
      return '🔥' // Feu pour chaud
    case 'TIÈDE':
    case 'TIEDE':
      return '🌡️' // Thermomètre pour tiède
    case 'FROID':
      return '❄️' // Flocon pour froid
    default:
      return '📊' // Graphique par défaut
  }
}

/**
 * Retourne une description textuelle du niveau d'intérêt
 * @param {string} niveauInteret - Le niveau d'intérêt (CHAUD, TIÈDE, FROID)
 * @returns {string} - Description en français
 */
export const getInterestLevelDescription = (niveauInteret) => {
  switch (niveauInteret?.toUpperCase()) {
    case 'CHAUD':
      return 'Lead très prometteur - Contacter immédiatement'
    case 'TIÈDE':
    case 'TIEDE':
      return 'Intérêt modéré - Contacter sous 24-48h'
    case 'FROID':
      return 'Peu d\'informations - Suivi long terme'
    default:
      return 'À analyser'
  }
}

