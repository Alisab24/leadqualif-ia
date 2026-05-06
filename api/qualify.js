/**
 * Vercel Serverless Function — /api/qualify
 *
 * ✅ SÉCURITÉ : Anthropic est appelé UNIQUEMENT côté serveur.
 *    ANTHROPIC_API_KEY n'est jamais exposé au navigateur.
 *    → Configurer dans Vercel Dashboard > Settings > Environment Variables
 *
 * Utilise Claude Haiku (rapide, économique) pour scorer les leads.
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

  // Vérifier la clé API Anthropic (côté serveur uniquement)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[qualify] ANTHROPIC_API_KEY non configurée dans les variables d\'environnement Vercel');
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
Analyse ce prospect et retourne STRICTEMENT ce JSON (sans texte autour) :
{
  "score": number (0-100),
  "niveau": "chaud" | "tiède" | "froid",
  "raison": "courte analyse",
  "action": "action recommandée"
}

Données :
${JSON.stringify(lead, null, 2)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text;
    if (!content) throw new Error('Réponse Anthropic vide');

    // Extraire le JSON de la réponse (Claude peut parfois ajouter du texte autour)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON introuvable dans la réponse');

    const qualification = JSON.parse(jsonMatch[0]);

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
    console.error('[qualify] Erreur Anthropic:', error.message);
    // Fallback automatique — ne bloque pas le formulaire
    return res.status(200).json({
      score: 30,
      niveau: 'froid',
      raison: 'Qualification automatique (IA indisponible)',
      action: 'Contacter le prospect manuellement',
      qualification_automatique: true
    });
  }
}
