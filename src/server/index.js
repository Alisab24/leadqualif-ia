import { qualifyLeadServer } from './qualify'

/**
 * Handler pour la route /api/qualify
 * Garantit TOUJOURS une réponse JSON valide, même en cas d'erreur
 */
export async function handleQualify(req) {
  try {
    // Vérifier que la requête est bien une requête POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: true,
          message: 'Méthode non autorisée. Utilisez POST.'
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parser le body de manière sécurisée
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: true,
          message: 'Corps de la requête invalide (JSON attendu)'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Valider les données minimales requises
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({
          error: true,
          message: 'Données invalides'
        }),
        {
          status: 400,
    headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Appeler la fonction de qualification
    // Cette fonction peut maintenant lancer une erreur si OpenAI n'est pas configuré
    console.log('[API] Appel de qualifyLeadServer avec:', {
      nom: body.nom,
      email: body.email,
      budget: body.budget
    })

    let result
    try {
      result = await qualifyLeadServer(body)
      console.log('[API] Qualification réussie:', result)
    } catch (qualifyError) {
      console.error('[API] Erreur lors de la qualification:', qualifyError)
      // Retourner l'erreur de manière explicite au frontend
      return new Response(
        JSON.stringify({
          error: true,
          message: qualifyError.message || 'Erreur lors de la qualification',
          details: qualifyError.stack
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Retourner le résultat avec un statut 200
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    // Catch final pour toute erreur non gérée
    console.error('[API] Erreur critique dans handleQualify:', error)
    console.error('[API] Stack trace:', error.stack)
    
    // Retourner l'erreur de manière explicite (sans fallback silencieux)
    return new Response(
      JSON.stringify({
        error: true,
        message: `Erreur technique: ${error.message || 'Erreur inconnue'}`,
        details: error.stack
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
