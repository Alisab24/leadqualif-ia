import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Imports des pages
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Commercial from './pages/Commercial'
import Settings from './pages/Settings'
import Estimation from './pages/Estimation'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Vérifie la session active au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Écoute les changements (connexion/déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Écran de chargement simple pour éviter l'écran blanc pendant la vérification
  if (loading) return "Chargement de l'application..."

  return (
    <Routes>
      {/* Routes Publiques (Accessibles à tous) */}
      <Route path="/" element={<Home />} />
      <Route path="/estimation" element={<Estimation />} />
      <Route path="/login" element={session ? <Navigate to="/app" /> : <Login />} />
      
      {/* Routes Protégées (App) */}
      <Route path="/app" element={session ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="commercial" element={<Commercial />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
