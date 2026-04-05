/**
 * Settings — Paramètres de l'Agence
 * Design unifié (slate, h-screen, w-full)
 * Formulaire adaptatif selon type agence (IMMO / SMMA)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import {
  redirectToCheckout,
  openBillingPortal,
  PLAN_LABELS,
  PLAN_COLORS,
  STATUS_LABELS,
} from '../services/stripeService';
import TeamSettings from '../components/TeamSettings';
import LanguageSelector from '../components/LanguageSelector';

/* ─── Toast interne ──────────────── */
const Toast = ({ message, type = 'success', onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5
    rounded-xl shadow-xl text-sm font-semibold transition-all
    ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
    <span>{type === 'success' ? '✅' : '❌'}</span>
    <span>{message}</span>
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
  </div>
);

/* ─── Toggle Switch ──────────── */
const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
      ${checked ? 'bg-indigo-600' : 'bg-slate-200'}
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
      ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

/* ─── Champ formulaire ────────────────── */
const Field = ({ label, hint, children, required }) => (
  <div>
    <label className="block text-xs font-bold text-slate-600 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
  </div>
);

const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
      bg-white placeholder:text-slate-300 ${className}`}
    {...props}
  />
);

const Select = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
      bg-white ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
      bg-white placeholder:text-slate-300 resize-none ${className}`}
    {...props}
  />
);

/* ─── Palettes couleurs ─────────────────── */
const COLOR_PRESETS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#0f172a', '#475569',
];

/* ════════════════════════════════════════════════════════════ */
/* ─── BillingTab — Onglet Abonnement complet ────────────── */

// Définition des plans alignée avec PlanGuard + landing
const BILLING_PLANS = [
  {
    key: 'starter',
    name: 'Solo',
    monthlyPrice: 49,
    annualMonthly: 39,
    annualTotal: 468,
    border: 'border-slate-200',
    badge: null,
    btnCls: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    features: [
      { icon: '👤', text: '1 utilisateur' },
      { icon: '📊', text: '100 leads / mois' },
      { icon: '🤖', text: 'Scoring IA 0–100 (chaud / tiède / froid)' },
      { icon: '📋', text: 'Pipeline Kanban' },
      { icon: '📄', text: 'Factures & devis PDF' },
      { icon: '📧', text: 'Envoi documents par email (PDF joint)' },
      { icon: '💬', text: 'Partage WhatsApp en 1 clic' },
      { icon: '🙋', text: 'Support email' },
    ],
    locked: ['Stats & Analytics', 'Recommandations IA avancées', 'Contrats & rapports', 'Gestion équipe (multi-users)'],
  },
  {
    key: 'growth',
    name: 'Agence',
    monthlyPrice: 149,
    annualMonthly: 119,
    annualTotal: 1428,
    border: 'border-blue-400 ring-2 ring-blue-100',
    badge: '⭐ Le plus populaire',
    btnCls: 'bg-blue-600 text-white hover:bg-blue-700',
    features: [
      { icon: '👥', text: '5 utilisateurs inclus' },
      { icon: '♾️', text: 'Leads illimités' },
      { icon: '🤖', text: 'Scoring IA avancé + recommandations' },
      { icon: '📄', text: 'Documents illimités (factures, devis, contrats, rapports)' },
      { icon: '📧', text: 'Envoi automatique par email (PDF haute qualité)' },
      { icon: '💬', text: 'WhatsApp enrichi (réf., montant) + contact en série' },
      { icon: '📊', text: 'Stats & Analytics (CA, ROI, pipeline)' },
      { icon: '✉️', text: 'Invitations équipe par email' },
      { icon: '🚀', text: 'Support prioritaire 24/7' },
    ],
    locked: [],
  },
  {
    key: 'enterprise',
    name: 'Expert',
    monthlyPrice: 399,
    annualMonthly: 319,
    annualTotal: 3828,
    border: 'border-purple-200',
    badge: null,
    btnCls: 'border border-purple-300 text-purple-700 hover:bg-purple-50',
    features: [
      { icon: '♾️', text: 'Utilisateurs illimités' },
      { icon: '♾️', text: 'Leads illimités' },
      { icon: '✅', text: 'Tout le plan Agence' },
      { icon: '📧', text: 'Envoi email & WhatsApp à volume illimité' },
      { icon: '🏢', text: 'Multi-agences sur un seul compte' },
      { icon: '🎓', text: 'Onboarding dédié & formation équipe' },
      { icon: '🛡️', text: 'SLA garanti & support téléphonique' },
    ],
    locked: [],
  },
]

// Mapping fonctionnalité → plans requis (pour l'affichage du résumé)
const FEATURE_MAP = [
  { label: 'Leads / mois',                    free: '10',     starter: '100',    growth: '∞',             enterprise: '∞' },
  { label: 'Pipeline Kanban',                  free: '✅',     starter: '✅',     growth: '✅',             enterprise: '✅' },
  { label: 'Scoring IA 0–100',                 free: '✅',     starter: '✅',     growth: '✅ avancé',      enterprise: '✅ avancé' },
  { label: 'Factures & devis PDF',             free: '—',      starter: '✅',     growth: '✅',             enterprise: '✅' },
  { label: 'Envoi doc par email (PDF joint)',   free: '—',      starter: '✅',     growth: '✅',             enterprise: '✅ illimité' },
  { label: 'Partage WhatsApp en 1 clic',       free: '✅',     starter: '✅',     growth: '✅ enrichi',     enterprise: '✅ enrichi' },
  { label: 'Contact WhatsApp en série',         free: '✅',     starter: '✅',     growth: '✅',             enterprise: '✅' },
  { label: 'Contrats & rapports',              free: '—',      starter: '—',      growth: '✅',             enterprise: '✅' },
  { label: 'Stats & Analytics',                free: '—',      starter: '—',      growth: '✅',             enterprise: '✅' },
  { label: 'Recommandations IA',               free: '—',      starter: '—',      growth: '✅',             enterprise: '✅' },
  { label: 'Invitations équipe',               free: '—',      starter: '✅ 3',   growth: '✅ 5',           enterprise: '✅ ∞' },
  { label: 'Import CSV / Excel',               free: '—',      starter: '✅',     growth: '✅',             enterprise: '✅' },
  { label: 'Pixels FB / Google Ads',           free: '✅',     starter: '✅',     growth: '✅',             enterprise: '✅' },
  { label: 'Support',                          free: 'Email',  starter: 'Email',  growth: 'Prioritaire',   enterprise: 'Dédié + tél.' },
  { label: 'API dédiée',                       free: '—',      starter: '—',      growth: '—',              enterprise: '✅' },
  { label: 'SLA garanti',                      free: '—',      starter: '—',      growth: '—',              enterprise: '99,9%' },
]

// Fonctionnalités actives/bloquées selon le plan
const PLAN_ACTIVE_FEATURES = {
  free:       { stats: false, docs: false,  ia: false, multiUsers: false, contracts: false, emailSend: false, whatsapp: true,  leads: '10/mois'  },
  starter:    { stats: false, docs: true,   ia: false, multiUsers: true,  contracts: false, emailSend: true,  whatsapp: true,  leads: '100/mois' },
  growth:     { stats: true,  docs: true,   ia: true,  multiUsers: true,  contracts: true,  emailSend: true,  whatsapp: true,  leads: 'Illimité' },
  trialing:   { stats: true,  docs: true,   ia: true,  multiUsers: true,  contracts: true,  emailSend: true,  whatsapp: true,  leads: 'Illimité' },
  enterprise: { stats: true,  docs: true,   ia: true,  multiUsers: true,  contracts: true,  emailSend: true,  whatsapp: true,  leads: 'Illimité' },
}

const FEATURE_LABELS = {
  stats:      { icon: '📊', label: 'Stats & Analytics' },
  docs:       { icon: '📄', label: 'Documents (factures, devis)' },
  ia:         { icon: '🤖', label: 'Recommandations IA' },
  multiUsers: { icon: '👥', label: 'Gestion équipe' },
  contracts:  { icon: '📋', label: 'Contrats & rapports' },
  emailSend:  { icon: '📧', label: 'Envoi par email (PDF joint)' },
  whatsapp:   { icon: '💬', label: 'Partage WhatsApp' },
  leads:      { icon: '🎯', label: 'Leads' },
}

function BillingTab({ subscriptionInfo, stripeLoading, stripeError, onSubscribe, onPortal }) {
  const [billingCycle, setBillingCycle] = React.useState('monthly')

  // Détecter un essai expiré côté client (webhook pas encore reçu)
  const trialExpiredClient = subscriptionInfo.status === 'trialing' &&
    subscriptionInfo.current_period_end &&
    new Date(subscriptionInfo.current_period_end) < new Date()

  // Un abonnement Stripe est considéré valide seulement si le webhook a bien enregistré
  // le stripe_subscription_id. Sans cet ID, l'abonnement n'est pas confirmé par Stripe.
  const hasValidStripeSubscription = !!subscriptionInfo.stripe_subscription_id

  const isActive = !trialExpiredClient && ['active', 'trialing'].includes(subscriptionInfo.status)
  const isPastDue = subscriptionInfo.status === 'past_due'
  // Si l'essai a expiré OU pas de confirmation Stripe, currentPlan revient à 'free'
  const currentPlan = (trialExpiredClient || !hasValidStripeSubscription)
    ? 'free'
    : (subscriptionInfo.plan || 'free')
  // Indique si le client a déjà eu un abonnement Stripe (pour adapter le libellé du bouton)
  const hadSubscription = !!subscriptionInfo.stripe_customer_id
  const activeFeatures = PLAN_ACTIVE_FEATURES[currentPlan] || PLAN_ACTIVE_FEATURES.free

  const planDisplay = {
    free: { label: 'Gratuit', color: 'bg-slate-100 text-slate-600' },
    starter: { label: 'Solo', color: 'bg-blue-100 text-blue-700' },
    growth: { label: 'Agence', color: 'bg-indigo-100 text-indigo-700' },
    trialing: { label: 'Essai gratuit', color: 'bg-green-100 text-green-700' },
    enterprise: { label: 'Expert', color: 'bg-purple-100 text-purple-700' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">💳 Abonnement & Facturation</h2>
        <p className="text-sm text-slate-500">Gérez votre abonnement LeadQualif — paiements sécurisés via Stripe</p>
      </div>

      {stripeError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {stripeError}</div>
      )}

      {isPastDue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">🚨</span>
          <div>
            <p className="font-bold text-red-800">Paiement en échec</p>
            <p className="text-sm text-red-700 mt-1">Votre accès sera suspendu si le paiement n'est pas régularisé. Mettez à jour votre moyen de paiement.</p>
            <button onClick={onPortal} disabled={stripeLoading}
              className="mt-2 px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {stripeLoading ? '⏳…' : '🔧 Mettre à jour le paiement'}
            </button>
          </div>
        </div>
      )}

      {/* ── Plan actuel ─────────────────────────────────────────── */}
      {isActive ? (
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Plan actuel</p>
              <p className="text-3xl font-extrabold">
                {planDisplay[currentPlan]?.label || currentPlan}
              </p>
              <p className="text-blue-200 text-sm mt-1">
                {subscriptionInfo.status === 'trialing' ? '🎯 Période d\'essai' : '✅ Abonnement actif'}
                {subscriptionInfo.current_period_end &&
                  ` · Renouvellement le ${new Date(subscriptionInfo.current_period_end).toLocaleDateString('fr-FR')}`
                }
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={onPortal} disabled={stripeLoading}
                className="px-4 py-2 bg-white text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap">
                {stripeLoading ? '⏳…' : '⚙️ Gérer l\'abonnement'}
              </button>
              <button onClick={onPortal} disabled={stripeLoading}
                className="px-4 py-2 bg-white/15 text-white rounded-lg font-semibold text-sm hover:bg-white/25 disabled:opacity-50 whitespace-nowrap">
                📄 Mes factures
              </button>
            </div>
          </div>

          {/* Fonctionnalités actives */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white/10 rounded-xl p-4">
            {Object.entries(activeFeatures).map(([key, val]) => {
              const feat = FEATURE_LABELS[key]
              if (!feat) return null
              const active = val === true || (typeof val === 'string' && val !== '—')
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className={active ? 'text-green-300' : 'text-red-400'}>
                    {active ? '✓' : '✗'}
                  </span>
                  <span className={active ? 'text-white' : 'text-blue-300 line-through opacity-60'}>
                    {feat.icon} {key === 'leads' ? `${feat.label} : ${val}` : feat.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <span className="text-2xl mt-0.5">⚡</span>
          <div>
            <p className="font-bold text-amber-900 text-base">Aucun abonnement actif</p>
            <p className="text-sm text-amber-700 mt-1">Choisissez un plan ci-dessous pour débloquer toutes les fonctionnalités</p>
            <div className="flex flex-wrap gap-3 mt-3 text-xs font-medium text-amber-600">
              <span>🎯 7 jours d'essai gratuit</span>
              <span>🚫 Sans engagement</span>
              <span>🔒 Paiement sécurisé Stripe</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle mensuel / annuel ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-slate-700">
          {isActive ? 'Changer de plan' : 'Choisir votre plan'}
        </h3>
        <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${
              billingCycle === 'monthly' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
            }`}>
            Mensuel
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              billingCycle === 'annual' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
            }`}>
            Annuel
            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              −20%
            </span>
          </button>
        </div>
      </div>

      {/* ── Cartes plans ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BILLING_PLANS.map(plan => {
          const isCurrent = currentPlan === plan.key && isActive
          const price = billingCycle === 'annual' ? plan.annualMonthly : plan.monthlyPrice
          const planId = billingCycle === 'annual' ? `${plan.key}_annual` : plan.key

          return (
            <div key={plan.key} className={`border-2 rounded-xl p-5 relative flex flex-col ${plan.border} ${isCurrent ? 'bg-blue-50/50' : 'bg-white'}`}>
              {plan.badge && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] px-3 py-1 rounded-full font-bold whitespace-nowrap">
                  {plan.badge}
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[11px] px-3 py-1 rounded-full font-bold whitespace-nowrap">
                  ✅ Plan actuel
                </span>
              )}

              <p className="font-extrabold text-slate-800 text-base">{plan.name}</p>
              <div className="flex items-baseline gap-1 mt-1 mb-0.5">
                <span className="text-2xl font-extrabold text-blue-600">{plan.key === 'enterprise' ? '' : `${price}€`}</span>
                {plan.key !== 'enterprise' && <span className="text-xs text-slate-400">/mois HT</span>}
                {plan.key === 'enterprise' && <span className="text-lg font-bold text-slate-600">Sur devis</span>}
              </div>
              {billingCycle === 'annual' && plan.key !== 'enterprise' && (
                <p className="text-[11px] text-green-600 font-semibold">
                  Facturé {plan.annualTotal}€/an — économie {(plan.monthlyPrice - plan.annualMonthly) * 12}€
                </p>
              )}
              <p className="text-[11px] text-green-600 font-medium mt-0.5">🎯 7 jours offerts</p>

              <ul className="mt-3 space-y-1.5 flex-1 mb-4">
                {plan.features.map(f => (
                  <li key={f.text} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-green-500 shrink-0 mt-0.5 font-bold">✓</span>
                    <span>{f.icon} {f.text}</span>
                  </li>
                ))}
                {plan.locked.map(f => (
                  <li key={f} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">🔒</span>
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.key === 'enterprise' ? (
                <a href="mailto:contact@nexapro.tech?subject=LeadQualif Expert"
                  className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition text-center block ${plan.btnCls}`}>
                  Nous contacter →
                </a>
              ) : (
                <button
                  onClick={() => onSubscribe(planId)}
                  disabled={stripeLoading || isCurrent}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${plan.btnCls}`}>
                  {stripeLoading
                    ? '⏳…'
                    : isCurrent
                    ? '✅ Plan actuel'
                    : hadSubscription
                    ? 'Choisir ce plan →'
                    : "Démarrer l'essai gratuit"}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-center text-slate-400">
        🔒 Paiement sécurisé via Stripe · Annulation à tout moment · Sans engagement · Données hébergées en Europe
      </p>

      {/* ── Tableau comparatif ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-700">📋 Comparatif complet des fonctionnalités</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-500 w-2/5">Fonctionnalité</th>
                {['Free', 'Solo', 'Agence', 'Expert'].map((name, i) => (
                  <th key={name} className={`px-3 py-3 text-center font-bold text-sm ${
                    i === 0 ? 'text-slate-400' :
                    i === 1 ? 'text-blue-600' :
                    i === 2 ? 'text-indigo-600' :
                    'text-purple-600'
                  } ${currentPlan === ['free','starter','growth','enterprise'][i] && isActive ? 'bg-blue-50' : ''}`}>
                    {name}
                    {currentPlan === ['free','starter','growth','enterprise'][i] && isActive && (
                      <span className="block text-[10px] text-green-600 font-normal">actuel</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {FEATURE_MAP.map((row, i) => (
                <tr key={i} className="hover:bg-blue-50/30 transition">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{row.label}</td>
                  {[row.free, row.starter, row.growth, row.enterprise].map((val, j) => {
                    const isCur = currentPlan === ['free','starter','growth','enterprise'][j] && isActive
                    return (
                      <td key={j} className={`px-3 py-2.5 text-center ${
                        val === '—' ? 'text-slate-200' :
                        val?.startsWith('✅') ? 'text-green-600 font-semibold' :
                        'text-slate-600'
                      } ${isCur ? 'bg-blue-50 font-semibold' : ''}`}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Portail Stripe ────────────────────────────────────── */}
      {subscriptionInfo.stripe_customer_id && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">⚙️ Portail de gestion Stripe</h3>
            <p className="text-xs text-slate-500 mt-1">Changez de plan, mettez à jour votre carte, téléchargez vos factures ou annulez.</p>
          </div>
          <button onClick={onPortal} disabled={stripeLoading}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50 whitespace-nowrap shrink-0">
            {stripeLoading ? '⏳ Ouverture…' : '→ Ouvrir le portail'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════ */
export default function Settings() {
  const { t } = useTranslation();
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [userId, setUserId]       = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole]   = useState('owner'); // 'owner' | 'admin' | 'agent'
  const [activeTab, setActiveTab] = useState('general');
  const [toast, setToast]         = useState(null);

  // Messagerie WhatsApp / Twilio
  const [twilioSettings, setTwilioSettings] = useState({
    account_sid: '', auth_token: '', whatsapp_number: '',
  });
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioShowToken, setTwilioShowToken] = useState(false);

  // Stripe
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError]     = useState('');
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    status: 'inactive', plan: 'free', current_period_end: null,
  });
  const [pendingPlan, setPendingPlan] = useState(null);

  // Détecter params URL — et vérifier la session Stripe si retour de checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      const plan      = params.get('plan') || 'growth';
      const sessionId = params.get('session_id');
      setActiveTab('facturation');
      window.history.replaceState({}, '', '/settings?tab=facturation');

      // Vérification directe via Stripe — fallback si le webhook n'a pas encore tiré
      if (sessionId) {
        fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              showToast(`✅ Abonnement ${plan.toUpperCase()} activé ! Rechargement…`);
              // Recharger la page pour que PlanGuard relise le profil mis à jour
              setTimeout(() => window.location.reload(), 1500);
            } else {
              showToast(`Plan activé — rechargement dans un instant…`);
              setTimeout(() => window.location.reload(), 2000);
            }
          })
          .catch(() => {
            showToast(`Abonnement activé ! Actualisez la page si les fonctionnalités ne s'affichent pas.`);
          });
      } else {
        showToast(`Abonnement ${plan.toUpperCase()} activé ! Bienvenue sur LeadQualif.`);
        setTimeout(() => window.location.reload(), 1500);
      }
      return;
    }
    if (params.get('canceled') === 'true') {
      setActiveTab('facturation');
      window.history.replaceState({}, '', '/settings?tab=facturation');
      return;
    }
    if (params.get('tab')) setActiveTab(params.get('tab'));
    const planParam = params.get('plan');
    const VALID_PLANS = ['starter', 'growth', 'enterprise', 'starter_annual', 'growth_annual', 'enterprise_annual'];
    if (planParam && VALID_PLANS.includes(planParam)) {
      setPendingPlan(planParam);
      setActiveTab('facturation');
      window.history.replaceState({}, '', '/settings?tab=facturation');
    }
    const storedPlan = sessionStorage.getItem('pendingPlan');
    if (storedPlan && VALID_PLANS.includes(storedPlan)) {
      setPendingPlan(storedPlan);
      sessionStorage.removeItem('pendingPlan');
      setActiveTab('facturation');
    }
  }, []);

  // Réinitialiser l'onglet actif si le rôle ne l'autorise pas
  useEffect(() => {
    if (!loading && userRole) {
      const allowed = { owner: ['general','visuel','form','legal','crm','messagerie','equipe','facturation'], admin: ['form','crm','messagerie'], agent: [] }[userRole] ?? [];
      if (allowed.length > 0 && !allowed.includes(activeTab)) {
        setActiveTab(allowed[0]);
      }
    }
  }, [userRole, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-checkout depuis landing
  useEffect(() => {
    if (!loading && pendingPlan && userEmail && userId) {
      const plan = pendingPlan;
      setPendingPlan(null);
      handleSubscribeWithEmail(plan, userEmail, userId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingPlan, userEmail, userId]);

  // État global du formulaire
  const [formData, setFormData] = useState({
    nom_agence: '',
    email: '',
    telephone: '',
    adresse: '',
    pays: 'France',
    devise: 'EUR',
    symbole_devise: '€',
    format_devise: '1 000 €',
    calendly_link: '',
    logo_url: '',
    signature_url: '',
    ville_agence: '',
    couleur_primaire: '#2563eb',
    couleur_secondaire: '#7c3aed',
    type_agence: 'immobilier',
    // Légal
    nom_legal: '',
    statut_juridique: '',
    numero_enregistrement: '',
    adresse_legale: '',
    mention_legale: '',
    conditions_paiement: '',
    // Légal IMMO spécifique
    carte_pro_t: '',
    carte_pro_s: '',
    // Légal SMMA spécifique
    activite_principale: '',
    numero_tva: '',
    // Tracking & Pixels
    facebook_pixel_id: '',
    google_ads_id: '',
    google_ads_label: '',
    // Alertes notifications
    notification_email: '',
    notification_webhook: '',
    // Premium
    show_amount_in_words: false,
    // Formulaire IA
    form_settings: {
      showBudget: true,
      showType: true,
      showDelai: true,
      showLocalisation: true,
      showRole: true,
      showObjectifMarketing: false,
      showTypeService: false,
      agencyName: '',
    },
    // CRM
    crm_settings: {
      priorite_defaut: 'moyenne',
      source_principale: 'formulaire_ia',
      pipeline_utilise: 'immobilier',
    },
  });

  const loadTwilioSettings = async () => {
    const { data } = await supabase
      .from('agency_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_whatsapp_number')
      .eq('agency_id', userId)
      .maybeSingle();
    if (data) {
      setTwilioSettings({
        account_sid:      data.twilio_account_sid      || '',
        auth_token:       data.twilio_auth_token       || '',
        whatsapp_number:  data.twilio_whatsapp_number  || '',
      });
    }
  };

  const saveTwilioSettings = async () => {
    if (twilioSaving) return;
    setTwilioSaving(true);
    const { error } = await supabase
      .from('agency_settings')
      .upsert({
        agency_id:              userId,
        twilio_account_sid:     twilioSettings.account_sid.trim()     || null,
        twilio_auth_token:      twilioSettings.auth_token.trim()      || null,
        twilio_whatsapp_number: twilioSettings.whatsapp_number.trim() || null,
      }, { onConflict: 'agency_id' });
    setTwilioSaving(false);
    if (error) {
      showToast('❌ Erreur sauvegarde : ' + error.message, 'error');
    } else {
      showToast('✅ Paramètres WhatsApp sauvegardés');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { if (userId) loadTwilioSettings(); }, [userId]);

  // Sanitise un objet JSONB venant de Supabase :
  // - garde uniquement les clés attendues (whitelist)
  // - évite le RangeError "Too many properties" si la colonne est corrompue
  const sanitizeFormSettings = (raw) => {
    const defaults = { showBudget: true, showType: true, showDelai: true, showLocalisation: true, showRole: true, showObjectifMarketing: false, showTypeService: false, agencyName: '' };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
    return {
      showBudget:            typeof raw.showBudget            === 'boolean' ? raw.showBudget            : defaults.showBudget,
      showType:              typeof raw.showType              === 'boolean' ? raw.showType              : defaults.showType,
      showDelai:             typeof raw.showDelai             === 'boolean' ? raw.showDelai             : defaults.showDelai,
      showLocalisation:      typeof raw.showLocalisation      === 'boolean' ? raw.showLocalisation      : defaults.showLocalisation,
      showRole:              typeof raw.showRole              === 'boolean' ? raw.showRole              : defaults.showRole,
      showObjectifMarketing: typeof raw.showObjectifMarketing === 'boolean' ? raw.showObjectifMarketing : defaults.showObjectifMarketing,
      showTypeService:       typeof raw.showTypeService       === 'boolean' ? raw.showTypeService       : defaults.showTypeService,
      agencyName:            typeof raw.agencyName            === 'string'  ? raw.agencyName            : '',
    };
  };

  const sanitizeCrmSettings = (raw) => {
    const defaults = { priorite_defaut: 'moyenne', source_principale: 'formulaire_ia', pipeline_utilise: 'immobilier' };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
    return {
      priorite_defaut:    typeof raw.priorite_defaut    === 'string' ? raw.priorite_defaut    : defaults.priorite_defaut,
      source_principale:  typeof raw.source_principale  === 'string' ? raw.source_principale  : defaults.source_principale,
      pipeline_utilise:   typeof raw.pipeline_utilise   === 'string' ? raw.pipeline_utilise   : defaults.pipeline_utilise,
    };
  };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserEmail(user.email || '');

      // Sélectionner uniquement les colonnes nécessaires (évite de charger des données massives)
      const { data, error } = await supabase
        .from('profiles')
        .select('role,nom_agence,telephone,adresse,pays,devise,symbole_devise,format_devise,calendly_link,logo_url,signature_url,ville_agence,couleur_primaire,couleur_secondaire,type_agence,nom_legal,statut_juridique,numero_enregistrement,adresse_legale,mention_legale,conditions_paiement,carte_pro_t,carte_pro_s,activite_principale,numero_tva,facebook_pixel_id,google_ads_id,google_ads_label,show_amount_in_words,form_settings,crm_settings,subscription_status,subscription_plan,subscription_current_period_end,stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement profil:', error.message);
      }

      if (data) {
        // Stocker le rôle pour filtrer les onglets visibles
        const role = data.role || 'owner';
        setUserRole(role);

        // Profil existant → charger les données avec sanitisation défensive
        setFormData({
          nom_agence: data.nom_agence || '',
          email: user.email,
          telephone: data.telephone || '',
          adresse: data.adresse || '',
          pays: data.pays || 'France',
          devise: data.devise || 'EUR',
          symbole_devise: data.symbole_devise || '€',
          format_devise: data.format_devise || '1 000 €',
          calendly_link: data.calendly_link || '',
          logo_url: data.logo_url || '',
          signature_url: data.signature_url || '',
          ville_agence: data.ville_agence || '',
          couleur_primaire: data.couleur_primaire || '#2563eb',
          couleur_secondaire: data.couleur_secondaire || '#7c3aed',
          type_agence: data.type_agence || null,
          nom_legal: data.nom_legal || '',
          statut_juridique: data.statut_juridique || '',
          numero_enregistrement: data.numero_enregistrement || '',
          adresse_legale: data.adresse_legale || '',
          mention_legale: data.mention_legale || '',
          conditions_paiement: data.conditions_paiement || '',
          carte_pro_t: data.carte_pro_t || '',
          carte_pro_s: data.carte_pro_s || '',
          activite_principale: data.activite_principale || '',
          numero_tva: data.numero_tva || '',
          facebook_pixel_id: data.facebook_pixel_id || '',
          google_ads_id: data.google_ads_id || '',
          google_ads_label: data.google_ads_label || '',
          notification_email:   data.notification_email   || '',
          notification_webhook: data.notification_webhook || '',
          show_amount_in_words: data.show_amount_in_words || false,
          form_settings: sanitizeFormSettings(data.form_settings),
          crm_settings:  sanitizeCrmSettings(data.crm_settings),
        });
        setSubscriptionInfo({
          status: data.subscription_status || 'inactive',
          plan: data.subscription_plan || 'free',
          current_period_end: data.subscription_current_period_end || null,
          stripe_customer_id: data.stripe_customer_id || null,
        });
      } else {
        // Aucun profil en base → créer une ligne minimale (colonnes de base uniquement)
        // NOTE: les colonnes avancées (nom_agence, type_agence…) n'existent qu'APRÈS
        // avoir exécuté la migration FIX_SETTINGS_DEFINITIF.sql dans Supabase.
        console.log('Profil introuvable, création ligne de base…');
        const { error: insertErr } = await supabase.from('profiles').upsert([{
          user_id: user.id,
          email: user.email,
        }], { onConflict: 'user_id' });
        if (insertErr) console.error('Création profil échouée:', insertErr.message, '— Avez-vous exécuté FIX_SETTINGS_DEFINITIF.sql dans Supabase ?');
        // formData reste aux valeurs par défaut — l'utilisateur peut remplir
        setFormData(prev => ({ ...prev, email: user.email }));
      }
    }
    setLoading(false);
  };

  /* ── Handlers ───────────────────── */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    if (name === 'pays') {
      const MAP = {
        // Europe
        'France':           { devise: 'EUR', symbole: '€',    format: '1 000 €' },
        'Belgique':         { devise: 'EUR', symbole: '€',    format: '1 000 €' },
        'Suisse':           { devise: 'CHF', symbole: 'CHF',  format: '1 000 CHF' },
        'Luxembourg':       { devise: 'EUR', symbole: '€',    format: '1 000 €' },
        'Allemagne':        { devise: 'EUR', symbole: '€',    format: '1.000 €' },
        'Espagne':          { devise: 'EUR', symbole: '€',    format: '1.000 €' },
        'Italie':           { devise: 'EUR', symbole: '€',    format: '1.000 €' },
        'Portugal':         { devise: 'EUR', symbole: '€',    format: '1.000 €' },
        'Pays-Bas':         { devise: 'EUR', symbole: '€',    format: '1.000 €' },
        'Royaume-Uni':      { devise: 'GBP', symbole: '£',    format: '£1,000' },
        // Amérique du Nord
        'États-Unis':       { devise: 'USD', symbole: '$',    format: '$1,000' },
        'Canada':           { devise: 'CAD', symbole: 'CA$',  format: 'CA$1,000' },
        'Mexique':          { devise: 'MXN', symbole: 'MX$',  format: 'MX$1,000' },
        // Amérique Latine
        'Brésil':           { devise: 'BRL', symbole: 'R$',   format: 'R$ 1.000' },
        'Argentine':        { devise: 'ARS', symbole: 'AR$',  format: 'AR$1.000' },
        'Colombie':         { devise: 'COP', symbole: 'COP',  format: 'COP 1.000' },
        // Afrique du Nord & Moyen-Orient
        'Maroc':            { devise: 'MAD', symbole: 'DH',   format: '1 000 DH' },
        'Algérie':          { devise: 'DZD', symbole: 'DA',   format: '1 000 DA' },
        'Tunisie':          { devise: 'TND', symbole: 'DT',   format: '1 000 DT' },
        'Égypte':           { devise: 'EGP', symbole: 'LE',   format: '1 000 LE' },
        'Émirats arabes':   { devise: 'AED', symbole: 'AED',  format: '1,000 AED' },
        'Arabie saoudite':  { devise: 'SAR', symbole: 'SAR',  format: '1,000 SAR' },
        // Afrique subsaharienne
        'Bénin':            { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Sénégal':          { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        "Côte d'Ivoire":    { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Cameroun':         { devise: 'XAF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Mali':             { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Burkina Faso':     { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Togo':             { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Niger':            { devise: 'XOF', symbole: 'FCFA', format: '1 000 FCFA' },
        'Guinée':           { devise: 'GNF', symbole: 'FG',   format: '1 000 000 FG' },
        'Congo (RDC)':      { devise: 'CDF', symbole: 'FC',   format: '1 000 FC' },
        'Madagascar':       { devise: 'MGA', symbole: 'Ar',   format: '1 000 Ar' },
        // Asie-Pacifique
        'Inde':             { devise: 'INR', symbole: '₹',    format: '₹1,00,000' },
        'Chine':            { devise: 'CNY', symbole: '¥',    format: '¥1,000' },
        'Japon':            { devise: 'JPY', symbole: '¥',    format: '¥1,000' },
        'Australie':        { devise: 'AUD', symbole: 'AU$',  format: 'AU$1,000' },
      };
      const d = MAP[value] || MAP['France'];
      setFormData(prev => ({
        ...prev, [name]: value,
        devise: d.devise, symbole_devise: d.symbole, format_devise: d.format,
      }));
    } else if (name === 'type_agence') {
      // Auto-adapter form_settings selon le type
      setFormData(prev => ({
        ...prev,
        [name]: val,
        crm_settings: { ...prev.crm_settings, pipeline_utilise: val },
        form_settings: val === 'immobilier'
          ? { ...prev.form_settings, showType: true, showLocalisation: true, showRole: true, showObjectifMarketing: false, showTypeService: false }
          : { ...prev.form_settings, showType: false, showLocalisation: false, showRole: false, showObjectifMarketing: true, showTypeService: true },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: val }));
    }
  };

  const handleNestedChange = (parent, key, value) => {
    setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [key]: value } }));
  };

  const handleToggle = (key) => {
    setFormData(prev => ({
      ...prev,
      form_settings: { ...prev.form_settings, [key]: !prev.form_settings[key] },
    }));
  };

  const handleSave = async () => {
    if (!userId) { showToast('Session expirée, reconnectez-vous.', 'error'); return; }
    setSaving(true);
    try {
      // upsert = crée la ligne si elle n'existe pas, la met à jour sinon
      const { error } = await supabase.from('profiles').upsert({
        user_id: userId,
        agency_id: userId,
        email: formData.email,
        nom_agence: formData.nom_agence,
        telephone: formData.telephone,
        adresse: formData.adresse,
        pays: formData.pays,
        devise: formData.devise,
        symbole_devise: formData.symbole_devise,
        format_devise: formData.format_devise,
        calendly_link: formData.calendly_link,
        logo_url: formData.logo_url,
        signature_url: formData.signature_url,
        ville_agence: formData.ville_agence,
        couleur_primaire: formData.couleur_primaire,
        couleur_secondaire: formData.couleur_secondaire,
        type_agence: formData.type_agence,
        nom_legal: formData.nom_legal,
        statut_juridique: formData.statut_juridique,
        numero_enregistrement: formData.numero_enregistrement,
        adresse_legale: formData.adresse_legale,
        mention_legale: formData.mention_legale,
        conditions_paiement: formData.conditions_paiement,
        carte_pro_t: formData.carte_pro_t,
        carte_pro_s: formData.carte_pro_s,
        activite_principale: formData.activite_principale,
        numero_tva: formData.numero_tva,
        facebook_pixel_id:    formData.facebook_pixel_id,
        google_ads_id:        formData.google_ads_id,
        google_ads_label:     formData.google_ads_label,
        notification_email:   formData.notification_email,
        notification_webhook: formData.notification_webhook,
        show_amount_in_words: formData.show_amount_in_words,
        form_settings: formData.form_settings,
        crm_settings: formData.crm_settings,
      }, { onConflict: 'user_id' });

      if (error) {
        console.error('Erreur sauvegarde:', error);
        // 409 = colonnes manquantes → migration SQL non exécutée
        if (error.code === '42703' || error.message?.includes('column') || error.code === '23505' || String(error.code) === '409') {
          showToast('⚠️ Migration Supabase requise — exécutez FIX_SETTINGS_DEFINITIF.sql dans SQL Editor', 'error');
        } else {
          showToast('Erreur : ' + error.message, 'error');
        }
        return;
      }
      showToast('Paramètres sauvegardés avec succès !');
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Stripe handlers ─────────────────── */
  const handleSubscribeWithEmail = async (plan, email, uid) => {
    setStripeLoading(true); setStripeError('');
    const r = await redirectToCheckout({ plan, userId: uid || userId, userEmail: email, agencyName: formData.nom_agence });
    setStripeLoading(false);
    if (!r.success) setStripeError(r.error || 'Erreur lors de la redirection vers le paiement.');
  };

  const handleSubscribe = async (plan) => {
    if (!userEmail) { setStripeError('Email introuvable. Reconnectez-vous.'); return; }
    setStripeLoading(true); setStripeError('');
    const r = await redirectToCheckout({ plan, userId, userEmail, agencyName: formData.nom_agence });
    if (!r.success) setStripeError(r.error || 'Erreur Stripe.');
    setStripeLoading(false);
  };

  const handleOpenPortal = async () => {
    if (!userEmail) { setStripeError("Email introuvable."); return; }
    setStripeLoading(true); setStripeError('');
    const r = await openBillingPortal(userEmail);
    if (!r.success) setStripeError(r.error || "Erreur portail Stripe.");
    setStripeLoading(false);
  };

  // URL du formulaire public
  const formUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/estimation/${userId || ''}`
    : '';

  const isImmo = formData.type_agence === 'immobilier';

  /* ── Permissions par rôle ──────────────────────────────────────────────────
   *  owner : accès complet à tout
   *  admin : Formulaire IA + CRM (pixels, statuts) — pas d'infos agence/légal
   *  agent : aucun accès aux Paramètres → redirigé vers /dashboard
   * ──────────────────────────────────────────────────────────────────────── */
  const TABS_BY_ROLE = {
    owner: ['general', 'visuel', 'form', 'legal', 'crm', 'messagerie', 'equipe', 'facturation'],
    admin: ['form', 'crm', 'messagerie'],
    agent: [],
  };
  const allowedTabs = TABS_BY_ROLE[userRole] ?? TABS_BY_ROLE.owner;
  const isReadOnly  = false; // tous les onglets accessibles sont éditables

  /* ── Onglets ───────────────────── */
  const ALL_TABS = [
    { key: 'general',     icon: '🏢', label: t('settings.tabs.general') },
    { key: 'visuel',      icon: '🎨', label: t('settings.tabs.visuel') },
    { key: 'form',        icon: '🤖', label: t('settings.tabs.form') },
    { key: 'legal',       icon: '📋', label: t('settings.tabs.legal') },
    { key: 'crm',         icon: '⚙️', label: t('settings.tabs.crm') },
    { key: 'messagerie',  icon: '💬', label: 'Messagerie' },
    { key: 'equipe',      icon: '👥', label: t('settings.tabs.equipe') },
    { key: 'facturation', icon: '💳', label: t('settings.tabs.facturation') },
  ];
  const TABS = ALL_TABS.filter(tab => allowedTabs.includes(tab.key));

  /* ── Loading ───────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-screen text-slate-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-sm">Chargement des paramètres…</p>
      </div>
    </div>
  );

  /* ── Accès refusé — agent ───────── */
  if (userRole === 'agent') return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Accès restreint</h2>
        <p className="text-slate-500 text-sm mb-6">
          Les paramètres sont réservés au propriétaire et aux administrateurs de l'agence.
          En tant qu'agent, vous gérez les leads, le closing et l'envoi de documents.
        </p>
        <a href="/dashboard"
          className="block w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors">
          Retour au tableau de bord
        </a>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl shrink-0">⚙️</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">Paramètres</h1>
              <p className="text-xs text-slate-400 truncate flex items-center gap-2">
                {formData.nom_agence || 'Agence'} · {isImmo ? '🏠 Immobilier' : '📱 SMMA'}
                {userRole === 'admin' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">Admin</span>
                )}
              </p>
            </div>
          </div>

          {/* Save button — visible uniquement pour les onglets éditables */}
          {activeTab !== 'facturation' && activeTab !== 'equipe' && allowedTabs.includes(activeTab) && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700
                         text-white rounded-lg text-sm font-semibold shadow-sm
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <><span className="animate-spin">⏳</span> Sauvegarde…</>
              ) : (
                <><span>💾</span> Enregistrer</>
              )}
            </button>
          )}
        </div>
      </header>

      {/* ── ONGLETS ─────────────────── */}
      <div className="flex-none flex border-b border-slate-200 bg-white px-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold
              border-b-2 whitespace-nowrap transition-all ${
              activeTab === t.key
                ? t.key === 'facturation'
                  ? 'border-green-600 text-green-600'
                  : 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── CONTENU ───────────────────── */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">

          {/* ═══ ONGLET AGENCE ════════════════════════ */}
          {activeTab === 'general' && (
            <div className="space-y-6">

              {/* ── Langue de l'interface ── */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <LanguageSelector variant="settings" />
              </section>

              {/* Sélecteur type agence — cartes visuelles */}
              <section className={`bg-white rounded-xl border shadow-sm p-5 ${!formData.type_agence ? 'border-orange-300 ring-2 ring-orange-100' : 'border-slate-100'}`}>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Type d'agence
                </h2>
                {!formData.type_agence && (
                  <p className="text-xs text-orange-600 font-medium mb-3">⚠️ Sélectionnez votre type d'agence pour accéder aux bons modèles de documents</p>
                )}
                <div className={`grid grid-cols-2 gap-3 ${formData.type_agence ? 'mt-4' : ''}`}>
                  {[
                    { value: 'immobilier', icon: '🏠', title: 'Immobilier', desc: 'Mandats, devis, suivi acquéreurs/vendeurs', color: 'indigo' },
                    { value: 'smma',       icon: '📱', title: 'SMMA',       desc: 'Propositions commerciales, suivi clients marketing', color: 'purple' },
                  ].map(t => (
                    <button
                      key={t.value}
                      onClick={() => handleChange({ target: { name: 'type_agence', value: t.value } })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.type_agence === t.value
                          ? t.color === 'indigo'
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-purple-400 bg-purple-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{t.icon}</div>
                      <p className={`text-sm font-bold ${formData.type_agence === t.value ? (t.color === 'indigo' ? 'text-indigo-700' : 'text-purple-700') : 'text-slate-700'}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                      {formData.type_agence === t.value && (
                        <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          t.color === 'indigo' ? 'bg-indigo-600 text-white' : 'bg-purple-600 text-white'
                        }`}>✓ Sélectionné</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Ce choix adapte automatiquement le formulaire IA, les documents générés et les champs du pipeline.
                </p>
              </section>

              {/* Informations agence */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                  Informations de l'agence
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nom de l'agence" required>
                    <Input name="nom_agence" value={formData.nom_agence} onChange={handleChange} placeholder="Ex: Agence Dupont Immobilier" />
                  </Field>
                  <Field label="Email principal">
                    <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="contact@agence.com" />
                  </Field>
                  <Field label="Téléphone">
                    <Input name="telephone" value={formData.telephone} onChange={handleChange} placeholder="+33 6 00 00 00 00" />
                  </Field>
                  <Field label="Pays" hint="Détermine automatiquement la devise" required>
                    <Select name="pays" value={formData.pays} onChange={handleChange}>
                      <optgroup label="── Europe ──">
                        <option value="France">🇫🇷 France</option>
                        <option value="Belgique">🇧🇪 Belgique</option>
                        <option value="Suisse">🇨🇭 Suisse</option>
                        <option value="Luxembourg">🇱🇺 Luxembourg</option>
                        <option value="Allemagne">🇩🇪 Allemagne</option>
                        <option value="Espagne">🇪🇸 Espagne</option>
                        <option value="Italie">🇮🇹 Italie</option>
                        <option value="Portugal">🇵🇹 Portugal</option>
                        <option value="Pays-Bas">🇳🇱 Pays-Bas</option>
                        <option value="Royaume-Uni">🇬🇧 Royaume-Uni</option>
                      </optgroup>
                      <optgroup label="── Amérique du Nord ──">
                        <option value="États-Unis">🇺🇸 États-Unis</option>
                        <option value="Canada">🇨🇦 Canada</option>
                        <option value="Mexique">🇲🇽 Mexique</option>
                      </optgroup>
                      <optgroup label="── Amérique Latine ──">
                        <option value="Brésil">🇧🇷 Brésil</option>
                        <option value="Argentine">🇦🇷 Argentine</option>
                        <option value="Colombie">🇨🇴 Colombie</option>
                      </optgroup>
                      <optgroup label="── Afrique du Nord & Moyen-Orient ──">
                        <option value="Maroc">🇲🇦 Maroc</option>
                        <option value="Algérie">🇩🇿 Algérie</option>
                        <option value="Tunisie">🇹🇳 Tunisie</option>
                        <option value="Égypte">🇪🇬 Égypte</option>
                        <option value="Émirats arabes">🇦🇪 Émirats arabes</option>
                        <option value="Arabie saoudite">🇸🇦 Arabie saoudite</option>
                      </optgroup>
                      <optgroup label="── Afrique subsaharienne ──">
                        <option value="Bénin">🇧🇯 Bénin</option>
                        <option value="Sénégal">🇸🇳 Sénégal</option>
                        <option value="Côte d'Ivoire">🇨🇮 Côte d'Ivoire</option>
                        <option value="Cameroun">🇨🇲 Cameroun</option>
                        <option value="Mali">🇲🇱 Mali</option>
                        <option value="Burkina Faso">🇧🇫 Burkina Faso</option>
                        <option value="Togo">🇹🇬 Togo</option>
                        <option value="Niger">🇳🇪 Niger</option>
                        <option value="Guinée">🇬🇳 Guinée</option>
                        <option value="Congo (RDC)">🇨🇩 Congo (RDC)</option>
                        <option value="Madagascar">🇲🇬 Madagascar</option>
                      </optgroup>
                      <optgroup label="── Asie-Pacifique ──">
                        <option value="Inde">🇮🇳 Inde</option>
                        <option value="Chine">🇨🇳 Chine</option>
                        <option value="Japon">🇯🇵 Japon</option>
                        <option value="Australie">🇦🇺 Australie</option>
                      </optgroup>
                      <option value="Autre">🌍 Autre</option>
                    </Select>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Adresse complète">
                    <Input name="adresse" value={formData.adresse} onChange={handleChange} placeholder="12 rue des Fleurs, 75001 Paris" />
                  </Field>
                </div>

                {/* Devise (lecture seule) */}
                <div className="mt-4 flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-lg">💱</span>
                  <div>
                    <p className="text-xs font-bold text-slate-600">Devise automatique</p>
                    <p className="text-sm text-slate-700">{formData.devise} ({formData.symbole_devise}) · Format : {formData.format_devise}</p>
                  </div>
                </div>
              </section>

              {/* Calendly */}
              <section className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">📅 Lien prise de RDV</h2>
                <p className="text-xs text-slate-400 mb-4">Utilisé pour le bouton "Proposer un RDV" sur la fiche lead.</p>
                <Input
                  name="calendly_link"
                  value={formData.calendly_link}
                  onChange={handleChange}
                  placeholder="https://calendly.com/votre-agence"
                />
                {formData.calendly_link && (
                  <a href={formData.calendly_link} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline">
                    Tester le lien ↗
                  </a>
                )}
              </section>

              {!formData.nom_agence && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-lg shrink-0">⚠️</span>
                  <p className="text-sm text-amber-800">Complétez le nom de l'agence pour activer la génération de documents.</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ ONGLET APPARENCE ════════════════════════ */}
          {activeTab === 'visuel' && (
            <div className="space-y-6">

              {/* Logo */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">🖼️ Logo de l'agence</h2>
                <Field label="URL du logo" hint="Lien direct vers votre logo (PNG, SVG recommandé). Utilisé dans les documents générés.">
                  <Input name="logo_url" value={formData.logo_url} onChange={handleChange} placeholder="https://..." />
                </Field>
                {formData.logo_url && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 inline-block">
                    <img src={formData.logo_url} alt="Logo" className="h-14 object-contain"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.remove(); }} />
                  </div>
                )}
              </section>

              {/* Documents légaux */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">📄 Documents légaux</h2>

                <Field label="Ville (pour les documents)" hint="Utilisée dans la mention « Fait à ___, le … » des contrats et devis.">
                  <Input name="ville_agence" value={formData.ville_agence} onChange={handleChange} placeholder="ex : Paris, Lyon, Casablanca…" />
                </Field>

                <div className="mt-5">
                  <Field label="URL image de signature agence" hint="Lien direct vers l'image de votre signature (PNG transparent recommandé). Affichée dans le bloc signature des documents générés.">
                    <Input name="signature_url" value={formData.signature_url} onChange={handleChange} placeholder="https://..." />
                  </Field>
                  {formData.signature_url && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 inline-block">
                      <p className="text-xs text-slate-400 mb-2">Aperçu signature :</p>
                      <img
                        src={formData.signature_url}
                        alt="Signature agence"
                        className="h-16 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Couleurs */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">🎨 Couleurs de la marque</h2>
                <p className="text-xs text-slate-400 mb-5">Ces couleurs sont utilisées dans le formulaire public et les documents générés (Phase 4 — White-label).</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Couleur primaire */}
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-3">Couleur primaire</p>
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="color"
                        name="couleur_primaire"
                        value={formData.couleur_primaire}
                        onChange={handleChange}
                        className="h-10 w-14 p-0.5 border border-slate-200 rounded-lg cursor-pointer"
                      />
                      <Input
                        value={formData.couleur_primaire}
                        onChange={(e) => setFormData(prev => ({ ...prev, couleur_primaire: e.target.value }))}
                        className="font-mono text-xs max-w-[100px]"
                        placeholder="#2563eb"
                        maxLength={7}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c}
                          onClick={() => setFormData(prev => ({ ...prev, couleur_primaire: c }))}
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            formData.couleur_primaire === c ? 'border-slate-800 scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Couleur secondaire */}
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-3">Couleur secondaire</p>
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="color"
                        name="couleur_secondaire"
                        value={formData.couleur_secondaire}
                        onChange={handleChange}
                        className="h-10 w-14 p-0.5 border border-slate-200 rounded-lg cursor-pointer"
                      />
                      <Input
                        value={formData.couleur_secondaire}
                        onChange={(e) => setFormData(prev => ({ ...prev, couleur_secondaire: e.target.value }))}
                        className="font-mono text-xs max-w-[100px]"
                        placeholder="#7c3aed"
                        maxLength={7}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c}
                          onClick={() => setFormData(prev => ({ ...prev, couleur_secondaire: c }))}
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            formData.couleur_secondaire === c ? 'border-slate-800 scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview carte agence */}
                <div className="mt-6">
                  <p className="text-xs font-bold text-slate-600 mb-3">Aperçu — En-tête formulaire public</p>
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="h-2" style={{ background: `linear-gradient(to right, ${formData.couleur_primaire}, ${formData.couleur_secondaire})` }} />
                    <div className="p-4 bg-white flex items-center gap-3">
                      {formData.logo_url
                        ? <img src={formData.logo_url} alt="Logo" className="h-10 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                            style={{ background: formData.couleur_primaire }}>
                            {formData.nom_agence?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                        )
                      }
                      <div>
                        <p className="text-sm font-bold text-slate-800">{formData.nom_agence || 'Nom de votre agence'}</p>
                        <p className="text-xs" style={{ color: formData.couleur_primaire }}>
                          {isImmo ? '🏠 Agence immobilière' : '📱 Agence marketing'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ═══ ONGLET FORMULAIRE IA ═══════════════════ */}
          {activeTab === 'form' && (
            <div className="space-y-6">

              {/* Badge type agence actif */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                isImmo ? 'bg-indigo-50 border-indigo-200' : 'bg-purple-50 border-purple-200'
              }`}>
                <span className="text-2xl">{isImmo ? '🏠' : '📱'}</span>
                <div>
                  <p className={`text-sm font-bold ${isImmo ? 'text-indigo-800' : 'text-purple-800'}`}>
                    Mode {isImmo ? 'Immobilier' : 'SMMA'} actif
                  </p>
                  <p className={`text-xs ${isImmo ? 'text-indigo-600' : 'text-purple-600'}`}>
                    {isImmo
                      ? 'Les champs spécifiques à l\'immobilier sont affichés.'
                      : 'Les champs marketing sont activés, les champs immobiliers masqués.'}
                  </p>
                </div>
              </div>

              {/* Champs communs */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                  Champs communs — toujours visibles
                </h2>
                <div className="space-y-3">
                  {[
                    { key: null, label: '👤 Nom & Prénom', desc: 'Obligatoire — non désactivable', locked: true },
                    { key: null, label: '📧 Email',         desc: 'Obligatoire — non désactivable', locked: true },
                    { key: null, label: '📞 Téléphone',     desc: 'Obligatoire — non désactivable', locked: true },
                    { key: 'showBudget', label: '💰 Budget', desc: 'Essentiel pour qualifier le lead' },
                    { key: 'showDelai',  label: '⏱️ Délai / Urgence', desc: 'Quand souhaitez-vous concrétiser ?' },
                  ].map(row => (
                    <div key={row.label} className={`flex items-center justify-between p-3 rounded-lg border ${
                      row.locked ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'
                    }`}>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{row.label}</p>
                        <p className="text-xs text-slate-400">{row.desc}</p>
                      </div>
                      {row.locked
                        ? <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Fixe</span>
                        : <Toggle checked={!!formData.form_settings?.[row.key]} onChange={() => handleToggle(row.key)} />
                      }
                    </div>
                  ))}
                </div>
              </section>

              {/* Champs IMMO */}
              {isImmo && (
                <section className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-indigo-700 uppercase tracking-wide mb-4">
                    🏠 Champs Immobilier
                  </h2>
                  <div className="space-y-3">
                    {[
                      { key: 'showRole',         label: '🔑 Rôle',             desc: 'Propriétaire vendeur ou client acquéreur' },
                      { key: 'showType',         label: '🏠 Type de bien',      desc: 'Appartement, maison, terrain, local…' },
                      { key: 'showLocalisation', label: '📍 Localisation',      desc: 'Zone géographique souhaitée' },
                    ].map(row => (
                      <div key={row.key} className="flex items-center justify-between p-3 bg-white border border-indigo-100 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{row.label}</p>
                          <p className="text-xs text-slate-400">{row.desc}</p>
                        </div>
                        <Toggle checked={!!formData.form_settings?.[row.key]} onChange={() => handleToggle(row.key)} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Champs SMMA */}
              {!isImmo && (
                <section className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-4">
                    📱 Champs SMMA
                  </h2>
                  <div className="space-y-3">
                    {[
                      { key: 'showObjectifMarketing', label: '🎯 Objectif marketing', desc: 'Notoriété, leads, ventes, engagement…' },
                      { key: 'showTypeService',       label: '🛠️ Type de service',    desc: 'Social Ads, SEO, contenu, email…' },
                    ].map(row => (
                      <div key={row.key} className="flex items-center justify-between p-3 bg-white border border-purple-100 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{row.label}</p>
                          <p className="text-xs text-slate-400">{row.desc}</p>
                        </div>
                        <Toggle checked={!!formData.form_settings?.[row.key]} onChange={() => handleToggle(row.key)} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Tracking & Pixels ── */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">
                  📡 Tracking & Pixels publicitaires
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Ajoutez vos identifiants de suivi pour mesurer le retour sur investissement de vos campagnes.
                  Ces codes sont injectés dans votre formulaire public.
                </p>
                <div className="space-y-4">

                  {/* Facebook Pixel */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🔵</span>
                      <p className="text-sm font-bold text-blue-800">Facebook / Meta Pixel</p>
                      {formData.facebook_pixel_id && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">✓ Actif</span>
                      )}
                    </div>
                    <input
                      type="text"
                      name="facebook_pixel_id"
                      value={formData.facebook_pixel_id}
                      onChange={handleChange}
                      placeholder="Ex : 1234567890123456"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                    />
                    <p className="text-xs text-blue-500 mt-1.5">
                      Trouvez votre Pixel ID dans Meta Business Suite → Gestionnaire d'événements.
                    </p>
                  </div>

                  {/* Google Ads */}
                  <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🔍</span>
                      <p className="text-sm font-bold text-yellow-800">Google Ads (Conversion Tracking)</p>
                      {formData.google_ads_id && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-yellow-500 text-white rounded-full">✓ Actif</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Conversion ID</label>
                        <input
                          type="text"
                          name="google_ads_id"
                          value={formData.google_ads_id}
                          onChange={handleChange}
                          placeholder="Ex : AW-1234567890"
                          className="w-full px-3 py-2 text-sm border border-yellow-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Conversion Label</label>
                        <input
                          type="text"
                          name="google_ads_label"
                          value={formData.google_ads_label}
                          onChange={handleChange}
                          placeholder="Ex : AbCdEfGhIj"
                          className="w-full px-3 py-2 text-sm border border-yellow-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-yellow-600 mt-1.5">
                      Trouvez ces valeurs dans Google Ads → Outils → Conversions → Balise Google.
                    </p>
                  </div>

                  {/* Statut tracking */}
                  {(formData.facebook_pixel_id || formData.google_ads_id) && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                      <span>✅</span>
                      <p className="text-xs text-green-700 font-medium">
                        {[
                          formData.facebook_pixel_id && 'Facebook Pixel',
                          formData.google_ads_id && 'Google Ads'
                        ].filter(Boolean).join(' + ')} configuré{(formData.facebook_pixel_id && formData.google_ads_id) ? 's' : ''} — visible sur la page Statistiques.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Alertes & Notifications ── */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">
                  🔔 Alertes leads chauds
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Recevez une alerte instantanée quand un lead avec score ≥ 70 arrive.
                  Les notifications browser sont activées automatiquement. Configurez
                  aussi un webhook pour recevoir les alertes sur Slack, email ou tout
                  autre outil (Make, Zapier, n8n, etc.).
                </p>
                <div className="space-y-4">
                  <Field label="Email de notification" hint="Email qui recevra les alertes si vous connectez un service email à votre webhook.">
                    <Input
                      type="email"
                      name="notification_email"
                      value={formData.notification_email}
                      onChange={handleChange}
                      placeholder="contact@agence.com"
                    />
                  </Field>
                  <Field
                    label="URL Webhook"
                    hint="URL POST appelée à chaque lead chaud (Slack Incoming Webhook, Make/n8n endpoint, etc.)"
                  >
                    <Input
                      type="url"
                      name="notification_webhook"
                      value={formData.notification_webhook}
                      onChange={handleChange}
                      placeholder="https://hooks.slack.com/services/… ou https://hook.eu1.make.com/…"
                    />
                  </Field>
                  {formData.notification_webhook && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                      <span>✅</span>
                      <p className="text-xs text-green-700 font-medium">
                        Webhook configuré — les leads avec score ≥ 70 déclencheront une alerte en temps réel.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* URL formulaire public */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                  🔗 URL de votre formulaire public
                </h2>
                <div className="flex items-center gap-2">
                  <Input value={formUrl} readOnly className="bg-slate-50 text-xs font-mono cursor-text" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(formUrl); showToast('URL copiée !'); }}
                    className="shrink-0 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    📋 Copier
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Partagez cette URL sur vos réseaux sociaux ou votre site pour recevoir des leads qualifiés automatiquement.
                </p>
              </section>
            </div>
          )}

          {/* ═══ ONGLET LÉGAL ═══════════════════════════ */}
          {activeTab === 'legal' && (
            <div className="space-y-6">

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-lg shrink-0">📋</span>
                <div>
                  <p className="text-sm font-bold text-blue-800">Identité légale pour documents</p>
                  <p className="text-xs text-blue-600 mt-0.5">Ces informations apparaissent dans vos devis, factures et contrats générés.</p>
                </div>
              </div>

              {/* Champs légaux communs */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Informations communes</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nom légal de l'entreprise" required>
                    <Input name="nom_legal" value={formData.nom_legal} onChange={handleChange} placeholder="SARL DUPONT IMMOBILIER" />
                  </Field>
                  <Field label="Statut juridique">
                    <Select name="statut_juridique" value={formData.statut_juridique} onChange={handleChange}>
                      <option value="">Sélectionner…</option>
                      <option value="auto-entrepreneur">Auto-entrepreneur / Micro</option>
                      <option value="ei">Entreprise Individuelle (EI)</option>
                      <option value="eurl">EURL</option>
                      <option value="sarl">SARL</option>
                      <option value="sas">SAS</option>
                      <option value="sasu">SASU</option>
                      <option value="scs">SCS</option>
                      <option value="snc">SNC</option>
                    </Select>
                  </Field>
                  <Field label="Numéro d'enregistrement" hint="SIRET, RCCM, etc.">
                    <Input name="numero_enregistrement" value={formData.numero_enregistrement} onChange={handleChange} placeholder="123 456 789 00012" />
                  </Field>
                  <Field label="Numéro de TVA intracommunautaire">
                    <Input name="numero_tva" value={formData.numero_tva} onChange={handleChange} placeholder="FR 12 345678901" />
                  </Field>
                  <Field label="Adresse légale" hint="Si différente de l'adresse principale" className="sm:col-span-2">
                    <Input name="adresse_legale" value={formData.adresse_legale} onChange={handleChange} placeholder="Si différente de l'adresse principale" />
                  </Field>
                </div>
              </section>

              {/* Champs légaux IMMO spécifiques */}
              {isImmo && (
                <section className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-indigo-700 uppercase tracking-wide mb-4">
                    🏠 Réglementation immobilière
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Carte professionnelle T (Transaction)" hint="Délivrée par la CCI — obligatoire pour vendre">
                      <Input name="carte_pro_t" value={formData.carte_pro_t} onChange={handleChange} placeholder="CPI 12345678" />
                    </Field>
                    <Field label="Carte professionnelle S (Syndic/Gestion)" hint="Obligatoire pour la gestion locative">
                      <Input name="carte_pro_s" value={formData.carte_pro_s} onChange={handleChange} placeholder="CPI 87654321" />
                    </Field>
                  </div>
                </section>
              )}

              {/* Champs légaux SMMA spécifiques */}
              {!isImmo && (
                <section className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-4">
                    📱 Activité SMMA
                  </h2>
                  <Field label="Activité principale déclarée" hint="Utilisé dans les mentions légales des devis">
                    <Input name="activite_principale" value={formData.activite_principale} onChange={handleChange} placeholder="Conseil en communication digitale" />
                  </Field>
                </section>
              )}

              {/* Mentions légales + conditions */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Pied de page documents</h2>
                <div className="space-y-4">
                  <Field label="Mention légale" hint='Ex: "TVA non applicable, art. 293 B du CGI"'>
                    <Textarea name="mention_legale" value={formData.mention_legale} onChange={handleChange} rows={2} placeholder="Mention légale à afficher en pied de document…" />
                  </Field>
                  <Field label="Conditions de paiement" hint='Ex: "Paiement à 30 jours, pénalités de retard 3%/mois"'>
                    <Textarea name="conditions_paiement" value={formData.conditions_paiement} onChange={handleChange} rows={3} placeholder="Conditions de paiement…" />
                  </Field>
                </div>
              </section>

              {/* Option premium montant en lettres */}
              <section className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <h3 className="text-sm font-bold text-purple-800">💎 Montant en lettres sur les documents</h3>
                    <p className="text-xs text-purple-600 mt-1">
                      Affiche "Arrêté la présente facture à la somme de…" — option de différenciation professionnelle (vs Bitrix/Pipedrive).
                      Compatible EUR, FCFA, CAD, MAD.
                    </p>
                  </div>
                  <Toggle
                    checked={formData.show_amount_in_words}
                    onChange={(v) => setFormData(prev => ({ ...prev, show_amount_in_words: v }))}
                  />
                </div>
              </section>

              {(!formData.nom_legal || !formData.statut_juridique) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-lg shrink-0">⚠️</span>
                  <p className="text-sm text-amber-800">Complétez le nom légal et le statut juridique pour générer des documents valides.</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ ONGLET CRM ════════════════════════════ */}
          {activeTab === 'crm' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-lg shrink-0">⚙️</span>
                <div>
                  <p className="text-sm font-bold text-green-800">Paramètres CRM</p>
                  <p className="text-xs text-green-600 mt-0.5">Configurez les règles de priorité, la source principale et le pipeline de votre agence.</p>
                </div>
              </div>

              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="space-y-4">
                  <Field label="Priorité par défaut d'un nouveau lead" hint="Utilisé pour l'assignation automatique">
                    <Select
                      value={formData.crm_settings?.priorite_defaut}
                      onChange={(e) => handleNestedChange('crm_settings', 'priorite_defaut', e.target.value)}
                    >
                      <option value="faible">🔴 Faible</option>
                      <option value="moyenne">🟡 Moyenne</option>
                      <option value="haute">🟢 Haute</option>
                    </Select>
                  </Field>
                  <Field label="Source principale préférée" hint="Influence les algorithmes de scoring IA">
                    <Select
                      value={formData.crm_settings?.source_principale}
                      onChange={(e) => handleNestedChange('crm_settings', 'source_principale', e.target.value)}
                    >
                      <option value="formulaire_ia">🤖 Formulaire IA</option>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="import_manuel">📥 Import manuel</option>
                      <option value="meta_ads">📘 Meta Ads</option>
                      <option value="google_ads">🔍 Google Ads</option>
                    </Select>
                  </Field>
                  <Field label="Pipeline utilisé" hint="Doit correspondre à votre type d'agence">
                    <Select
                      value={formData.crm_settings?.pipeline_utilise}
                      onChange={(e) => handleNestedChange('crm_settings', 'pipeline_utilise', e.target.value)}
                    >
                      <option value="immobilier">🏠 Immobilier</option>
                      <option value="smma">📱 SMMA</option>
                    </Select>
                  </Field>
                </div>
              </section>

            </div>
          )}

          {/* ═══ ONGLET MESSAGERIE WHATSAPP ══════════ */}
          {activeTab === 'messagerie' && (
            <div className="space-y-6 max-w-2xl">

              {/* Bandeau intro */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl shrink-0">💬</span>
                <div>
                  <p className="text-sm font-bold text-green-800">Messagerie WhatsApp (Twilio)</p>
                  <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                    Connectez votre compte Twilio pour envoyer et recevoir des messages WhatsApp directement depuis le CRM.
                    Ces identifiants sont chiffrés et stockés en sécurité.
                  </p>
                </div>
              </div>

              {/* Formulaire Twilio */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Identifiants Twilio
                </h2>

                {/* Account SID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Account SID
                    <span className="ml-1 text-slate-400 font-normal">(commence par ACxx…)</span>
                  </label>
                  <input
                    type="text"
                    value={twilioSettings.account_sid}
                    onChange={e => setTwilioSettings(p => ({ ...p, account_sid: e.target.value }))}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-green-400 font-mono"
                  />
                </div>

                {/* Auth Token */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Auth Token
                  </label>
                  <div className="relative">
                    <input
                      type={twilioShowToken ? 'text' : 'password'}
                      value={twilioSettings.auth_token}
                      onChange={e => setTwilioSettings(p => ({ ...p, auth_token: e.target.value }))}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-green-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setTwilioShowToken(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title={twilioShowToken ? 'Masquer' : 'Afficher'}
                    >
                      {twilioShowToken ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Numéro WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Numéro WhatsApp expéditeur
                    <span className="ml-1 text-slate-400 font-normal">(format : whatsapp:+14155238886)</span>
                  </label>
                  <input
                    type="text"
                    value={twilioSettings.whatsapp_number}
                    onChange={e => setTwilioSettings(p => ({ ...p, whatsapp_number: e.target.value }))}
                    placeholder="whatsapp:+14155238886"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-green-400 font-mono"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Numéro Twilio Sandbox ou votre numéro WhatsApp Business approuvé.
                  </p>
                </div>

                {/* Bouton sauvegarder */}
                <button
                  onClick={saveTwilioSettings}
                  disabled={twilioSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700
                             text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {twilioSaving ? (
                    <><span className="animate-spin">⏳</span> Sauvegarde…</>
                  ) : (
                    <>💾 Sauvegarder les identifiants</>
                  )}
                </button>
              </section>

              {/* Guide Twilio */}
              <section className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  📖 Comment configurer Twilio ?
                </h3>
                <ol className="space-y-2 text-xs text-slate-600">
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                    <span>Créez un compte sur <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="text-green-600 underline font-medium">twilio.com</a> et activez le canal WhatsApp</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                    <span>Dans la console Twilio → <strong>Account Info</strong>, copiez votre <strong>Account SID</strong> et <strong>Auth Token</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                    <span>Activez le <strong>Sandbox WhatsApp</strong> ou obtenez un numéro approuvé, et copiez-le au format <code className="bg-slate-200 px-1 rounded">whatsapp:+1xxx</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold shrink-0 text-[10px]">4</span>
                    <span>Configurez l'URL de webhook entrant dans Twilio : <code className="bg-slate-200 px-1 rounded">https://www.leadqualif.com/api/webhooks/whatsapp</code></span>
                  </li>
                </ol>
              </section>

              {/* Info variables Vercel (si déjà configuré globalement) */}
              <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>💡 Priorité :</strong> Les identifiants saisis ici sont utilisés en priorité.
                  Si vide, le système utilise les variables d'environnement Vercel globales
                  (<code className="bg-blue-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="bg-blue-100 px-1 rounded">TWILIO_AUTH_TOKEN</code>, <code className="bg-blue-100 px-1 rounded">TWILIO_WHATSAPP_NUMBER</code>).
                </p>
              </section>

            </div>
          )}

          {/* ═══ ONGLET ÉQUIPE ════════════════════════ */}
          {activeTab === 'equipe' && (
            <TeamSettings />
          )}

          {/* ═══ ONGLET FACTURATION ═════════════════════ */}
          {activeTab === 'facturation' && (
            <BillingTab
              subscriptionInfo={subscriptionInfo}
              stripeLoading={stripeLoading}
              stripeError={stripeError}
              onSubscribe={handleSubscribe}
              onPortal={handleOpenPortal}
            />
          )}

        </div>
      </main>
    </div>
  );
}
