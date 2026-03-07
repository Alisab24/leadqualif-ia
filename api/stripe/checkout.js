/**
 * POST /api/stripe/checkout
 * Crée une session Stripe Checkout pour l'abonnement
 *
 * Body: { plan: 'starter' | 'growth', userId, userEmail, agencyName, successUrl, cancelUrl }
 */

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Plans disponibles
const PLANS = {
  starter: {
    name: 'LeadQualif Starter',
    description: 'CRM IA pour agences — jusqu\'à 100 leads/mois',
    amount: 4900, // 49.00 EUR en centimes
    interval: 'month',
  },
  growth: {
    name: 'LeadQualif Growth',
    description: 'CRM IA illimité — leads, documents, analytics',
    amount: 14900, // 149.00 EUR en centimes
    interval: 'month',
  },
  enterprise: {
    name: 'LeadQualif Enterprise',
    description: 'Solution sur-mesure pour grandes agences',
    amount: 39900, // 399.00 EUR — à ajuster selon négociation
    interval: 'month',
  },
};

// Helper: CORS headers pour tous les contextes (app + landing page)
function setCors(res, origin) {
  const allowed = ['https://nexapro.tech', 'https://www.leadqualif.com', 'https://leadqualif.com'];
  const allowOrigin = allowed.includes(origin) ? origin : 'https://nexapro.tech';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';

  // Toujours poser les headers CORS en premier
  setCors(res, origin);

  // Répondre au preflight OPTIONS immédiatement
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, userId, userEmail, agencyName, successUrl, cancelUrl } = req.body || {};

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Plan invalide. Choisissez: starter, growth ou enterprise' });
    }

    const planData = PLANS[plan];

    // Session params de base (sans customer — Stripe collecte l'email)
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: planData.name,
              description: planData.description,
              metadata: { plan },
            },
            unit_amount: planData.amount,
            recurring: {
              interval: planData.interval,
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          userId: userId || '',
          plan,
          agencyName: agencyName || '',
        },
        trial_period_days: 7,
      },
      success_url: successUrl || `https://www.leadqualif.com/dashboard?subscription=success&plan=${plan}`,
      cancel_url: cancelUrl || `https://nexapro.tech/leadqualif.html?canceled=true`,
      metadata: {
        userId: userId || '',
        plan,
      },
      locale: 'fr',
      allow_promotion_codes: true,
    };

    // Si on a l'email (appel depuis l'app), créer/récupérer le customer
    if (userEmail) {
      const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existingCustomers.data.length > 0) {
        sessionParams.customer = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          name: agencyName || userEmail,
          metadata: { userId: userId || '', agencyName: agencyName || '' },
        });
        sessionParams.customer = customer.id;
      }
    } else {
      // Depuis la landing page : Stripe collecte l'email lui-même
      sessionParams.customer_creation = 'always';
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({
      error: error.message || 'Erreur lors de la création de la session de paiement',
    });
  }
};
