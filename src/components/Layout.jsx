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
import { supabase } from '../supabaseClient';

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

/* ─── Badge plan ─────────────────────────────────────── */
const PLAN_BADGE = {
  free:       { label: 'Free',    cls: 'bg-slate-600 text-slate-200' },
  starter:    { label: 'Starter', cls: 'bg-blue-700 text-blue-100' },
  pro:        { label: 'Pro',     cls: 'bg-indigo-600 text-white' },
  enterprise: { label: 'Entpr.',  cls: 'bg-violet-600 text-white' },
};

/* ──────────────────────────────────────────────────────── */

export default function Layout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [pinned,  setPinned]    = useState(() => {
    try { return localStorage.getItem('sidebar_pinned') === 'true'; } catch { return false; }
  });
  const [hovered, setHovered]   = useState(false);

  const expanded = pinned || hovered;

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
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    setProfile(data);
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
    const active = isActive(to);
    return (
      <div className="relative group/item mx-2 mb-1">
        <Link
          to={to}
          className={`flex items-center h-11 px-3 rounded-xl transition-all duration-200 ${
            active
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
          {active && expanded && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
          )}
        </Link>
        {/* Tooltip quand sidebar fermée */}
        {!expanded && (
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200]
            px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl whitespace-nowrap
            opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 border border-white/10">
            {label}
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
          {/* Logo / initiale agence */}
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
          <NavItem to="/dashboard" icon={Icons.dashboard} label="Tableau de bord" />
          <NavItem to="/stats"     icon={Icons.stats}     label="Statistiques" />
          <NavItem to="/documents" icon={Icons.documents} label="Documents" />

          <div className="my-3 border-t border-white/5 mx-3" />

          <NavItem to="/settings"  icon={Icons.settings}  label="Paramètres" />
        </nav>

        {/* ── Profil utilisateur + déconnexion ── */}
        {session && (
          <div className="shrink-0 p-3 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500
                flex items-center justify-center text-xs font-bold text-white border-2 border-slate-700 shadow">
                {initials()}
              </div>

              {/* Nom + déco */}
              <div className={`flex-1 overflow-hidden transition-all duration-300 ${
                expanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
              }`}>
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {profile?.nom_complet || profile?.nom_agence || session.user.email}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{session.user.email}</p>
              </div>

              {/* Bouton déconnexion */}
              <div className="relative group/logout">
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
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
      <div className={`flex-1 transition-all duration-300 min-w-0 overflow-hidden ${
        expanded ? 'ml-60' : 'ml-16'
      }`}>
        <Outlet />
      </div>
    </div>
  );
}
