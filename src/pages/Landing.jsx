import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Shield, FileText, ArrowRight, CheckCircle, Star, Zap, Lock,
  Users, BarChart3, TrendingUp, Sparkles, Clock, Euro, Target, ChevronDown,
  Building2, MessageSquare, X, Check, ChevronRight
} from 'lucide-react'

// ─── Données ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    name: 'Solo',
    badge: null,
    price: 49,
    annualPrice: 39,
    desc: 'Pour démarrer et qualifier vos premiers leads',
    cta: 'Essayer gratuitement',
    ctaStyle: 'border',
    features: [
      '1 utilisateur',
      '100 leads / mois',
      'Scoring IA basique (0-10)',
      'Formulaire de qualification public',
      'Génération factures & devis',
      'CRM pipeline kanban',
      'Support email',
    ],
    missing: ['Stats & Analytics', 'Recommandations IA avancées', 'Gestion équipe', 'Rapports & Contrats'],
  },
  {
    id: 'growth',
    name: 'Agence',
    badge: 'Le plus populaire',
    price: 149,
    annualPrice: 119,
    desc: 'La solution complète pour agences ambitieuses',
    cta: '7 jours gratuits → démarrer',
    ctaStyle: 'primary',
    features: [
      '5 utilisateurs inclus',
      'Leads illimités',
      'Scoring IA avancé + recommandations',
      'Formulaire de qualification public',
      'Documents illimités (factures, devis, contrats, rapports)',
      'Stats & Analytics (CA, ROI, pipeline)',
      'Pipeline commercial automatisé',
      'Invitations équipe par email',
      'Support prioritaire 24/7',
    ],
    missing: [],
  },
  {
    id: 'enterprise',
    name: 'Expert',
    badge: 'Sur mesure',
    price: 399,
    annualPrice: 319,
    desc: 'Multi-agences, volumes importants, sur-mesure',
    cta: 'Nous contacter',
    ctaStyle: 'dark',
    features: [
      'Utilisateurs illimités',
      'Leads illimités',
      'Tout le plan Agence',
      'Multi-agences sur un seul compte',
      'Onboarding dédié & formation équipe',
      'SLA garanti & support téléphonique',
      'Intégrations sur-mesure',
      'Facturation annuelle sur devis',
    ],
    missing: [],
  },
]

const FEATURES = [
  {
    icon: Brain,
    color: 'blue',
    title: 'Scoring IA 0-10',
    desc: 'Chaque lead est analysé par notre IA et reçoit un score de priorité. Fini les "touristes" qui font perdre du temps.',
  },
  {
    icon: Target,
    color: 'purple',
    title: 'Pipeline Commercial',
    desc: 'Suivez chaque prospect de la prise de contact à la signature. Vue kanban, statuts automatiques, alertes.',
  },
  {
    icon: FileText,
    color: 'green',
    title: 'Documents en 1 Clic',
    desc: 'Factures, devis, contrats et rapports générés automatiquement avec vos données. Conformes, professionnels.',
  },
  {
    icon: BarChart3,
    color: 'orange',
    title: 'Analytics & Statistiques',
    desc: 'CA généré, ROI par source, taux de conversion — un tableau de bord complet pour piloter votre activité.',
  },
  {
    icon: Users,
    color: 'pink',
    title: 'Gestion d\'équipe',
    desc: 'Invitez vos collaborateurs par email. Chacun a accès aux leads et documents de l\'agence.',
  },
  {
    icon: Sparkles,
    color: 'yellow',
    title: 'Recommandations IA',
    desc: 'Pour chaque lead, l\'IA vous suggère la prochaine action optimale : relancer, envoyer un devis, fermer le dossier.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Sophie M.',
    role: 'Mandataire Immobilier — Lyon',
    avatar: 'SM',
    color: 'bg-blue-500',
    text: 'Avant je passais 2h/jour à qualifier des leads par téléphone. Maintenant LeadQualif filtre pour moi. Je ne traite que les dossiers sérieux.',
    stars: 5,
  },
  {
    name: 'Karim B.',
    role: 'Directeur SMMA — Paris',
    avatar: 'KB',
    color: 'bg-purple-500',
    text: 'La génération de devis et factures m\'a sauvé la vie. Plus aucun document raté, le client reçoit tout par email automatiquement.',
    stars: 5,
  },
  {
    name: 'Aurélie D.',
    role: 'Agence Immobilière — Bordeaux',
    avatar: 'AD',
    color: 'bg-green-500',
    text: 'On est 3 dans l\'équipe. Tous nos leads sont centralisés, chacun voit ses dossiers. On a signé 40% de mandats en plus le premier mois.',
    stars: 5,
  },
]

const FAQ = [
  {
    q: 'Est-ce que je peux changer de plan à tout moment ?',
    a: 'Oui, à tout moment depuis vos paramètres. Le changement prend effet immédiatement. Pas d\'engagement, pas de frais de résiliation.',
  },
  {
    q: 'L\'essai gratuit nécessite-t-il une carte bancaire ?',
    a: 'Non. Les 7 jours d\'essai sur le plan Agence sont entièrement gratuits, sans carte bancaire requise. Vous saisissez vos informations de paiement seulement si vous choisissez de continuer.',
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    a: 'Vos données sont hébergées en Europe (UE), chiffrées en transit et au repos. Nous sommes conformes RGPD. Vous restez propriétaire de vos données à tout moment.',
  },
  {
    q: 'LeadQualif fonctionne-t-il pour tous types d\'agences ?',
    a: 'Oui. LeadQualif est conçu pour les agences immobilières, les mandataires indépendants et les agences SMMA / marketing. Chaque profil d\'agence dispose de ses propres types de documents et indicateurs.',
  },
  {
    q: 'Que se passe-t-il à la fin de mon essai ?',
    a: 'Vous choisissez librement de passer à un plan payant ou non. Vos données sont conservées 30 jours, puis supprimées si vous ne souhaitez pas continuer.',
  },
]

// ─── Composants ───────────────────────────────────────────────────────────────

function StarRating({ count = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition"
      >
        <span className="font-semibold text-gray-900 pr-4">{q}</span>
        <ChevronDown
          size={20}
          className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
  green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
  pink: 'bg-pink-100 text-pink-600',
  yellow: 'bg-yellow-100 text-yellow-600',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Brain size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LeadQualif</span>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">IA</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#fonctionnalites" className="hover:text-blue-600 transition">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-blue-600 transition">Tarifs</a>
            <a href="#temoignages" className="hover:text-blue-600 transition">Témoignages</a>
            <a href="#faq" className="hover:text-blue-600 transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition hidden sm:block">
              Connexion
            </Link>
            <Link
              to="/login"
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition flex items-center gap-2"
            >
              Essai 7 jours gratuits
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 overflow-hidden">
        {/* Gradient BG */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-100 rounded-full blur-3xl opacity-40 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6 text-sm font-semibold">
            <Zap size={14} className="fill-blue-500" />
            Nouveau — Pipeline IA + Génération documents automatique
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-[1.05] tracking-tight">
            Votre agence<br />
            <span className="text-blue-600">mérite des clients sérieux.</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-500 mb-10 max-w-3xl mx-auto leading-relaxed">
            LeadQualif qualifie vos prospects 24/7 par IA, génère vos documents en 1 clic
            et pilote votre CA — pour que vous ne travaillez plus que sur ce qui compte vraiment.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to={`/login?returnTo=${encodeURIComponent('/settings?tab=facturation&plan=growth')}`}
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-200 group"
            >
              Démarrer mon essai gratuit
              <ArrowRight size={20} className="group-hover:translate-x-1 transition" />
            </Link>
            <a
              href="/estimation"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-gray-700 px-8 py-4 rounded-xl font-bold text-lg border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <Star size={18} className="text-yellow-500" />
              Voir le formulaire démo
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            {[
              '7 jours gratuits',
              'Sans carte bancaire',
              'Annulation à tout moment',
              'Données hébergées en EU',
            ].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle size={15} className="text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Chiffres clés ──────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '1 clic', label: 'Pour générer une facture ou un devis' },
            { value: '0-10', label: 'Score IA par lead, en temps réel' },
            { value: '+40%', label: 'De mandats signés en moyenne (mois 1)' },
            { value: '< 2 min', label: 'Pour qualifier un nouveau prospect' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl md:text-4xl font-extrabold text-blue-400 mb-2">{value}</div>
              <div className="text-gray-400 text-sm leading-snug">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fonctionnalités ────────────────────────────────────────────── */}
      <section id="fonctionnalites" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full mb-4 text-sm font-semibold">
              <Sparkles size={14} />
              Fonctionnalités complètes
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Tout ce dont votre agence a besoin.<br />
              <span className="text-blue-600">Rien de superflu.</span>
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              LeadQualif remplace votre CRM, votre outil de facturation et votre tableau de bord analytics — en une seule plateforme.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${colorMap[color]}`}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition">{title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ──────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Comment ça marche</h2>
            <p className="text-xl text-gray-500">3 étapes pour transformer vos leads en clients signés</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Target,
                title: 'Vos leads arrivent qualifiés',
                desc: 'Partagez votre formulaire de qualification. Chaque soumission est scorée par IA automatiquement (0 à 10). Vous voyez instantanément qui vaut votre temps.',
                color: 'blue',
              },
              {
                step: '02',
                icon: Brain,
                title: 'L\'IA recommande l\'action',
                desc: 'Pour chaque lead, l\'IA analyse budget, projet, urgence et historique — et vous dit exactement quoi faire ensuite : appeler, envoyer un devis, ignorer.',
                color: 'purple',
              },
              {
                step: '03',
                icon: FileText,
                title: 'Vous signez, le doc est généré',
                desc: 'Devis accepté ? Générez la facture en 1 clic. Contrat signé ? Le rapport est archivé. Votre centre de documents gère tout, avec historique complet.',
                color: 'green',
              },
            ].map(({ step, icon: Icon, title, desc, color }) => (
              <div key={step} className="relative">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full">
                  <div className="text-6xl font-black text-gray-100 mb-4 leading-none">{step}</div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorMap[color]}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
                {step !== '03' && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10 items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full">
                    <ChevronRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROI Section ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-900/50 text-green-400 px-4 py-2 rounded-full mb-6 text-sm font-semibold border border-green-800">
            <TrendingUp size={14} />
            Calculez votre ROI
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            1 client signé grâce à LeadQualif<br />
            <span className="text-green-400">= votre abonnement rentabilisé 6 mois.</span>
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Combien vous coûte actuellement 1 heure passée à qualifier un mauvais lead ?
            LeadQualif vous rend ce temps — et vous aide à identifier les opportunités réelles.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { label: 'Sans LeadQualif', value: '2-3h/jour', sub: 'passées à qualifier manuellement', bad: true },
              { label: 'Avec LeadQualif', value: '< 5 min', sub: 'pour traiter un nouveau lead scoré', bad: false },
              { label: 'Retour sur investissement', value: '× 10', sub: 'minimum sur votre temps commercial', bad: false },
            ].map(({ label, value, sub, bad }) => (
              <div key={label} className={`rounded-2xl p-6 border ${bad ? 'border-red-800 bg-red-900/20' : 'border-green-800 bg-green-900/20'}`}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3 text-gray-400">{label}</div>
                <div className={`text-3xl font-extrabold mb-1 ${bad ? 'text-red-400' : 'text-green-400'}`}>{value}</div>
                <div className="text-gray-400 text-sm">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs ─────────────────────────────────────────────────────── */}
      <section id="tarifs" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full mb-4 text-sm font-semibold">
              <Euro size={14} />
              Tarifs simples et transparents
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Investissez dans votre croissance.
            </h2>
            <p className="text-xl text-gray-500 mb-8">
              Pas d'engagement. Pas de surprise. Annulable à tout moment.
            </p>

            {/* Toggle annuel / mensuel */}
            <div className="inline-flex items-center gap-3 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${!annual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${annual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                Annuel
                <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">2 mois offerts</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const displayPrice = annual ? plan.annualPrice : plan.price
              const isPrimary = plan.id === 'growth'
              const isEnterprise = plan.id === 'enterprise'

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-8 border-2 flex flex-col ${
                    isPrimary
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xl shadow-blue-200 scale-[1.02]'
                      : 'bg-white text-gray-900 border-gray-200'
                  }`}
                >
                  {plan.badge && (
                    <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap ${
                      isPrimary ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 text-white'
                    }`}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className={`text-xl font-bold mb-1 ${isPrimary ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                    <p className={`text-sm mb-5 ${isPrimary ? 'text-blue-100' : 'text-gray-500'}`}>{plan.desc}</p>
                    <div className="flex items-baseline gap-2">
                      {isEnterprise ? (
                        <span className={`text-3xl font-extrabold ${isPrimary ? 'text-white' : 'text-gray-900'}`}>
                          Sur devis
                        </span>
                      ) : (
                        <>
                          <span className={`text-5xl font-extrabold ${isPrimary ? 'text-white' : 'text-gray-900'}`}>
                            {displayPrice}€
                          </span>
                          <span className={isPrimary ? 'text-blue-200' : 'text-gray-400'}>/mois</span>
                        </>
                      )}
                    </div>
                    {!isEnterprise && annual && (
                      <div className={`text-xs mt-1 ${isPrimary ? 'text-blue-200' : 'text-gray-400'}`}>
                        Facturé {displayPrice * 12}€/an — économie de {(plan.price - plan.annualPrice) * 12}€
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check size={16} className={`flex-shrink-0 mt-0.5 ${isPrimary ? 'text-blue-200' : 'text-green-500'}`} />
                        <span className={isPrimary ? 'text-blue-50' : 'text-gray-700'}>{f}</span>
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm opacity-40">
                        <X size={16} className="flex-shrink-0 mt-0.5 text-gray-400" />
                        <span className="text-gray-500 line-through">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isEnterprise ? (
                    <a
                      href="mailto:contact@leadqualif.com"
                      className="w-full text-center px-6 py-3.5 rounded-xl font-bold border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white transition block"
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <Link
                      to={`/login?returnTo=${encodeURIComponent(`/settings?tab=facturation&plan=${plan.id}${annual ? `_annual` : ''}`)}`}
                      className={`w-full text-center px-6 py-3.5 rounded-xl font-bold transition block ${
                        isPrimary
                          ? 'bg-white text-blue-600 hover:bg-blue-50'
                          : 'border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-center text-gray-400 text-sm mt-8">
            🔒 Paiement sécurisé par Stripe · Annulation en 1 clic · Données 100% hébergées en Europe
          </p>
        </div>
      </section>

      {/* ── Témoignages ────────────────────────────────────────────────── */}
      <section id="temoignages" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full mb-4 text-sm font-semibold">
              <Star size={14} className="fill-yellow-500" />
              Ce que disent nos clients
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900">
              Des agences qui ont arrêté de perdre du temps.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, avatar, color, text, stars }) => (
              <div key={name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <StarRating count={stars} />
                <p className="text-gray-700 leading-relaxed my-4 italic">"{text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                    {avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{name}</div>
                    <div className="text-gray-400 text-xs">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Confiance ──────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center text-gray-400 text-sm mb-10 font-medium uppercase tracking-wider">
            Conçu pour les professionnels exigeants
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'RGPD Confiant', sub: 'Hébergement Europe · Données chiffrées' },
              { icon: Lock, title: 'Sécurité maximale', sub: 'Auth double facteur · Accès par rôle' },
              { icon: Building2, title: 'Multi-agences', sub: 'Immo · SMMA · Conseil · Freelance' },
              { icon: Clock, title: 'Disponible 24/7', sub: 'Formulaire actif même quand vous dormez' },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="text-center p-5 rounded-xl border border-gray-100 hover:border-blue-100 transition">
                <Icon size={24} className="text-blue-600 mx-auto mb-3" />
                <div className="font-semibold text-gray-900 text-sm mb-1">{title}</div>
                <div className="text-gray-400 text-xs leading-snug">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full mb-4 text-sm font-semibold">
              <MessageSquare size={14} />
              Questions fréquentes
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900">
              Tout ce que vous voulez savoir
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => <FaqItem key={item.q} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── CTA Final ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-6">🚀</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            Prêt à ne plus jamais perdre<br />un lead qualifié ?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            7 jours gratuits, sans carte. Configurez votre agence en 5 minutes.
            Vos premiers leads qualifiés par IA arrivent dès aujourd'hui.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={`/login?returnTo=${encodeURIComponent('/settings?tab=facturation&plan=growth')}`}
              className="bg-white text-blue-600 px-10 py-5 rounded-xl font-extrabold text-lg hover:bg-blue-50 transition flex items-center justify-center gap-2 shadow-xl group"
            >
              Démarrer gratuitement — 7 jours
              <ArrowRight size={20} className="group-hover:translate-x-1 transition" />
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-6">
            Sans carte bancaire · Sans engagement · Annulation en 1 clic
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Brain size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold">LeadQualif</span>
              <span className="bg-blue-900 text-blue-300 text-xs px-2 py-0.5 rounded-full">IA</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-gray-400">
              <a href="#fonctionnalites" className="hover:text-white transition">Fonctionnalités</a>
              <a href="#tarifs" className="hover:text-white transition">Tarifs</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
              <a href="mailto:contact@leadqualif.com" className="hover:text-white transition">Contact</a>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} LeadQualif — Tous droits réservés</span>
            <div className="flex gap-6">
              <a href="/mentions-legales.html" className="hover:text-white transition">Mentions légales</a>
              <a href="/cgu.html" className="hover:text-white transition">CGU</a>
              <a href="/cgv.html" className="hover:text-white transition">CGV</a>
              <a href="/politique-confidentialite.html" className="hover:text-white transition">Confidentialité</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
