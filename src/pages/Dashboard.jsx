import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import IntegratedDashboard from '../components/IntegratedDashboard';
import DatabaseDebug from '../components/DatabaseDebug';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [agencyId, setAgencyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version] = useState('2.0'); // Force reload

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('agency_id')
            .eq('user_id', session.user.id)
            .single();
          
          setAgencyId(profile?.agency_id);
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data }) => setAgencyId(data?.agency_id));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session || !agencyId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Veuillez vous connecter pour accéder au dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-blue-600 text-white text-center py-1 text-xs">
        Dashboard v{version} - Nouveau design intégré
      </div>
      <IntegratedDashboard agencyId={agencyId} />
      <DatabaseDebug />
    </div>
  );
}