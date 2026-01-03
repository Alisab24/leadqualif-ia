import { Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Layout() {
  const location = useLocation()
  
  // Fonction pour vérifier si un lien est actif (pour le style)
  const isActive = (path) => location.pathname === path

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-16 bg-slate-900 flex flex-col items-center justify-between p-2 z-50">
        {/* Logo */}
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        
        {/* Menu */}
        <nav className="flex-1 space-y-6 w-full flex flex-col items-center pt-4">
          <Link to="/app" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Pipeline">
            🚀
          </Link>
          
          <Link to="/app/commercial" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app/commercial') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Documents">
            📂
          </Link>
          <Link to="/app/settings" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app/settings') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Paramètres">
            ⚙️
          </Link>
        </nav>
        
        {/* Logout */}
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="mt-auto mb-4 p-3 text-red-400 hover:bg-red-900/30 rounded-xl transition-colors" 
          title="Déconnexion"
        >
          🚪
        </button>
      </div>
      
      {/* CONTENU PRINCIPAL (A droite) */}
      <div className="flex-1 ml-20 h-full overflow-y-auto bg-gray-50">
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">
          <Outlet /> {/* C'est ICI que Dashboard/Commercial s'affichent */}
        </div>
      </div>
    </div>
  )
}
