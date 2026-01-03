import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Commercial from './pages/Commercial';
import Settings from './pages/Settings';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Landing from './pages/Landing';
import Estimation from './pages/Estimation';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { supabase } from './supabaseClient';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        setLoading(false);
      }
    );

    // Vérifier la session initiale
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Initial session check:', session);
      setSession(session);
      setLoading(false);
    };

    checkSession();

    // Nettoyage
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Route publique : Landing Page */}
        <Route path="/" element={<Landing />} />
        
        {/* Routes publiques : Authentification */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        
        {/* Routes protégées sous /app avec Layout */}
        <Route path="/app" element={
          <ProtectedRoute session={session}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/app/commercial" element={
          <ProtectedRoute session={session}>
            <Layout>
              <Commercial />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/app/settings" element={
          <ProtectedRoute session={session}>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Routes publiques pour les formulaires */}
        <Route path="/estimation" element={<Estimation />} />
        <Route path="/merci" element={<Navigate to="/merci.html" replace />} />
        
        {/* Route par défaut : rediriger vers la landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;