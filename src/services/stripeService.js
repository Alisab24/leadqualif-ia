/**
 * stripeService.js
 * Service Stripe côté frontend — LeadQualif
 * Gère les appels vers les API routes Vercel
 */

import { loadStripe } from '@stripe/stripe-js';

// Clé publique Stripe (safe côté client)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise = null;

export const getStripe = () => {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// URL de base pour les API routes
const API_BASE = '';

/**
 * Redirige vers Stripe Checkout pour s'abonner
 * @param {object} options - { plan, userId, userEmail, agencyName }
 */
export const redirectToCheckout = async ({ plan, userId, userEmail, agencyName }) => {
  try {
    const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        userId,
        userEmail,
        agencyName,
        successUrl: `${window.location.origin}/dashboard?subscription=success&plan=${plan}`,
        cancelUrl: `${window.location.origin}/settings?tab=facturation&canceled=true`,
      }),
    });

    // Lire la réponse comme texte d'abord pour éviter un crash si ce n'est pas du JSON
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Le serveur a renvoyé du HTML ou du texte brut — souvent une variable d'env manquante
      console.error('Réponse non-JSON du serveur:', text.slice(0, 200));
      throw new Error('Erreur serveur. Vérifiez que STRIPE_SECRET_KEY est bien défini dans les variables Vercel.');
    }

    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de la création de la session');
    }

    // Redirection directe vers Stripe Checkout
    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    }

    // Fallback avec Stripe.js
    const stripe = await getStripe();
    if (stripe && data.sessionId) {
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw new Error(error.message);
    }

    return { success: true };
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Ouvre le portail de facturation Stripe
 * (gérer abonnement, factures, annulation)
 * @param {string} userEmail
 */
export const openBillingPortal = async (userEmail) => {
  try {
    const res = await fetch(`${API_BASE}/api/stripe/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        returnUrl: `${window.location.origin}/settings?tab=facturation`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de l\'ouverture du portail');
    }

    if (data.url) {
      window.location.href = data.url;
      return { success: true };
    }

    throw new Error('URL du portail non reçue');
  } catch (error) {
    console.error('Stripe portal error:', error);
    return { success: false, error: error.message };
  }
};

// Noms des plans
export const PLAN_LABELS = {
  free: '🆓 Gratuit',
  starter: '🚀 Starter',
  growth: '⭐ Growth',
  enterprise: '🏢 Enterprise',
  trialing: '🎯 Essai gratuit',
};

// Couleurs des plans
export const PLAN_COLORS = {
  free: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  growth: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-purple-100 text-purple-700',
  trialing: 'bg-green-100 text-green-700',
};

// Statuts d'abonnement
export const STATUS_LABELS = {
  active: '✅ Actif',
  inactive: '⚫ Inactif',
  past_due: '⚠️ Paiement en retard',
  canceled: '❌ Annulé',
  trialing: '🎯 Essai gratuit',
  free: '🆓 Gratuit',
};
