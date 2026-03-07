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

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, userId, userEmail, agencyName, successUrl, cancelUrl } = req.body;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Plan invalide. Choisissez: starter, growth ou enterprise' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'Email utilisateur requis' });
    }

    const planData = PLANS[plan];

    // Créer ou récupérer le customer Stripe
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        name: agencyName || userEmail,
        metadata: {
          userId: userId || '',
          agencyName: agencyName || '',
        },
      });
    }

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
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
        trial_period_days: 7, // 7 jours d'essai gratuit
      },
      success_url: successUrl || `${req.headers.origin}/dashboard?subscription=success&plan=${plan}`,
      cancel_url: cancelUrl || `${req.headers.origin}/settings?tab=facturation&canceled=true`,
      metadata: {
        userId: userId || '',
        plan,
      },
      locale: 'fr',
      allow_promotion_codes: true,
    });

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
