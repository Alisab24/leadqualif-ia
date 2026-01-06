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

  // Composant Lien Menu Optimisé Bitrix
  const NavItem = ({ to, icon, label }) => (
    <Link 
      to={to} 
      className={`flex items-center h-12 px-4 mb-2 mx-2 rounded-xl transition-all duration-200 overflow-hidden whitespace-nowrap group-hover:px-4 ${
        isActive(to) 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
          : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {/* Icône toujours visible et centrée si menu fermé */}
      {icon}

      {/* Texte visible seulement au survol du menu global */}
      <span className="ml-4 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
        {label}
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
      {/* SIDEBAR STYLE BITRIX24 */}
      <aside className="group w-20 hover:w-64 bg-gradient-to-b from-slate-900 to-blue-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl transition-all duration-300 z-50">
        {/* HAUT : LOGO */}
        <div>
          <div className="h-20 flex items-center justify-center border-b border-white/5 bg-black/20">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg text-lg">
              N
            </div>
            <span className="ml-3 font-bold text-lg tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute left-20">
              LeadQualif
            </span>
          </div>

          {/* NAVIGATION */}
          <nav className="mt-6 flex flex-col">
            <NavItem to="/dashboard" icon="📊" label="Tableau de bord" />
            <NavItem to="/stats" icon="📈" label="Statistiques" />
            <NavItem to="/documents" icon="📂" label="Mes Documents" />
            <div className="my-2 border-t border-white/5 mx-4"></div>
            <NavItem to="/settings" icon="⚙️" label="Paramètres" />
          </nav>
        </div>

        {/* BAS : PROFIL */}
        {session && (
          <div className="p-4 border-t border-white/5 bg-black/20 overflow-hidden">
            <div className="flex items-center gap-3 transition-all">
              <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold shadow-inner border-2 border-slate-800">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col w-full overflow-hidden">
                <p className="text-xs font-bold truncate text-white">{profile?.first_name || 'Utilisateur'}</p>
                <button 
                  onClick={handleLogout}
                  className="text-[10px] text-red-400 hover:text-red-300 text-left flex items-center gap-1 mt-1"
                >
                  🛑 Déconnexion
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* CONTENU PRINCIPAL (Décalé de 20 pour laisser la place aux icônes) */}
      <div className="flex-1 ml-16 transition-all duration-300">
        <Outlet />
      </div>
    </div>
  );
}
