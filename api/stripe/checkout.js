/**
 * POST /api/stripe/checkout
 * Crée une session Stripe Checkout pour l'abonnement
 * Body: { plan, userId, userEmail, agencyName, successUrl, cancelUrl }
 */

import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

// ─── Plans alignés avec la landing page ───────────────────────────────────────
// Solo    → 79€/mois  ou 63€/mois annuel (= 756€/an)
// Agence  → 149€/mois ou 119€/mois annuel (= 1428€/an)
// Expert  → Sur devis (contacter équipe)
// Crédits → 500 leads 29€ / 1 000 leads 49€ (one-time)
// Les IDs "starter" / "growth" / "enterprise" restent identiques pour rétrocompat.
const PLANS = {
  // ── Solo ──────────────────────────────────────────────────────────────────
  starter: {
    name: 'LeadQualif Solo',
    description: '1 utilisateur · 300 leads/mois · Docs & CRM · Inbox unifiée',
    amount: 7900,           // 79 € HT
    interval: 'month',
    trialDays: 14,
  },
  starter_annual: {
    name: 'LeadQualif Solo Annuel',
    description: '1 utilisateur · 300 leads/mois · Docs & CRM — facturé annuellement',
    amount: 75600,          // 63 € × 12 = 756 €
    interval: 'year',
    trialDays: 14,
  },

  // ── Agence (Growth) ───────────────────────────────────────────────────────
  growth: {
    name: 'LeadQualif Agence',
    description: '5 utilisateurs · 1 000 leads/mois · Agent IA · Booking · Stats & Docs complets',
    amount: 14900,          // 149 € HT
    interval: 'month',
    trialDays: 14,
  },
  growth_annual: {
    name: 'LeadQualif Agence Annuel',
    description: '5 utilisateurs · 1 000 leads/mois · Agent IA · Booking — facturé annuellement',
    amount: 142800,         // 119 € × 12 = 1 428 €
    interval: 'year',
    trialDays: 14,
  },

  // ── Expert (Enterprise) — contact only, pas de checkout direct ────────────
  // (bouton "Nous contacter" sur la landing, pas de session Stripe ici)
  enterprise: {
    name: 'LeadQualif Expert',
    description: 'Utilisateurs illimités · White-label · Multi-agences · Onboarding dédié · SLA',
    amount: 0,              // Sur devis — désactivé dans checkout
    interval: 'month',
    trialDays: 14,
    contactOnly: true,
  },

  // ── Crédits leads (paiement unique) ───────────────────────────────────────
  credits_500: {
    name: '500 crédits leads',
    description: '+500 leads à votre quota · Valables 12 mois',
    amount: 2900,           // 29 € HT
    mode: 'payment',        // one-time
    trialDays: 0,
  },
  credits_1000: {
    name: '1 000 crédits leads',
    description: '+1 000 leads à votre quota · Valables 12 mois',
    amount: 4900,           // 49 € HT
    mode: 'payment',        // one-time
    trialDays: 0,
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
      return res.status(400).json({
        error: 'Plan invalide. Valeurs acceptées : starter, starter_annual, growth, growth_annual, credits_500, credits_1000',
      });
    }

    const planData = PLANS[plan];

    // Expert → contact only, pas de session Stripe
    if (planData.contactOnly) {
      return res.status(400).json({ error: 'Le plan Expert est sur devis. Contactez contact@nexapro.tech' });
    }

    // Plan de base pour stocker en DB (ex: "growth_annual" → "growth")
    const basePlan = plan.replace('_annual', '').replace('credits_', '')
    const isOneTime = planData.mode === 'payment'

    const sessionParams = {
      payment_method_types: ['card'],
      mode: isOneTime ? 'payment' : 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: planData.name, description: planData.description },
          unit_amount: planData.amount,
          ...(isOneTime ? {} : { recurring: { interval: planData.interval } }),
        },
        quantity: 1,
      }],
      ...(isOneTime ? {} : {
        subscription_data: {
          trial_period_days: planData.trialDays || 14,
          metadata: { userId: userId || '', plan: basePlan, billingCycle: plan.includes('annual') ? 'annual' : 'monthly', agencyName: agencyName || '' },
        },
      }),
      success_url: successUrl || `https://www.leadqualif.com/dashboard?subscription=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `https://www.leadqualif.com/?canceled=true`,
      metadata: { userId: userId || '', plan: isOneTime ? plan : basePlan, billingCycle: plan.includes('annual') ? 'annual' : 'monthly' },
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
