/**
 * POST /api/stripe/checkout
 * Crée une session Stripe Checkout pour l'abonnement
 * Body: { plan, userId, userEmail, agencyName, successUrl, cancelUrl }
 */

import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const PLANS = {
  starter: {
    name: 'LeadQualif Starter',
    description: 'CRM IA pour agences — 500 leads/mois',
    amount: 4900,
    interval: 'month',
  },
  growth: {
    name: 'LeadQualif Growth',
    description: 'CRM IA illimité — leads, documents, analytics',
    amount: 14900,
    interval: 'month',
  },
  enterprise: {
    name: 'LeadQualif Enterprise',
    description: 'Solution sur-mesure pour grandes agences',
    amount: 39900,
    interval: 'month',
  },
};

function setCors(res, origin) {
  const allowed = ['https://nexapro.tech', 'https://www.leadqualif.com', 'https://leadqualif.com'];
  const allowOrigin = allowed.includes(origin) ? origin : 'https://www.leadqualif.com';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin || '');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!stripe) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquant dans les variables Vercel.' });
  }

  try {
    const { plan, userId, userEmail, agencyName, successUrl, cancelUrl } = req.body || {};

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Plan invalide. Choisissez: starter, growth ou enterprise' });
    }

    const planData = PLANS[plan];

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: planData.name, description: planData.description },
          unit_amount: planData.amount,
          recurring: { interval: planData.interval },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: userId || '', plan, agencyName: agencyName || '' },
      },
      success_url: successUrl || `https://www.leadqualif.com/dashboard?subscription=success&plan=${plan}`,
      cancel_url: cancelUrl || `https://nexapro.tech/leadqualif.html?canceled=true`,
      metadata: { userId: userId || '', plan },
      locale: 'fr',
      allow_promotion_codes: true,
    };

    // Avec email : on relie à un customer Stripe existant ou on en crée un
    if (userEmail) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        sessionParams.customer = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          name: agencyName || userEmail,
          metadata: { userId: userId || '' },
        });
        sessionParams.customer = customer.id;
      }
    }
    // Sans email : Stripe collecte l'email et crée le customer automatiquement

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ sessionId: session.id, url: session.url });

  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
