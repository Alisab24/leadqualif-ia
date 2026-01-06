import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const fetchDocs = async () => {
      const { data } = await supabase.from('documents').select('*, leads(nom)').order('created_at', {ascending: false});
      if(data) setDocs(data);
    };
    fetchDocs();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">📂 Centre de Documents</h1>
          <p className="text-slate-600">Gérez, archivez et suivez tous vos contrats et propositions.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-lg text-slate-800">Historique complet</h3>
            <input 
              type="text" 
              placeholder="Rechercher un document..." 
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white" 
            />
          </div>
          
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-4 text-left">Type</th>
                <th className="px-6 py-4 text-left">Client associé</th>
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Statut</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100">
              {docs.length > 0 ? docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition group cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center font-bold text-xs border border-red-100">
                      PDF
                    </div>
                    <span className="font-bold text-slate-700">{doc.type}</span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">
                      {doc.leads?.nom || 'Lead supprimé'}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(doc.created_at).toLocaleDateString()} 
                    <span className="text-xs text-slate-400">à {new Date(doc.created_at).toLocaleTimeString().slice(0,5)}</span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-xs font-bold rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                      {doc.status || 'Généré'}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm border border-blue-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      Voir 👁️
                    </button>
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
