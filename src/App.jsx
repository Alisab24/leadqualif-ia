import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Commercial from './pages/Commercial'
import Settings from './pages/Settings'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Écran de chargement pour éviter le flash blanc
  if (loading) return "Chargement LeadQualif..."

  // Protection des routes
  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />
    return children
  }

  return (
    <Routes>
      {/* Route Publique */}
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/app" />} />

      {/* Redirection racine */}
      <Route path="/" element={<Navigate to={session ? "/app" : "/login"} />} />
      
      {/* ROUTES PROTÉGÉES AVEC LAYOUT */}
      <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />          {/* /app */}
        <Route path="commercial" element={<Commercial />} /> {/* /app/commercial */}
        <Route path="settings" element={<Settings />} />     {/* /app/settings */}
      </Route>
      
      {/* Catch-all pour les erreurs 404 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}