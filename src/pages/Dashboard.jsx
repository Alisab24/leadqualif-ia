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
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' ou 'list'

  // 1. AUTH & DATA
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, calendly_link')
        .eq('user_id', userId)
        .single();

      if (profile?.calendly_link) setCalendlyLink(profile.calendly_link);
      
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (profile?.agency_id) query = query.eq('agency_id', profile.agency_id);
      
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

  const updateStatus = async (leadId, newStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatus } : l));
    await supabase.from('leads').update({ statut: newStatus }).eq('id', leadId);
  };

  const statuts = ['À traiter', 'Contacté', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

  // Générateur de lien Google Calendar (Fallback)
  const getGoogleCalendarLink = (lead) => {
    const title = encodeURIComponent(`RDV avec ${lead.nom}`);
    const details = encodeURIComponent(`Projet: ${lead.type_bien}\nTel: ${lead.telephone}\nBudget: ${lead.budget}€`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-slate-500">Chargement...</div></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <main className="max-w-7xl mx-auto">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Pipeline Commercial</h1>
            <p className="text-slate-500">{stats.total} leads • <span className="font-bold text-green-600">{stats.potential.toLocaleString()} €</span> potentiel</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Toggle Vue */}
            <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
              <button 
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'kanban' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                📊 Kanban
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                📝 Liste
              </button>
            </div>
            <Link to="/estimation" target="_blank" className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 font-medium">+ Nouveau Lead</Link>
          </div>
        </header>

        {/* VUE KANBAN */}
        {viewMode === 'kanban' && (
          <div className="flex overflow-x-auto pb-6 gap-6 min-h-[70vh]">
            {statuts.map((statut, idx) => (
              <div key={statut} className="min-w-[300px] flex flex-col bg-slate-100/50 rounded-xl border border-slate-200">
                <div className="p-4 font-bold text-slate-700 bg-white/60 rounded-t-xl flex justify-between sticky top-0 backdrop-blur-sm z-10">
                  {statut} <span className="bg-slate-200 text-xs px-2 py-1 rounded-full">{leads.filter(l => l.statut === statut).length}</span>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                  {leads.filter(l => l.statut === statut).map(lead => (
                    <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition relative group">
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{lead.type_bien || 'Projet'}</span>
                        {lead.score > 0 && <span className="text-xs font-bold text-green-600">⚡ {lead.score}%</span>}
                      </div>
                      <h4 className="font-bold text-slate-900 truncate">{lead.nom}</h4>
                      <p className="text-sm text-slate-500 mb-3">{(lead.budget || 0).toLocaleString()} €</p>
                      <div className="flex justify-between pt-2 border-t border-slate-50 mt-2" onClick={e => e.stopPropagation()}>
                        {idx > 0 ? <button onClick={() => updateStatus(lead.id, statuts[idx-1])} className="text-slate-400 hover:text-blue-600 px-2">⬅️</button> : <div/>}
                        {idx < statuts.length - 1 ? <button onClick={() => updateStatus(lead.id, statuts[idx+1])} className="text-blue-600 hover:text-blue-800 px-2">➡️</button> : <div/>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VUE LISTE (Restaurée) */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Projet</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leads.map((lead) => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-slate-50 cursor-pointer transition">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{lead.nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700">{lead.statut}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{lead.type_bien}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{(lead.budget || 0).toLocaleString()} €</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">Voir →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODALE DÉTAIL */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-8 overflow-y-auto animate-slide-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{selectedLead.nom}</h2>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
              </div>

              {/* BARRE D'ACTIONS RAPIDES */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <a href={`tel:${selectedLead.telephone}`} className="flex flex-col items-center justify-center p-4 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200 transition">
                  <span className="text-2xl mb-1">�</span><span className="font-bold text-sm">Appeler</span>
                </a>
                <a href={`mailto:${selectedLead.email}`} className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 border border-blue-200 transition">
                  <span className="text-2xl mb-1">📧</span><span className="font-bold text-sm">Email</span>
                </a>
                
                {/* LOGIQUE RDV INTELLIGENTE */}
                <a 
                  href={calendlyLink || getGoogleCalendarLink(selectedLead)} 
                  target="_blank" 
                  rel="noreferrer"
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition ${calendlyLink ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
                >
                  <span className="text-2xl mb-1">{calendlyLink ? '📅' : '📆'}</span>
                  <span className="font-bold text-sm">{calendlyLink ? 'Calendly' : 'Google Cal'}</span>
                </a>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div><p className="text-xs font-bold text-slate-400 uppercase">Email</p><p className="font-medium">{selectedLead.email}</p></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase">Tel</p><p className="font-medium">{selectedLead.telephone}</p></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase">Budget</p><p className="font-bold text-green-600">{selectedLead.budget?.toLocaleString()} €</p></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase">Délai</p><p className="font-medium">{selectedLead.delai || 'Non défini'}</p></div>
              </div>
              
              {selectedLead.message && <div className="mb-8 p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-slate-700 italic">"{selectedLead.message}"</div>}
              
              <div className="border-t border-slate-100 pt-8">
                <h3 className="font-bold text-xl text-slate-800 mb-4 flex items-center gap-2">📂 Documents & Historique</h3>
                <DocumentManager lead={selectedLead} agencyId={session?.user?.id} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}