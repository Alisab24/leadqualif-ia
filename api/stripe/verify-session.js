/**
 * POST /api/stripe/verify-session
 *
 * Fallback appelé côté client après retour depuis Stripe Checkout.
 * Récupère la session Stripe, lit l'abonnement, et met à jour Supabase.
 * Permet d'activer l'accès même si le webhook n'est pas encore configuré.
 *
 * Body: { sessionId }
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

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

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquant' });
  }

  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });

  try {
    // 1. Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({ error: 'Session non complétée', status: session.status });
    }

    const userId = session.metadata?.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId absent des métadonnées de session' });
    }

    const sub = session.subscription;
    const plan = (session.metadata?.plan || 'growth').replace('_annual', '');
    const cycle = session.metadata?.billingCycle || 'monthly';
    const actualStatus = (sub && typeof sub === 'object') ? sub.status : 'active';
    const periodEnd = (sub && typeof sub === 'object')
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    // 2. Mettre à jour le profil Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_customer_id:              session.customer,
        stripe_subscription_id:          typeof sub === 'string' ? sub : sub?.id,
        subscription_status:             actualStatus,
        subscription_plan:               plan,
        subscription_billing_cycle:      cycle,
        subscription_current_period_end: periodEnd,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[verify-session] Supabase update error:', updateError.message);
      return res.status(500).json({ error: updateError.message });
    }

    console.log(`[verify-session] ✅ Profil mis à jour — userId=${userId}, plan=${plan}, status=${actualStatus}`);

    return res.status(200).json({
      ok: true,
      plan,
      status: actualStatus,
      periodEnd,
    });

  } catch (err) {
    console.error('[verify-session] Exception:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
