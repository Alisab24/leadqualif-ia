import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, signed: 0, offers: 0, pending: 0 });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // On récupère les docs + le nom du lead associé
      const { data, error } = await supabase
        .from('documents')
        .select('*, leads (nom)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setDocs(data);
        // Calcul des stats
        setStats({
          total: data.length,
          signed: data.filter(d => d.status === 'Signé').length,
          offers: data.filter(d => d.type.includes('Offre') || d.type.includes('Devis')).length,
          pending: data.filter(d => d.status === 'Généré' || d.status === 'Envoyé').length
        });
      }
    } catch (error) {
      console.error('Erreur chargement docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Signé': return 'bg-green-100 text-green-700 border-green-200';
      case 'Envoyé': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  if (loading) return 'Chargement de la bibliothèque...';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* EN-TÊTE */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Centre de Documents</h1>
          <p className="text-slate-500 mt-1">Gérez, archivez et suivez tous vos contrats et propositions.</p>
        </div>
        <button 
          onClick={fetchDocuments} 
          className="p-2 bg-white text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* STATISTIQUES (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {/* Carte 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Documents</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">📂</div>
        </div>
        
        {/* Carte 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Contrats Signés</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stats.signed}</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl">✅</div>
        </div>
        
        {/* Carte 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Offres & Devis</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{stats.offers}</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-2xl">💰</div>
        </div>
        
        {/* Carte 4 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">À Traiter</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{stats.pending}</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl">⏳</div>
        </div>
      </div>

      {/* LISTE DES DOCUMENTS (TABLEAU) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                {/* Type + Icone */}
                <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center font-bold text-xs border border-red-100">
                    PDF
                  </div>
                  <span className="font-bold text-slate-700">{doc.type}</span>
                </td>
                
                {/* Client */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900">
                    {doc.leads?.nom || 'Lead supprimé'}
                  </div>
                </td>
                
                {/* Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {new Date(doc.created_at).toLocaleDateString()} 
                  <span className="text-xs text-slate-400">à {new Date(doc.created_at).toLocaleTimeString().slice(0,5)}</span>
                </td>
                
                {/* Statut */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(doc.status)}`}>
                    {doc.status}
                  </span>
                </td>
                
                {/* Actions */}
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
  );
}
