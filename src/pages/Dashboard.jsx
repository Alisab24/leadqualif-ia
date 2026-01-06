import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import DocumentManager from '../components/DocumentManager';

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, won: 0, potential: 0 });
  const [calendlyLink, setCalendlyLink] = useState(null);

  // --- 1. AUTH & CHARGEMENT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchLeads(session.user.id);
      else navigate('/');
    });
  }, [navigate]);

  const fetchLeads = async (userId) => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('agency_id, calendly_link').eq('user_id', userId).single();
      
      // Stocker le lien Calendly
      if (profile?.calendly_link) {
        setCalendlyLink(profile.calendly_link);
      }
      
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      
      if (profile?.agency_id) {
        query = query.eq('agency_id', profile.agency_id);
      }

      const { data, error } = await query;
      if (data) {
        setLeads(data);
        setStats({
          total: data.length,
          won: data.filter(l => l.statut === 'Gagné').length,
          potential: data.reduce((acc, l) => acc + (l.budget || 0), 0)
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. ACTIONS ---
  const updateStatus = async (leadId, newStatus) => {
    // Mise à jour optimiste (visuel immédiat)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatus } : l));
    // Envoi BDD
    await supabase.from('leads').update({ statut: newStatus }).eq('id', leadId);
  };

  const statuts = ['À traiter', 'Contacté', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

  // --- 3. RENDER ---
  if (loading) return <div className="flex h-screen items-center justify-center">Chargement...</div>;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <main className="flex-1 p-6 overflow-x-hidden">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Pipeline Commercial</h1>
            <p className="text-slate-500">{stats.total} leads • <span className="font-bold text-green-600">{stats.potential.toLocaleString()} €</span> potentiel</p>
          </div>
          <div className="flex gap-3">
            <Link to="/estimation" target="_blank" className="px-4 py-2 bg-white border rounded shadow hover:bg-gray-50">+ Nouveau Lead</Link>
            <button onClick={() => window.location.reload()} className="p-2 bg-blue-600 text-white rounded shadow">🔄</button>
          </div>
        </header>

        {/* KANBAN BOARD */}
        <div className="flex overflow-x-auto pb-6 gap-6 min-h-[70vh]">
          {statuts.map((statut, idx) => (
            <div key={statut} className="min-w-[300px] flex flex-col bg-slate-100/50 rounded-xl border border-slate-200">
              <div className="p-4 font-bold text-slate-700 bg-white/60 rounded-t-xl flex justify-between">
                {statut} 
                <span className="bg-slate-200 text-xs px-2 py-1 rounded-full">{leads.filter(l => l.statut === statut).length}</span>
              </div>
              
              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {leads.filter(l => l.statut === statut).map(lead => (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition relative group">
                    
                    {/* Tags */}
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{lead.type_bien || 'Projet'}</span>
                      {lead.score > 0 && <span className="text-xs font-bold text-green-600">⚡ {lead.score}%</span>}
                    </div>

                    {/* Contenu */}
                    <h4 className="font-bold text-slate-900 truncate">{lead.nom}</h4>
                    <p className="text-sm text-slate-500 mb-3">{(lead.budget || 0).toLocaleString()} €</p>
                    
                    {/* Flèches Navigation (Footer Carte) */}
                    <div className="flex justify-between pt-2 border-t border-slate-50 mt-2" onClick={e => e.stopPropagation()}>
                      {idx > 0 ? (
                        <button onClick={() => updateStatus(lead.id, statuts[idx-1])} className="text-slate-400 hover:text-blue-600 text-lg px-2">⬅️</button>
                      ) : <div/>}
                      
                      {idx < statuts.length - 1 ? (
                        <button onClick={() => updateStatus(lead.id, statuts[idx+1])} className="text-blue-600 hover:text-blue-800 text-lg px-2">➡️</button>
                      ) : <div/>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* MODALE DETAILS */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-8 overflow-y-auto animate-slide-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{selectedLead.nom}</h2>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
              </div>
              
              {/* BARRE D'ACTIONS RAPIDES */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* WhatsApp */}
                <a 
                  href={`https://wa.me/${selectedLead.telephone?.replace(/\D/g,'')}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center p-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition border border-green-200 shadow-sm"
                >
                  <span className="text-2xl mb-1">💬</span>
                  <span className="text-xs font-bold">WhatsApp</span>
                </a>
                
                {/* Email */}
                <a 
                  href={`mailto:${selectedLead.email}`}
                  className="flex flex-col items-center justify-center p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition border border-blue-200 shadow-sm"
                >
                  <span className="text-2xl mb-1">📧</span>
                  <span className="text-xs font-bold">Email</span>
                </a>
                
                {/* Calendly (Seulement si lien configuré) */}
                {calendlyLink ? (
                  <a 
                    href={calendlyLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition border border-purple-200 shadow-sm"
                  >
                    <span className="text-2xl mb-1">📅</span>
                    <span className="text-xs font-bold">Prendre RDV</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 bg-gray-50 text-gray-400 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-2xl mb-1">📅</span>
                    <span className="text-xs font-bold">RDV</span>
                  </div>
                )}
              </div>
              
              {/* Infos Clés */}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div><p className="text-xs text-slate-400 uppercase">Email</p><p className="font-medium">{selectedLead.email}</p></div>
                <div><p className="text-xs text-slate-400 uppercase">Téléphone</p><p className="font-medium">{selectedLead.telephone}</p></div>
                <div><p className="text-xs text-slate-400 uppercase">Budget</p><p className="font-bold text-green-600 text-lg">{selectedLead.budget?.toLocaleString()} €</p></div>
                <div><p className="text-xs text-slate-400 uppercase">Délai</p><p className="font-medium">{selectedLead.delai || 'Non défini'}</p></div>
              </div>
              
              {/* Message */}
              {selectedLead.message && (
                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-slate-700 italic">
                  "{selectedLead.message}"
                </div>
              )}

              {/* SECTION DOCUMENTS */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">📂</span>
                  <h3 className="font-bold text-xl text-slate-800">Gestion Documentaire</h3>
                </div>
                {/* Intégration du composant documents */}
                <DocumentManager lead={selectedLead} agencyId={session?.user?.id} />
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}