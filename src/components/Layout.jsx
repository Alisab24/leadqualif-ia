/**
 * Layout — Sidebar navigation
 * - Icônes SVG propres (pas d'emojis)
 * - Mode collapsed (w-16) + mode épinglé (w-60) avec bouton toggle
 * - Tooltips sur les icônes quand sidebar fermée
 * - Nom agence + logo depuis profil
 * - Badge plan d'abonnement
 * - Nom utilisateur depuis nom_complet
 */
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import { usePlanGuard, PLAN_LIMITS } from './PlanGuard';
import LanguageSelector from './LanguageSelector';
import { applyLang } from '../i18n';

/* ─── Icônes SVG ─────────────────────────────────────── */
const Icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  scraper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  pin: (open) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      {open
        ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
        : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
      }
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

/* ─── Badge plan — noms alignés landing ─────────────── */
const PLAN_BADGE = {
  free:       { label: 'Gratuit',  cls: 'bg-slate-600 text-slate-200' },
  starter:    { label: 'Solo',     cls: 'bg-blue-700 text-blue-100' },
  growth:     { label: 'Agence',   cls: 'bg-indigo-600 text-white' },
  trialing:   { label: 'Essai',    cls: 'bg-green-700 text-green-100' },
  enterprise: { label: 'Expert',   cls: 'bg-violet-600 text-white' },
};

/* ─── Plan requis par route ─────────────────────────── */
// null = accessible à tous, 'starter' = plan Solo+, 'growth' = plan Agence+
const ROUTE_PLAN = {
  '/dashboard': null,
  '/stats':     'growth',
  '/documents': 'starter',
  '/scraper':   'starter',
  '/settings':  null,
};

// Vérifie si un plan utilisateur donne accès à une route
function routeAllowed(userPlan, requiredPlan) {
  if (!requiredPlan) return true;
  const order = ['free', 'starter', 'growth', 'enterprise', 'trialing'];
  const userIdx = order.indexOf(userPlan);
  const reqIdx  = order.indexOf(requiredPlan);
  // trialing = accès total
  if (userPlan === 'trialing') return true;
  return userIdx >= reqIdx;
}

/* ─── Mur de suspension abonnement ─────────────────── */
function SubscriptionWall({ plan, onPortal }) {
  const planNames = { starter: 'Solo', growth: 'Agence', enterprise: 'Expert' };
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">
          Votre essai gratuit est terminé
        </h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Votre accès au plan <strong>{planNames[plan] || 'Agence'}</strong> a expiré.
          Pour continuer à utiliser LeadQualif, choisissez un plan.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/settings?tab=facturation'}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
          >
            🚀 Choisir mon plan — 49€/mois
          </button>
          <p className="text-xs text-slate-400">
            7 jours gratuits · Sans engagement · Annulation en 1 clic
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Bannière paiement rejeté (past_due) ───────────── */
function PastDueBanner() {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm border-b bg-red-50 border-red-200 text-red-800">
      <span className="font-medium">
        ⚠️ Paiement en échec — Votre accès sera suspendu si aucune action n'est prise
      </span>
      <button
        onClick={() => window.location.href = '/settings?tab=facturation'}
        className="text-xs font-bold px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
      >
        Mettre à jour ma carte →
      </button>
    </div>
  );
}

/* ─── Bannière essai en cours ───────────────────────── */
function TrialBannerInline({ plan, trialEnd }) {
  if (!trialEnd) return null;
  const diff  = new Date(trialEnd) - new Date();
  const days  = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const urgent = days <= 3;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm border-b ${urgent ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
      <span className="font-medium">
        {urgent
          ? `⏰ Essai gratuit : ${days === 0 ? 'se termine aujourd\'hui' : `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`}`
          : `🎯 Essai gratuit — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`
        }
      </span>
      <button
        onClick={() => window.location.href = '/settings?tab=facturation'}
        className={`text-xs font-bold px-3 py-1 rounded-lg ${urgent ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-blue-600 text-white hover:bg-blue-700'} transition`}
      >
        {urgent ? 'Continuer sans interruption →' : 'Choisir un plan →'}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

export default function Layout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { t }     = useTranslation();
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [pinned,  setPinned]    = useState(() => {
    try { return localStorage.getItem('sidebar_pinned') === 'true'; } catch { return false; }
  });
  const [hovered, setHovered]   = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);

  // Plan guard — récupère le plan + statut de l'utilisateur connecté
  const { userPlan, status, loading: planLoading, trialEnd } = usePlanGuard();

  const expanded = pinned || hovered;

  // Essai expiré côté client (webhook pas encore reçu) : trialEnd dans le passé
  const trialExpiredClient = status === 'trialing' &&
    trialEnd instanceof Date &&
    trialEnd < new Date();

  // Abonnement suspendu : mur affiché si :
  //  1. Statut inactive/canceled ET l'utilisateur avait un abonnement Stripe (stripe_subscription_id conservé)
  //  2. OU l'essai est expiré côté client avant que le webhook ait mis à jour le statut
  const isWalled = !planLoading && (
    trialExpiredClient ||
    (
      ['inactive', 'canceled'].includes(status) &&
      profile?.stripe_subscription_id !== null &&
      profile?.stripe_subscription_id !== undefined &&
      typeof profile?.stripe_subscription_id === 'string'
    )
  );

  const isTrialing  = status === 'trialing';
  const isPastDue   = status === 'past_due';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else navigate('/');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) navigate('/');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (!data) return;

    // Si c'est un membre (agency_id ≠ user_id), récupérer le nom/logo de l'agence du propriétaire
    const isMember = data.agency_id && data.agency_id !== userId;
    if (isMember) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('nom_agence, logo_url, couleur_primaire, couleur_secondaire, type_agence')
        .eq('user_id', data.agency_id)
        .maybeSingle();
      if (ownerProfile) {
        // Injecter les infos agence du propriétaire dans le profil affiché
        setProfile({
          ...data,
          nom_agence:        ownerProfile.nom_agence        || data.nom_agence,
          logo_url:          ownerProfile.logo_url          || data.logo_url,
          couleur_primaire:  ownerProfile.couleur_primaire  || data.couleur_primaire,
          couleur_secondaire:ownerProfile.couleur_secondaire|| data.couleur_secondaire,
          type_agence:       ownerProfile.type_agence       || data.type_agence,
        });
        return;
      }
    }
    setProfile(data);
    // Appliquer la langue persistée dans le profil
    if (data.lang) applyLang(data.lang);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try { localStorage.setItem('sidebar_pinned', String(next)); } catch {}
  };

  const isActive = (path) => location.pathname === path;

  /* initiales avatar */
  const initials = () => {
    const name = profile?.nom_complet || profile?.nom_agence || session?.user?.email || '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  /* Badge plan */
  const plan = profile?.subscription_plan || 'free';
  const badge = PLAN_BADGE[plan] || PLAN_BADGE.free;

  /* ── NavItem ── */
  const NavItem = ({ to, icon, label }) => {
    const active     = isActive(to);
    const required   = ROUTE_PLAN[to];
    const allowed    = routeAllowed(userPlan, required);
    const locked     = !allowed && !planLoading;
    const planNames  = { starter: 'Solo', growth: 'Agence' };

    const handleClick = (e) => {
      if (locked) {
        e.preventDefault();
        navigate('/settings?tab=facturation');
      }
    };

    return (
      <div className="relative group/item mx-2 mb-1">
        <Link
          to={to}
          onClick={handleClick}
          className={`flex items-center h-11 px-3 rounded-xl transition-all duration-200 ${
            locked
              ? 'text-slate-600 hover:bg-white/5 cursor-pointer opacity-60'
              : active
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="shrink-0">{icon}</span>
          <span className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
            expanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'
          }`}>
            {label}
          </span>
          {/* Indicateur plan requis */}
          {locked && expanded && (
            <span className="ml-auto text-[10px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
              🔒 {planNames[required] || required}
            </span>
          )}
          {!locked && active && expanded && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
          )}
        </Link>
        {/* Tooltip quand sidebar fermée */}
        {!expanded && (
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200]
            px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl whitespace-nowrap
            opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 border border-white/10">
            {locked ? `🔒 ${label} — Plan ${planNames[required] || required} requis` : label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-slate-50">

      {/* ══ SIDEBAR ══ */}
      <aside
        onMouseEnter={() => !pinned && setHovered(true)}
        onMouseLeave={() => !pinned && setHovered(false)}
        className={`flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl
          bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950
          transition-all duration-300 ease-in-out
          ${expanded ? 'w-60' : 'w-16'}`}
      >

        {/* ── En-tête logo + bouton pin ── */}
        <div className="h-16 flex items-center px-3 border-b border-white/5 bg-black/20 shrink-0">
          {/* Logo / initiale agence cliente */}
          <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-white shadow-lg text-base overflow-hidden"
            style={{ background: profile?.couleur_primaire || 'linear-gradient(135deg,#2563eb,#4f46e5)' }}>
            {profile?.logo_url
              ? <img src={profile.logo_url} alt="logo" className="w-full h-full object-contain"
                  onError={e => { e.target.style.display = 'none'; }} />
              : (profile?.nom_agence?.charAt(0)?.toUpperCase() || 'N')
            }
          </div>

          {/* Nom agence + bouton pin */}
          <div className={`ml-3 flex items-center justify-between flex-1 overflow-hidden transition-all duration-300 ${
            expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate leading-tight">
                {profile?.nom_agence || 'Mon agence'}
              </p>
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <button
              onClick={togglePin}
              title={pinned ? 'Réduire' : 'Épingler'}
              className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              {Icons.pin(pinned)}
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 pt-4 overflow-y-auto overflow-x-hidden">
          <NavItem to="/dashboard" icon={Icons.dashboard} label={t('nav.dashboard')} />
          <NavItem to="/stats"     icon={Icons.stats}     label={t('nav.stats')} />
          <NavItem to="/documents" icon={Icons.documents} label={t('nav.documents')} />
          <NavItem to="/scraper"   icon={Icons.scraper}   label="Scraper" />

          <div className="my-3 border-t border-white/5 mx-3" />

          <NavItem to="/settings"  icon={Icons.settings}  label={t('nav.settings')} />
        </nav>

        {/* ── Profil utilisateur + déconnexion ── */}
        {session && (
          <div className="shrink-0 p-3 border-t border-white/5 bg-black/20 relative">

            {/* ── POPUP PROFIL ─────────────────────────────── */}
            {showUserPopup && (
              <>
                {/* Overlay transparent pour fermer en cliquant dehors */}
                <div
                  className="fixed inset-0 z-[199]"
                  onClick={() => setShowUserPopup(false)}
                />
                {/* Popup */}
                <div className="absolute bottom-full left-2 right-2 mb-2 z-[200]
                  bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden
                  animate-in fade-in slide-in-from-bottom-2 duration-150">

                  {/* En-tête coloré */}
                  <div className="px-4 pt-4 pb-3 bg-gradient-to-r from-slate-700 to-slate-800 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      {/* Avatar grand */}
                      <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500
                        flex items-center justify-center text-base font-bold text-white border-2 border-slate-600 shadow-lg">
                        {initials()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate leading-tight">
                          {profile?.nom_complet || session.user.email?.split('@')[0] || 'Utilisateur'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{session.user.email}</p>
                      </div>
                      {/* Bouton fermer */}
                      <button
                        onClick={() => setShowUserPopup(false)}
                        className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Corps — infos */}
                  <div className="px-4 py-3 space-y-2">
                    {/* Agence */}
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="w-4 text-center">🏢</span>
                      <span className="truncate">{profile?.nom_agence || 'Agence non définie'}</span>
                    </div>
                    {/* Type agence */}
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="w-4 text-center">{profile?.type_agence === 'smma' ? '📱' : '🏠'}</span>
                      <span>{profile?.type_agence === 'smma' ? 'SMMA' : 'Immobilier'}</span>
                    </div>
                    {/* Rôle */}
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="w-4 text-center">👤</span>
                      <span className="capitalize">{profile?.role || 'owner'}</span>
                      <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                        profile?.role === 'owner' ? 'bg-amber-600/40 text-amber-300'
                        : profile?.role === 'admin' ? 'bg-blue-600/40 text-blue-300'
                        : 'bg-indigo-600/40 text-indigo-300'
                      }`}>
                        {profile?.role === 'owner' ? 'Propriétaire' : profile?.role === 'admin' ? 'Admin' : 'Agent'}
                      </span>
                    </div>
                    {/* Plan */}
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="w-4 text-center">💳</span>
                      <span>Plan actuel</span>
                      <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-3">
                    <button
                      onClick={() => { navigate('/settings'); setShowUserPopup(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                        text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-left"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                      {t('nav.accountSettings')}
                    </button>
                    <button
                      onClick={() => { handleLogout(); setShowUserPopup(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                        text-xs font-semibold text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors text-left"
                    >
                      {Icons.logout}
                      {t('nav.logout')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Sélecteur de langue (visible quand sidebar ouverte) ── */}
            {expanded && (
              <div className="px-3 pb-2">
                <LanguageSelector variant="navbar" />
              </div>
            )}

            {/* ── BARRE BAS : avatar cliquable + logout ── */}
            <div className="flex items-center gap-3">
              {/* Avatar — cliquable pour ouvrir popup */}
              <button
                onClick={() => setShowUserPopup(v => !v)}
                title="Mon profil"
                className={`w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500
                  flex items-center justify-center text-xs font-bold text-white border-2 transition-all
                  ${showUserPopup ? 'border-blue-400 scale-105 shadow-lg shadow-blue-500/30' : 'border-slate-700 hover:border-slate-500 hover:scale-105'}`}
              >
                {initials()}
              </button>

              {/* Nom + email (sidebar ouverte) */}
              <div className={`flex-1 overflow-hidden transition-all duration-300 ${
                expanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
              }`}>
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {profile?.nom_complet || profile?.nom_agence || session.user.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{session.user.email}</p>
              </div>

              {/* Bouton déconnexion */}
              <div className="relative group/logout">
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Déconnexion"
                >
                  {Icons.logout}
                </button>
                {!expanded && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200]
                    px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl whitespace-nowrap
                    opacity-0 group-hover/logout:opacity-100 transition-opacity duration-150 border border-white/10">
                    Déconnexion
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ══ CONTENU PRINCIPAL ══ */}
      <div className={`flex-1 transition-all duration-300 min-w-0 overflow-hidden flex flex-col ${
        expanded ? 'ml-60' : 'ml-16'
      }`}>
        {/* Bannière paiement rejeté */}
        {isPastDue && <PastDueBanner />}

        {/* Bannière essai en cours */}
        {isTrialing && (
          <TrialBannerInline
            plan={userPlan}
            trialEnd={trialEnd ? trialEnd.toISOString() : profile?.subscription_current_period_end}
          />
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>

      {/* Mur de suspension — par-dessus tout le contenu */}
      {isWalled && (
        <SubscriptionWall plan={profile?.subscription_plan || userPlan} />
      )}
    </div>
  );
}
