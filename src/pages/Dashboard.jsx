import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import DocumentManager from '../components/DocumentManager'; // Ensure this exists

export default function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, won: 0, potential: 0 });

  // Configs
  const [calendlyLink, setCalendlyLink] = useState(null);
  const [agencyId, setAgencyId] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'

  // --- BITRIX SCROLL ENGINE ---
  const scrollContainerRef = useRef(null);

  // --- DATA LOADING ---
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
      // 1. Get Profile & Settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, calendly_link')
        .eq('user_id', userId)
        .single();

      if (profile?.agency_id) setAgencyId(profile.agency_id);
      if (profile?.calendly_link) setCalendlyLink(profile.calendly_link);

      // 2. Get Leads
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profile?.agency_id) {
        query = query.eq('agency_id', profile.agency_id);
      }
      
      const { data } = await query;
      if (data) {
        setLeads(data);
        // Calculate Header Stats locally
        setStats({
          total: data.length,
          won: data.filter(l => l.statut === 'Gagné' || l.statut === 'Vendu').length,
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
    // Optimistic UI Update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatus } : l));
    await supabase
      .from('leads')
      .update({ statut: newStatus })
      .eq('id', leadId);
  };

  const getGoogleCalendarLink = (lead) => {
    const title = encodeURIComponent(`RDV avec ${lead.nom}`);
    const details = encodeURIComponent(`Projet: ${lead.type_bien || 'Immo'}\nTel: ${lead.telephone}\nBudget: ${lead.budget}€`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
  };

  const statuts = ['À traiter', 'Contacté', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Chargement du dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="flex-1 p-6 overflow-x-hidden">
        {/* HEADER */}
        <header className="flex flex-wrap gap-4 mb-8">
          <div className="flex-1 min-w-[300px]">
            <h1 className="text-3xl font-bold text-slate-900">Pipeline Commercial</h1>
            <div className="flex gap-3 text-sm mt-2">
              <span className="bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-200">📄 <b>{stats.total}</b> Leads</span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-lg shadow-sm border border-green-200">💰 <b>{stats.potential.toLocaleString()} €</b> Potentiel</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
              <button 
                onClick={() => setViewMode('kanban')} 
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'kanban' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
              >
                📊 Kanban
              </button>
              <button 
                onClick={() => setViewMode('list')} 
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
              >
                📝 Liste
              </button>
            </div>
            <Link 
              to={agencyId ? `/estimation/${agencyId}` : '/estimation'} 
              target="_blank"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-lg transition font-bold"
            >
              + Nouveau Lead
            </Link>
          </div>
        </header>

        {/* VUE KANBAN (Bitrix Style) */}
        {viewMode === 'kanban' && (
          <div className="relative group/board">
            {/* BOUTONS DE SCROLL VISIBLES */}
            <button
              onClick={() => scrollContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-40 bg-white shadow-xl rounded-full w-12 h-12 flex items-center justify-center cursor-pointer border border-slate-200 text-2xl hover:scale-110 transition-transform"
            >
              ⬅️
            </button>
            <button
              onClick={() => scrollContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-40 bg-white shadow-xl rounded-full w-12 h-12 flex items-center justify-center cursor-pointer border border-slate-200 text-2xl hover:scale-110 transition-transform"
            >
              ➡️
            </button>

            <div 
              ref={scrollContainerRef} 
              className="flex overflow-x-auto pb-8 gap-6 min-h-[70vh] scroll-smooth no-scrollbar px-2"
            >
              {statuts.map((statut, idx) => (
                <div key={statut} className="min-w-[320px] flex flex-col bg-slate-100/80 rounded-2xl border border-slate-200/60 backdrop-blur-sm">
                  {/* Column Header */}
                  <div className="p-4 font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center bg-white/50 rounded-t-2xl sticky top-0 z-10">
                    {statut} 
                    <span className="bg-slate-200 text-xs px-2.5 py-1 rounded-full text-slate-600">
                      {leads.filter(l => l.statut === statut).length}
                    </span>
                  </div>
                  
                  {/* Cards Container */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {leads.filter(l => l.statut === statut).map(lead => (
                      <div 
                        key={lead.id} 
                        onClick={() => setSelectedLead(lead)} 
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all relative group"
                      >
                        {/* Tags */}
                        <div className="flex justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded tracking-wide">
                            {lead.type_bien || 'Projet'}
                          </span>
                          {lead.score > 0 && (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 ${lead.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              ⚡ {lead.score}%
                            </span>
                          )}
                        </div>
                        {/* Content */}
                        <h4 className="font-bold text-slate-900 mb-1">{lead.nom}</h4>
                        <p className="text-sm text-slate-500 font-medium">{(lead.budget || 0).toLocaleString()} €</p>
                        
                        {/* FLOATING NAVIGATION ARROWS (Bitrix Style) */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {idx > 0 ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(lead.id, statuts[idx-1]);
                              }} 
                              className="w-8 h-8 -ml-3 bg-white shadow-lg rounded-full text-slate-400 hover:text-blue-600 flex items-center justify-center pointer-events-auto hover:scale-110 transition border border-slate-100"
                            >
                              ◀
                            </button>
                          ) : <div />}
                          {idx < statuts.length - 1 ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(lead.id, statuts[idx+1]);
                              }} 
                              className="w-8 h-8 -mr-3 bg-white shadow-lg rounded-full text-blue-600 hover:text-blue-700 flex items-center justify-center pointer-events-auto hover:scale-110 transition border border-slate-100"
                            >
                              ▶
                            </button>
                          ) : <div />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VUE LISTE */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Budget</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leads.map(lead => (
                  <tr 
                    key={lead.id} 
                    onClick={() => setSelectedLead(lead)} 
                    className="hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 font-bold text-slate-700">{lead.nom}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                        {lead.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-green-600">{(lead.budget || 0).toLocaleString()} €</td>
                    <td className="px-6 py-4 text-right text-slate-400 text-sm">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL DETAIL */}
        {selectedLead && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/30 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-8 overflow-y-auto animate-slide-in">
              
              {/* Header Modal */}
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{selectedLead.nom}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Lead ajouté le {new Date(selectedLead.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLead(null)} 
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition"
                >
                  ✕
                </button>
              </div>

              {/* ACTION BUTTONS (The Grid) */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <a 
                  href={`https://wa.me/${selectedLead.telephone?.replace(/\D/g,'')}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex flex-col items-center justify-center p-4 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200 transition group"
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition">💬</span>
                  <span className="font-bold text-xs">WhatsApp</span>
                </a>
                <a 
                  href={`tel:${selectedLead.telephone}`} 
                  className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 border border-blue-200 transition group"
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition">📞</span>
                  <span className="font-bold text-xs">Appeler</span>
                </a>
                <a 
                  href={calendlyLink || getGoogleCalendarLink(selectedLead)} 
                  target="_blank" 
                  rel="noreferrer" 
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition group ${
                    calendlyLink 
                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' 
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition">
                    {calendlyLink ? '📅' : '📆'}
                  </span>
                  <span className="font-bold text-xs">
                    {calendlyLink ? 'Calendly' : 'Google Cal'}
                  </span>
                </a>
              </div>

              {/* Lead Infos */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email</p>
                  <p className="font-medium text-slate-800 break-all">{selectedLead.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Téléphone</p>
                  <p className="font-medium text-slate-800">{selectedLead.telephone}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Budget</p>
                  <p className="font-bold text-green-600 text-lg">{selectedLead.budget?.toLocaleString()} €</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Projet</p>
                  <p className="font-medium text-slate-800">{selectedLead.type_bien}</p>
                </div>
                {selectedLead.message && (
                  <div className="col-span-2 mt-2 pt-4 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Message</p>
                    <p className="text-slate-600 italic">"{selectedLead.message}"</p>
                  </div>
                )}
              </div>

              {/* DOCUMENTS MODULE */}
              <div className="border-t border-slate-100 pt-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">📂</span>
                  <h3 className="font-bold text-lg text-slate-800">Documents & Contrats</h3>
                </div>
                <DocumentManager lead={selectedLead} agencyId={session?.user?.id} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
