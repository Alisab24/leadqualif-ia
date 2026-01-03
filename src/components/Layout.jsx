import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Layout() {
  const [user, setUser] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showTooltip, setShowTooltip] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const menuItems = [
    { icon: '📊', label: 'Dashboard', path: '/app' },
    { icon: '🚀', label: 'Pipeline', path: '/app/pipeline' },
    { icon: '📂', label: 'Documents', path: '/app/commercial' },
    { icon: '⚙️', label: 'Paramètres', path: '/app/settings' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-16 bg-slate-900 flex flex-col justify-between">
        {/* Logo */}
        <div className="p-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">N</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1">
          {menuItems.map((item) => (
            <div key={item.path} className="relative">
              <Link
                to={item.path}
                className={`w-full h-16 flex items-center justify-center text-xl hover:bg-slate-800 transition-colors relative group ${
                  isActive(item.path) ? 'bg-slate-800 text-blue-400' : 'text-gray-400'
                }`}
                onMouseEnter={() => setShowTooltip(item.label)}
                onMouseLeave={() => setShowTooltip('')}
              >
                {item.icon}
                
                {/* Tooltip */}
                {showTooltip === item.label && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50">
                    {item.label}
                    <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                  </div>
                )}
              </Link>
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-full h-16 flex items-center justify-center text-gray-400 hover:bg-slate-800 transition-colors"
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Profile" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </button>

          {/* Profile Menu */}
          {showProfileMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              <div className="px-4 py-2 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  )
}
