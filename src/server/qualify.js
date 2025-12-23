import OpenAI from "openai"

/**
 * Qualification d'un lead via OpenAI
 * NE RETOURNE JAMAIS de fallback silencieux
 * Lance une erreur si OpenAI n'est pas configuré ou en cas d'échec
 */
export async function qualifyLeadServer(lead) {
  // Log des données reçues
  console.log('[QUALIFY] Début de qualification pour:', {
    nom: lead.nom,
    email: lead.email,
    budget: lead.budget,
    typeBien: lead.typeBien
  })

  // Vérifier la présence de la clé API
  // Vite expose les variables d'environnement avec VITE_ côté client
  // Côté serveur (middleware), on peut utiliser process.env directement
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY

  console.log('[QUALIFY] Vérification de la clé API:', {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasViteOpenAIKey: !!process.env.VITE_OPENAI_API_KEY,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 7) + '...' : 'N/A'
  })

  if (!apiKey) {
    const errorMsg = 'OPENAI_API_KEY non configurée. Configurez OPENAI_API_KEY ou VITE_OPENAI_API_KEY dans votre fichier .env'
    console.error('[QUALIFY] ERREUR:', errorMsg)
    throw new Error(errorMsg)
  }

  // Initialiser le client OpenAI
  let client
  try {
    console.log('[QUALIFY] Initialisation du client OpenAI...')
    client = new OpenAI({
      apiKey: apiKey
    })
    console.log('[QUALIFY] Client OpenAI initialisé avec succès')
  } catch (error) {
    console.error('[QUALIFY] ERREUR lors de l\'initialisation du client OpenAI:', error)
    throw new Error(`Erreur d'initialisation OpenAI: ${error.message}`)
  }

  // Préparer le prompt
  const prompt = `
Tu es un expert immobilier.
Analyse ce prospect et retourne STRICTEMENT ce JSON :

{
  "score": number (0-100),
  "niveau": "chaud" | "tiède" | "froid",
  "raison": "courte analyse",
  "action": "action recommandée"
}

Données :
${JSON.stringify(lead, null, 2)}
`

  try {
    console.log('[QUALIFY] Appel à l\'API OpenAI...')
    console.log('[QUALIFY] Données envoyées:', JSON.stringify(lead, null, 2))

  const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })

    console.log('[QUALIFY] Réponse OpenAI reçue:', {
      hasContent: !!response?.choices?.[0]?.message?.content,
      contentLength: response?.choices?.[0]?.message?.content?.length || 0
    })

    // Vérifier que la réponse contient du contenu
    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Réponse OpenAI vide - aucune réponse générée')
    }

    const rawContent = response.choices[0].message.content
    console.log('[QUALIFY] Contenu brut de la réponse:', rawContent.substring(0, 200) + '...')

    // Parser le JSON de manière sécurisée
    let qualification
    try {
      qualification = JSON.parse(rawContent)
      console.log('[QUALIFY] JSON parsé avec succès:', qualification)
    } catch (parseError) {
      console.error('[QUALIFY] ERREUR lors du parsing JSON:', parseError)
      console.error('[QUALIFY] Contenu qui a échoué:', rawContent)
      throw new Error(`Réponse OpenAI invalide (JSON non valide): ${parseError.message}`)
    }

    // Valider les champs requis
    if (typeof qualification.score !== 'number' && typeof qualification.score !== 'string') {
      throw new Error('Le champ "score" est manquant ou invalide dans la réponse OpenAI')
    }

    if (!qualification.niveau) {
      throw new Error('Le champ "niveau" est manquant dans la réponse OpenAI')
    }

    // Normaliser la réponse
    const normalizedScore = Math.max(0, Math.min(100, parseInt(qualification.score) || 0))
    const normalizedNiveau = ['chaud', 'tiède', 'froid'].includes(qualification.niveau?.toLowerCase()) 
      ? qualification.niveau.toLowerCase() 
      : null

    if (!normalizedNiveau) {
      throw new Error(`Niveau invalide: ${qualification.niveau}. Attendu: chaud, tiède ou froid`)
    }

    const result = {
      score: normalizedScore,
      niveau: normalizedNiveau,
      raison: qualification.raison || 'Analyse effectuée',
      action: qualification.action || 'Contacter le prospect'
    }

    console.log('[QUALIFY] Qualification réussie:', result)
    return result

  } catch (error) {
    console.error('[QUALIFY] ERREUR lors de l\'appel OpenAI:', error)
    console.error('[QUALIFY] Stack trace:', error.stack)
    
    // NE PAS retourner de fallback - laisser l'erreur remonter
    throw new Error(`Erreur de qualification IA: ${error.message || 'Erreur inconnue'}`)
  }
}
