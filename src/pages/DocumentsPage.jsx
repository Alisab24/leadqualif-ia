import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer l'utilisateur et son agence
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.agency_id) {
          setAgencyId(profile.agency_id);
          
          // Récupérer tous les documents de l'agence
          const { data: docs } = await supabase
            .from('documents')
            .select(`
              *,
              leads!inner(
                nom, 
                email, 
                telephone
              )
            `)
            .eq('agency_id', profile.agency_id)
            .order('created_at', { ascending: false });

          setDocuments(docs || []);
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">📂 Mes Documents</h1>
        <p className="text-slate-600">
          {documents.length} document{documents.length > 1 ? 's' : ''} généré{documents.length > 1 ? 's' : ''}
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center py-20">
          <span className="text-6xl mb-4 block">📄</span>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun document</h3>
          <p className="text-slate-500 mb-6">
            Pour générer des documents, allez sur le <b>Dashboard</b> et cliquez sur un Lead.
          </p>
          <Link 
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 Voir le Dashboard
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 font-medium text-slate-700">Type</th>
                  <th className="text-left p-4 font-medium text-slate-700">Client</th>
                  <th className="text-left p-4 font-medium text-slate-700">Email</th>
                  <th className="text-left p-4 font-medium text-slate-700">Téléphone</th>
                  <th className="text-left p-4 font-medium text-slate-700">Date</th>
                  <th className="text-left p-4 font-medium text-slate-700">Statut</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-50 text-red-500 rounded flex items-center justify-center text-xs font-bold">PDF</div>
                        <span className="font-medium text-slate-700">{doc.type}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-700">{doc.leads?.nom || 'N/A'}</td>
                    <td className="p-4 text-slate-600">{doc.leads?.email || 'N/A'}</td>
                    <td className="p-4 text-slate-600">{doc.leads?.telephone || 'N/A'}</td>
                    <td className="p-4 text-slate-600">
                      {new Date(doc.created_at).toLocaleDateString()} à {new Date(doc.created_at).toLocaleTimeString().slice(0,5)}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                        {doc.status || 'Généré'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-bold text-slate-800 mb-4">🚀 Actions rapides</h3>
        <div className="flex gap-4">
          <Link 
            to="/dashboard"
            className="flex-1 text-center px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            📊 Dashboard
          </Link>
          <Link 
            to="/estimation"
            className="flex-1 text-center px-4 py-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            🚀 Nouveau Lead
          </Link>
        </div>
      </div>
    </div>
  );
}
