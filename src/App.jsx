import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Imports des pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Commercial from './pages/Commercial'
import Settings from './pages/Settings'
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
      {/* Route Login : Si connecté -> redirection vers /app, sinon affiche Login */}
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/app" />} />

      {/* Racine : Redirection intelligente */}
      <Route path="/" element={<Navigate to={session ? "/app" : "/login"} />} />
      
      {/* ROUTES PROTÉGÉES (L'Application) */}
      <Route path="/app" element={session ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />          {/* Affiche Dashboard sur /app */}
        <Route path="commercial" element={<Commercial />} /> {/* Affiche Commercial sur /app/commercial */}
        <Route path="settings" element={<Settings />} />     {/* Affiche Settings sur /app/settings */}
      </Route>
      
      {/* En cas de route inconnue -> Retour case départ */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
