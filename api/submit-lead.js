// API endpoint pour le formulaire - Utilise Supabase comme base de données
import { leadsService } from '../lib/supabase.js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { nom, email, telephone, adresse, prix } = req.body

    // Validation des données
    if (!nom || !email || !telephone || !adresse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Les champs nom, email, téléphone et adresse sont obligatoires' 
      })
    }

    // ── Calcul du score de qualification sur 100 (seuils : 70 = chaud, 40 = tiède) ──
    let score = 20 // Base neutre

    // Email valide (+15)
    if (email.includes('@') && email.includes('.')) score += 15
    // Téléphone complet (+15)
    if (telephone && telephone.replace(/\D/g, '').length >= 8) score += 15
    // Adresse complète (+10)
    if (adresse && adresse.trim().length > 20) score += 10
    // Budget présent (+10) ; budget élevé (+10 supplémentaire)
    if (prix && !isNaN(parseFloat(prix)) && parseFloat(prix) > 0) {
      score += 10
      if (parseFloat(prix) > 100000) score += 10
    }

    score = Math.min(score, 100)

    // Niveau d'intérêt cohérent avec les seuils getScoreBadge (70/40)
    const niveau_interet = score >= 70 ? 'CHAUD' : score >= 40 ? 'TIÈDE' : 'FROID'

    // Urgence
    let urgence = 'moyenne'
    if (prix && parseFloat(prix) > 500000) urgence = 'élevée'
    else if (prix && parseFloat(prix) < 100000) urgence = 'faible'

    // Préparation des données pour Supabase
    const leadData = {
      nom,
      email,
      telephone,
      adresse,
      budget: prix || '',
      score_qualification: score,
      niveau_interet,
      urgence,
      type_bien: 'non précisé',
      message: `Demande pour un bien à ${adresse}${prix ? ` avec un budget de ${prix}€` : ''}`,
      qualification_data: {
        score_calcule: score,
        criteres: {
          'budget_suffisant': prix && prix > 100000,
          'email_valide': email.includes('@') && email.includes('.'),
          'telephone_complet': telephone.length >= 10,
          'adresse_complete': adresse.length > 20
        }
      }
    }

    // Sauvegarde dans Supabase
    const result = await leadsService.saveLead(leadData)

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Lead sauvegardé avec succès',
        data: {
          id: result.data[0].id,
          score: result.data[0].score_qualification,
          message: 'Votre demande a été analysée et sauvegardée'
        }
      })
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde du lead',
        error: result.error
      })
    }

  } catch (error) {
    console.error('Erreur API submit-lead:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    })
  }
}
