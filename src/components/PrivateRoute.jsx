import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function PrivateRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifie la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Écoute les changements (connexion/déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    // Affiche un loader au lieu de crasher ou d'afficher une page blanche
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Si pas de session, retour à la case départ
  if (!session) {
    return <Navigate to="/" replace />;
  }

  // Si tout est bon, on affiche la page protégée
  return children;
}
