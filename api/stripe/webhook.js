/**
 * POST /api/stripe/webhook
 * Gère les webhooks Stripe → met à jour Supabase automatiquement
 *
 * Événements gérés :
 *   checkout.session.completed         → activation abonnement
 *   customer.subscription.updated      → changement plan/statut
 *   customer.subscription.deleted      → résiliation
 *   customer.subscription.trial_will_end → alerte fin essai (J-3)
 *   invoice.payment_succeeded          → confirmation paiement
 *   invoice.payment_failed             → paiement en échec → past_due
 *
 * ⚠️  IMPORTANT — body parsing désactivé (export config ci-dessous)
 *   Vercel parse automatiquement le JSON → détruit la signature Stripe.
 *   On lit le body brut depuis le stream pour que constructEvent fonctionne.
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendTransactional } from '../emails/send.js';

// ── Désactiver le body parser Vercel ──────────────────────────────────────────
// Sans cela, Vercel re-sérialise le JSON et la signature Stripe ne correspond plus.
export const config = {
  api: { bodyParser: false },
};

// ── Lire le corps brut depuis le stream ───────────────────────────────────────
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  // Utiliser obligatoirement SUPABASE_SERVICE_KEY (clé service_role) pour les
  // opérations admin (auth.admin.getUserById, update profiles sans RLS)
  process.env.SUPABASE_SERVICE_KEY
);

// ── Helpers ────────────────────────────────────────────────────────────────────

async function updateProfile(userId, updates) {
  if (!userId) { console.warn('[webhook] updateProfile: userId manquant'); return; }
  const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId);
  if (error) console.error('[webhook] Supabase update error:', error.message);
  else console.log('[webhook] Profile mis à jour:', userId, Object.keys(updates).join(', '));
}

/**
 * Résout userId depuis les métadonnées d'un objet Stripe.
 * Cherche dans sub.metadata, puis dans le customer Stripe (fallback).
 */
async function resolveUserId(obj) {
  if (obj.metadata?.userId) return obj.metadata.userId;
  // Fallback : chercher dans le customer Stripe
  if (obj.customer) {
    try {
      const customer = await stripe.customers.retrieve(obj.customer);
      return customer.metadata?.userId || null;
    } catch (e) {
      console.error('[webhook] Impossible de récupérer le customer:', e.message);
    }
  }
  return null;
}

/**
 * Résout l'adresse email d'un utilisateur depuis Supabase (auth) ou le customer Stripe.
 */
async function resolveEmail(userId, customerId) {
  // 1. Depuis Supabase auth
  if (userId) {
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      if (data?.user?.email) return data.user.email;
    } catch (e) { /* fallback */ }
  }
  // 2. Depuis le customer Stripe
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.email) return customer.email;
    } catch (e) { /* non bloquant */ }
  }
  return null;
}

/**
 * Extrait le plan de base depuis les métadonnées Stripe.
 * Ex: "growth_annual" → "growth"
 */
function extractBasePlan(metadata) {
  const raw = metadata?.plan || '';
  return raw.replace('_annual', '') || 'growth';
}

/**
 * Extrait le cycle de facturation depuis les métadonnées ou l'intervalle de l'abonnement.
 */
function extractBillingCycle(metadata, subscription) {
  if (metadata?.billingCycle) return metadata.billingCycle;
  if (subscription?.items?.data?.[0]?.price?.recurring?.interval === 'year') return 'annual';
  return 'monthly';
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    // Lire le corps brut depuis le stream (bodyParser désactivé via export config)
    const rawBody = await getRawBody(req);

    if (webhookSecret && sig) {
      // Vérification de signature Stripe — nécessite les bytes bruts originaux
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Dev/test : pas de vérification de signature
      console.warn('[webhook] ⚠️ STRIPE_WEBHOOK_SECRET absent — signature non vérifiée');
      event = JSON.parse(rawBody.toString('utf8'));
    }
  } catch (err) {
    console.error('[webhook] Erreur parsing/signature:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`[webhook] Événement reçu: ${event.type}`);

  try {
    switch (event.type) {

      // ── Paiement checkout finalisé ──────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId  = session.metadata?.userId;
        const plan    = extractBasePlan(session.metadata);
        const cycle   = session.metadata?.billingCycle || 'monthly';

        if (userId) {
          // Récupérer les détails de l'abonnement pour le statut réel et la date de fin
          // (le sub peut être "trialing" si trial_period_days est configuré)
          let periodEnd = null;
          let actualStatus = 'active';
          if (session.subscription) {
            try {
              const sub = await stripe.subscriptions.retrieve(session.subscription);
              periodEnd    = new Date(sub.current_period_end * 1000).toISOString();
              actualStatus = sub.status; // trialing | active | past_due | ...
            } catch (e) { /* non bloquant */ }
          }

          await updateProfile(userId, {
            stripe_customer_id:              session.customer,
            stripe_subscription_id:          session.subscription,
            subscription_status:             actualStatus,
            subscription_plan:               plan,
            subscription_billing_cycle:      cycle,
            subscription_current_period_end: periodEnd,
          });

          // Email de bienvenue — trial démarré
          const email = await resolveEmail(userId, session.customer);
          if (email) await sendTransactional('welcome', { email, plan });
        }
        break;
      }

      // ── Abonnement modifié (upgrade/downgrade/renouvellement/trial→active) ──
      case 'customer.subscription.updated': {
        const sub    = event.data.object;
        const userId = await resolveUserId(sub);
        const plan   = extractBasePlan(sub.metadata);
        const cycle  = extractBillingCycle(sub.metadata, sub);

        if (userId) {
          await updateProfile(userId, {
            stripe_subscription_id:          sub.id,
            subscription_status:             sub.status,           // active | trialing | past_due | canceled
            subscription_plan:               plan,
            subscription_billing_cycle:      cycle,
            subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }

      // ── Abonnement résilié ──────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub    = event.data.object;
        const userId = await resolveUserId(sub);

        if (userId) {
          // On conserve stripe_subscription_id pour que isWalled dans Layout.jsx
          // puisse distinguer "jamais abonné" (null) de "abonnement résilié" (ID archivé).
          // On NE null pas l'ID ici volontairement.
          await updateProfile(userId, {
            subscription_status:             'inactive',
            subscription_plan:               'free',
            subscription_billing_cycle:      null,
            subscription_current_period_end: null,
          });
        }
        break;
      }

      // ── Essai gratuit se termine dans 3 jours ──────────────────────────────
      // Stripe envoie cet événement 3 jours avant la fin du trial
      case 'customer.subscription.trial_will_end': {
        const sub    = event.data.object;
        const userId = await resolveUserId(sub);
        const trialEnd = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null;

        console.log(`[webhook] Essai se termine bientôt pour userId=${userId}, trial_end=${trialEnd}`);
        if (userId && trialEnd) {
          await updateProfile(userId, {
            subscription_current_period_end: trialEnd,
            subscription_status:             'trialing',
          });

          // Email J-3 avant fin d'essai
          const daysLeft = Math.max(0, Math.ceil((new Date(trialEnd) - new Date()) / (1000 * 60 * 60 * 24)));
          const plan     = extractBasePlan(sub.metadata);
          const email    = await resolveEmail(userId, sub.customer);
          if (email) await sendTransactional('trial_ending', { email, plan, daysLeft });
        }
        break;
      }

      // ── Paiement facture réussi ─────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Gérer : renouvellement périodique, changement de plan, et réactivation après past_due
        const handledReasons = ['subscription_cycle', 'subscription_update', 'manual'];
        if (handledReasons.includes(invoice.billing_reason) && invoice.subscription) {
          const userId = await resolveUserId({ customer: invoice.customer, metadata: {} });
          if (userId) {
            const sub       = await stripe.subscriptions.retrieve(invoice.subscription);
            const plan      = extractBasePlan(sub.metadata);
            const cycle     = extractBillingCycle(sub.metadata, sub);
            const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
            await updateProfile(userId, {
              subscription_status:             'active',
              subscription_plan:               plan,
              subscription_billing_cycle:      cycle,
              subscription_current_period_end: periodEnd,
            });

            // Email de confirmation de paiement (renouvellement seulement)
            if (invoice.billing_reason === 'subscription_cycle') {
              const email = await resolveEmail(userId, invoice.customer);
              if (email) await sendTransactional('payment_ok', { email, plan, periodEnd });
            }
          }
        }
        break;
      }

      // ── Paiement facture échoué ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice  = event.data.object;
        const userId   = await resolveUserId({ customer: invoice.customer, metadata: {} });

        console.warn(`[webhook] Paiement échoué pour customer=${invoice.customer}`);
        if (userId) {
          // Récupérer le plan actuel pour personnaliser l'email
          const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_plan')
            .eq('user_id', userId)
            .single();
          const plan = profile?.subscription_plan || 'growth';

          await updateProfile(userId, { subscription_status: 'past_due' });

          // Email d'alerte paiement échoué
          const email = await resolveEmail(userId, invoice.customer);
          if (email) await sendTransactional('payment_failed', { email, plan });
        }
        break;
      }

      default:
        console.log(`[webhook] Événement non traité: ${event.type}`);
    }

    return res.status(200).json({ received: true, type: event.type });

  } catch (error) {
    console.error('[webhook] Erreur interne:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
