/**
 * POST /api/stripe/webhook
 * Gère les webhooks Stripe → met à jour Supabase automatiquement
 *
 * Events traités:
 * - checkout.session.completed → activation abonnement
 * - customer.subscription.updated → mise à jour plan
 * - customer.subscription.deleted → désactivation
 * - invoice.payment_failed → alerte paiement échoué
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Client Supabase avec la clé service_role (pas la clé anon)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Helper pour mettre à jour le profil Supabase
async function updateProfile(userId, updates) {
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId);
  if (error) console.error('Supabase update error:', error);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig) {
      // Vérification de la signature (production recommandé)
      const rawBody = req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Sans signature (dev/test)
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`[Stripe Webhook] Event: ${event.type}`);

  try {
    switch (event.type) {

      // ✅ Paiement réussi / abonnement activé
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
          console.log(`✅ Abonnement activé: userId=${userId}, plan=${plan}`);
        }
        break;
      }

      // 🔄 Abonnement mis à jour (changement de plan, renouvellement)
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (userId) {
          const plan = subscription.metadata?.plan || 'growth';
          const status = subscription.status; // active, past_due, canceled, trialing
          await updateProfile(userId, {
            stripe_subscription_id: subscription.id,
            subscription_status: status,
            subscription_plan: plan,
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
          console.log(`🔄 Abonnement mis à jour: userId=${userId}, status=${status}`);
        }
        break;
      }

      // ❌ Abonnement annulé
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await updateProfile(userId, {
            subscription_status: 'inactive',
            subscription_plan: 'free',
            stripe_subscription_id: null,
          });
          console.log(`❌ Abonnement annulé: userId=${userId}`);
        }
        break;
      }

      // ⚠️ Paiement échoué
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        // Retrouver l'userId via le customer
        const customers = await stripe.customers.retrieve(invoice.customer);
        const userId = customers.metadata?.userId;

        if (userId) {
          await updateProfile(userId, {
            subscription_status: 'past_due',
          });
          console.log(`⚠️ Paiement échoué: userId=${userId}`);
        }
        break;
      }

      // Période d'essai activée
      case 'customer.subscription.trial_will_end': {
        console.log('ℹ️ Essai gratuit se termine bientôt');
        break;
      }

      default:
        console.log(`ℹ️ Event non traité: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message });
  }
};
