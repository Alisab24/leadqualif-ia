/**
 * POST /api/stripe/portal
 * Crée une session Stripe Customer Portal (gérer abonnement, factures, annulation)
 *
 * Body: { userEmail, returnUrl }
 */

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

function setCors(res, origin) {
  const allowed = ['https://nexapro.tech', 'https://www.leadqualif.com', 'https://leadqualif.com'];
  const allowOrigin = allowed.includes(origin) ? origin : 'https://www.leadqualif.com';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

module.exports = async function handler(req, res) {
  setCors(res, req.headers.origin || '');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userEmail, returnUrl } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: 'Email utilisateur requis' });
    }

    // Retrouver le customer Stripe par email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(404).json({
        error: 'Aucun compte Stripe trouvé pour cet email. Abonnez-vous d\'abord.',
      });
    }

    const customer = customers.data[0];

    // Créer la session portail
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl || `${req.headers.origin}/settings?tab=facturation`,
    });

    return res.status(200).json({ url: portalSession.url });

  } catch (error) {
    console.error('Stripe portal error:', error);
    return res.status(500).json({
      error: error.message || 'Erreur lors de l\'ouverture du portail de facturation',
    });
  }
};
