import { Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { usePlanGuard, FeatureGate } from '../components/PlanGuard'

export default function Layout() {
  const location = useLocation()
  const { canAccess } = usePlanGuard()
  
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
          <FeatureGate 
            feature="stats"
            fallback={
              <div className="relative group">
                <div className="p-3 rounded-xl transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-800 cursor-not-allowed opacity-60" title="Statistiques Agence (PRO)">
                  📊
                </div>
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  🔒 PRO
                </div>
              </div>
            }
          >
            <Link to="/app/stats" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app/stats') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Statistiques Agence">
              📊
            </Link>
          </FeatureGate>
          
          <Link to="/app" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Pipeline">
            🚀
          </Link>
          
          <a 
            href="/estimation" 
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-xl transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-800" 
            title="Lien de capture Leads"
          >
            🔗
          </a>
          
          <Link to="/app/commercial" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app/commercial') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Documents">
            📂
          </Link>
          <Link to="/app/settings" className={`p-3 rounded-xl transition-all duration-200 ${isActive('/app/settings') ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Paramètres">
            ⚙️
          </Link>
        </nav>
        
        {/* Bouton Voir le site */}
        <a 
          href="/" 
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 text-blue-400 hover:bg-blue-900/30 rounded-xl transition-colors" 
          title="Voir le site"
        >
          🌐
        </a>
        
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
