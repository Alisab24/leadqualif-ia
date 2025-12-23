import OpenAI from "openai"

/**
 * Service de qualification de leads immobiliers via OpenAI
 * Retourne un JSON strict avec score, niveau, raison et action
 */
export async function qualifyLeadAI(lead) {
  // Vérifier que la clé API est configurée
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY n\'est pas configurée dans les variables d\'environnement')
  }

  // Initialiser le client OpenAI
  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Note: En production, utilisez un backend
  })

  // Construire le prompt pour l'IA
  const prompt = `Tu es un expert en qualification de leads immobiliers pour des agences françaises.

Analyse ce prospect et qualifie-le selon ces critères :

CRITÈRES DE QUALIFICATION :
- CHAUD : Budget clair et élevé, délai court (< 3 mois), message détaillé, intention d'achat explicite
- TIÈDE : Budget partiel ou moyen, délai moyen (3-6 mois), message modéré, intérêt mais hésitation
- FROID : Pas de budget, délai long ou indéfini, message vague ou absent, peu d'informations

DONNÉES DU PROSPECT :
- Nom : ${lead.nom || 'Non renseigné'}
- Email : ${lead.email || 'Non renseigné'}
- Budget : ${lead.budget ? lead.budget + ' €' : 'Non renseigné'}
- Type de bien : ${lead.typeBien || 'Non renseigné'}
- Délai d'achat : ${lead.delai || 'Non renseigné'}
- Message : ${lead.message || 'Aucun message'}

IMPORTANT : Retourne UNIQUEMENT un JSON valide avec exactement ce format :
{
  "score": 85,
  "niveau": "chaud",
  "raison": "Budget élevé et délai court, intention d'achat claire",
  "action": "Contacter immédiatement pour proposer un rendez-vous"
}

Le score doit être entre 0 et 100.
Le niveau doit être exactement "chaud", "tiède" ou "froid" (en minuscules).
La raison doit être une explication courte (1-2 phrases).
L'action doit être une recommandation concrète pour l'agent immobilier.`

  try {
    // Appel à l'API OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Modèle plus récent et économique
      messages: [
        {
          role: "system",
          content: "Tu es un expert en qualification de leads immobiliers. Tu réponds UNIQUEMENT en JSON valide, sans texte supplémentaire."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3, // Plus déterministe pour des résultats cohérents
      response_format: { type: "json_object" } // Force le format JSON
    })

    // Parser la réponse JSON
    const content = response.choices[0].message.content
    const result = JSON.parse(content)

    // Valider le format de la réponse
    if (!result.score || !result.niveau || !result.raison || !result.action) {
      throw new Error('Format de réponse invalide de l\'IA')
    }

    // Normaliser le niveau (en minuscules)
    result.niveau = result.niveau.toLowerCase()

    // S'assurer que le score est entre 0 et 100
    result.score = Math.max(0, Math.min(100, Math.round(result.score)))

    return {
      score: result.score,
      niveau: result.niveau,
      raison: result.raison,
      action: result.action
    }
  } catch (error) {
    console.error('Erreur lors de la qualification OpenAI:', error)
    
    // Si c'est une erreur de parsing, relancer
    if (error.message.includes('JSON') || error.message.includes('parse')) {
      throw new Error('Erreur : L\'IA n\'a pas retourné un JSON valide. Vérifiez votre clé API.')
    }
    
    // Sinon, relancer l'erreur originale
    throw error
  }
}
