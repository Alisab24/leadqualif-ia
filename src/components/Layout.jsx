import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else navigate('/');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const isActive = (path) => location.pathname === path;

  // Composant Lien Menu
  const NavItem = ({ to, icon, label }) => (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        isActive(to) 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 font-medium' 
          : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className={`text-xl ${isActive(to) ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
        {icon}
      </span>
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 to-blue-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl">
        {/* LOGO */}
        <div className="p-6 pb-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
              N
            </div>
            <span className="font-bold text-lg tracking-wide">LeadQualif IA</span>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem to="/dashboard" icon="📊" label="Dashboard" />
          <NavItem to="/estimation" icon="🚀" label="Nouveau Lead" />
          <NavItem to="/documents" icon="📂" label="Documents" />
          
          <div className="pt-4 pb-2">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Configuration</p>
          </div>
          
          <NavItem to="/settings" icon="⚙️" label="Paramètres" />
        </nav>

        {/* PROFIL UTILISATEUR (Bas de page) */}
        {session && (
          <div className="p-4 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition group relative">
              
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-inner">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>

              {/* Info User */}
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">
                  {profile?.first_name || 'Utilisateur'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {session.user.email}
                </p>
              </div>

              {/* Logout Button */}
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
                title="Se déconnecter"
              >
                🛑
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 ml-64">
        <Outlet />
      </div>
    </div>
  );
}
