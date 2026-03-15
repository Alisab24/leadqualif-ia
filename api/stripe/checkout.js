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
// Solo    → 49€/mois  ou 39€/mois annuel (= 468€/an)
// Agence  → 149€/mois ou 119€/mois annuel (= 1428€/an)
// Expert  → 399€/mois ou 319€/mois annuel (= 3828€/an)
// Les IDs "starter" / "growth" / "enterprise" restent identiques pour rétrocompat.
const PLANS = {
  // ── Solo ──────────────────────────────────────────────────────────────────
  starter: {
    name: 'LeadQualif Solo',
    description: '1 utilisateur · 100 leads/mois · Docs & CRM',
    amount: 4900,           // 49 € HT
    annualAmount: 46800,    // 39 € × 12 = 468 €
    interval: 'month',
    trialDays: 7,
  },
  starter_annual: {
    name: 'LeadQualif Solo Annuel',
    description: '1 utilisateur · 100 leads/mois · Docs & CRM — facturé annuellement',
    amount: 46800,          // 468 €/an (= 39 €/mois)
    interval: 'year',
    trialDays: 7,
  },

  // ── Agence (Growth) ───────────────────────────────────────────────────────
  growth: {
    name: 'LeadQualif Agence',
    description: '5 utilisateurs · Leads illimités · IA avancée · Stats & Docs complets',
    amount: 14900,          // 149 € HT
    annualAmount: 142800,   // 119 € × 12 = 1 428 €
    interval: 'month',
    trialDays: 7,
  },
  growth_annual: {
    name: 'LeadQualif Agence Annuel',
    description: '5 utilisateurs · Leads illimités · IA avancée · Stats & Docs complets — facturé annuellement',
    amount: 142800,         // 1 428 €/an (= 119 €/mois)
    interval: 'year',
    trialDays: 7,
  },

  // ── Expert (Enterprise) ───────────────────────────────────────────────────
  enterprise: {
    name: 'LeadQualif Expert',
    description: 'Utilisateurs illimités · Multi-agences · Onboarding dédié · SLA',
    amount: 39900,          // 399 € HT
    annualAmount: 382800,   // 319 € × 12 = 3 828 €
    interval: 'month',
    trialDays: 7,
  },
  enterprise_annual: {
    name: 'LeadQualif Expert Annuel',
    description: 'Utilisateurs illimités · Multi-agences · Onboarding dédié · SLA — facturé annuellement',
    amount: 382800,         // 3 828 €/an (= 319 €/mois)
    interval: 'year',
    trialDays: 7,
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
        error: 'Plan invalide. Valeurs acceptées : starter, starter_annual, growth, growth_annual, enterprise, enterprise_annual',
      });
    }

    const planData = PLANS[plan];
    // Plan de base pour stocker en DB (ex: "growth_annual" → "growth")
    const basePlan = plan.replace('_annual', '');

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
        trial_period_days: planData.trialDays || 7,
        metadata: { userId: userId || '', plan: basePlan, billingCycle: plan.includes('annual') ? 'annual' : 'monthly', agencyName: agencyName || '' },
      },
      success_url: successUrl || `https://www.leadqualif.com/dashboard?subscription=success&plan=${basePlan}`,
      cancel_url: cancelUrl || `https://www.leadqualif.com/?canceled=true`,
      metadata: { userId: userId || '', plan: basePlan, billingCycle: plan.includes('annual') ? 'annual' : 'monthly' },
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
