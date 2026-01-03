import { Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Layout() {
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-16 w-16 bg-slate-900 flex flex-col items-center justify-between p-2 z-50">
        {/* Logo */}
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        
        {/* Menu Icônes */}
        <nav className="flex-1 space-y-6 w-full flex flex-col items-center">
          <Link to="/app" className={`p-3 rounded-xl transition-all ${isActive('/app') ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Dashboard">
            📊
          </Link>
          
          <Link to="/app/commercial" className={`p-3 rounded-xl transition-all ${isActive('/app/commercial') ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Documents">
            📂
          </Link>
          <Link to="/app/settings" className={`p-3 rounded-xl transition-all ${isActive('/app/settings') ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Paramètres">
            ⚙️
          </Link>
        </nav>
        
        {/* Avatar / Logout */}
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="mt-auto p-3 text-red-400 hover:bg-red-900/30 rounded-xl" 
          title="Déconnexion"
        >
          🚪
        </button>
      </div>
      
      {/* Zone de Contenu Principale (À droite de la sidebar) */}
      <div className="flex-1 ml-20 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {/* C'est ICI que les pages s'affichent */}
          <Outlet />
        </div>
      </div>
    </div>
  )
}
