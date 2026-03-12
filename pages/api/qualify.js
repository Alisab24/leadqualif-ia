/**
 * Vercel Serverless Function — /api/qualify
 *
 * ✅ SÉCURITÉ : OpenAI est appelé UNIQUEMENT côté serveur.
 *    OPENAI_API_KEY n'est jamais exposé au navigateur.
 *    → Configurer dans Vercel Dashboard > Settings > Environment Variables
 *
 * NE JAMAIS utiliser VITE_OPENAI_API_KEY : ce préfixe intègre la clé
 * dans le bundle JavaScript public (visible dans DevTools).
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Méthode non autorisée. Utilisez POST.' });
  }

  // Vérifier la clé API (côté serveur uniquement)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'REMPLACER_PAR_NOUVELLE_CLE') {
    console.error('[qualify] OPENAI_API_KEY non configurée dans les variables d\'environnement Vercel');
    return res.status(503).json({
      error: true,
      message: 'Service IA non disponible — clé API non configurée',
      qualification_automatique: true,
      score: 30,
      niveau: 'froid',
      raison: 'IA temporairement indisponible',
      action: 'Contacter le prospect manuellement'
    });
  }

  let lead;
  try {
    lead = req.body;
    if (!lead || typeof lead !== 'object') throw new Error('Corps de requête invalide');
  } catch (e) {
    return res.status(400).json({ error: true, message: 'Données invalides' });
  }

  const prompt = `Tu es un expert en qualification de leads.
Analyse ce prospect et retourne STRICTEMENT ce JSON :
{
  "score": number (0-100),
  "niveau": "chaud" | "tiède" | "froid",
  "raison": "courte analyse",
  "action": "action recommandée"
}

Données :
${JSON.stringify(lead, null, 2)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Réponse OpenAI vide');

    const qualification = JSON.parse(content);

    const score = Math.max(0, Math.min(100, parseInt(qualification.score) || 0));
    const niveaux = ['chaud', 'tiède', 'froid'];
    const niveau = niveaux.includes(qualification.niveau?.toLowerCase())
      ? qualification.niveau.toLowerCase()
      : 'froid';

    return res.status(200).json({
      score,
      niveau,
      raison: qualification.raison || 'Analyse effectuée',
      action: qualification.action || 'Contacter le prospect',
      qualification_automatique: false
    });

  } catch (error) {
    console.error('[qualify] Erreur OpenAI:', error.message);
    // Fallback automatique sans clé — ne bloque pas le formulaire
    return res.status(200).json({
      score: 30,
      niveau: 'froid',
      raison: 'Qualification automatique (IA indisponible)',
      action: 'Contacter le prospect manuellement',
      qualification_automatique: true
    });
  }
}
