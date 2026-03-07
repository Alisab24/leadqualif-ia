/**
 * POST /api/stripe/webhook
 * Gère les webhooks Stripe → met à jour Supabase automatiquement
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function updateProfile(userId, updates) {
  if (!userId) return;
  const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId);
  if (error) console.error('Supabase update error:', error);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId) {
          await updateProfile(userId, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: 'active',
            subscription_plan: plan || 'growth',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await updateProfile(userId, {
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            subscription_plan: sub.metadata?.plan || 'growth',
            subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await updateProfile(userId, {
            subscription_status: 'inactive',
            subscription_plan: 'free',
            stripe_subscription_id: null,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const userId = customer.metadata?.userId;
        if (userId) await updateProfile(userId, { subscription_status: 'past_due' });
        break;
      }

      default:
        console.log(`Event non traité: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
