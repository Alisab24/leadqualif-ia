import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [agencyId, setAgencyId] = useState(null);

  useEffect(() => {
    fetchAgencyId();
  }, []);

  useEffect(() => {
    if (agencyId) fetchDocs();
  }, [agencyId]);

  const fetchAgencyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.agency_id) {
          setAgencyId(profile.agency_id);
        }
      }
    } catch (error) {
      console.error('Erreur récupération agency_id:', error);
    }
  };

  const fetchDocs = async () => {
    try {
      const { data } = await supabase
        .from('documents')
        .select('*, leads(nom, email, telephone)')
        .eq('agency_id', agencyId)
        .order('created_at', {ascending: false});
      
      if (data) setDocs(data);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">📂 Centre de Documents</h1>
          <p className="text-slate-600">Tous les documents générés pour votre agence</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-lg text-slate-800">Documents générés</h3>
            <div className="text-sm text-slate-600">
              {docs.length} document{docs.length > 1 ? 's' : ''}
            </div>
          </div>
          
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-4 text-left">Type</th>
                <th className="px-6 py-4 text-left">Client</th>
                <th className="px-6 py-4 text-left">Contact</th>
                <th className="px-6 py-4 text-left">Statut</th>
                <th className="px-6 py-4 text-left">Date</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100">
              {docs.length > 0 ? docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {doc.type === 'devis' && '💰'}
                        {doc.type === 'contrat' && '📋'}
                        {doc.type === 'facture' && '🧾'}
                      </span>
                      <span className="font-medium capitalize">{doc.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-slate-900">{doc.leads?.nom || 'N/A'}</div>
                      <div className="text-sm text-slate-500">{doc.leads?.email || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {doc.leads?.telephone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      doc.statut === 'généré' ? 'bg-green-100 text-green-800' :
                      doc.statut === 'envoyé' ? 'bg-blue-100 text-blue-800' :
                      doc.statut === 'signé' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {doc.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">
                    Aucun document généré pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
