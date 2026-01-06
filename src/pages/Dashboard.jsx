import React, { useState, useEffect, useRef } from 'react';
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

  // Configs
  const [calendlyLink, setCalendlyLink] = useState(null);
  const [agencyId, setAgencyId] = useState(null);
  const [viewMode, setViewMode] = useState('kanban');

  // --- BITRIX SCROLL ENGINE (Corrected) ---
  const scrollContainerRef = useRef(null);
  const scrollInterval = useRef(null);

  const startScroll = (direction) => {
    stopScroll();
    scrollInterval.current = setInterval(() => {
      if (scrollContainerRef.current) {
        // Speed: 25px per frame
        scrollContainerRef.current.scrollLeft += direction === 'right' ? 25 : -25;
      }
    }, 16);
  };

  const stopScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  // --- DATA ---
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
      
      if (profile) {
        setAgencyId(profile.agency_id);
        setCalendlyLink(profile.calendly_link);
      }

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
    await supabase
      .from('leads')
      .update({ statut: newStatus })
      .eq('id', leadId);
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
    // FIXED CONTAINER
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 1. HEADER (Fixed height, no shrink) */}
      <header className="flex-none h-20 bg-white border-b border-slate-200 px-6 z-20 shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 hidden md:block">Pipeline</h1>
          <div className="flex gap-2">
             <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold border border-blue-100">{stats.total} leads</span>
             <span className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm font-bold border border-green-100 hidden sm:block">{stats.potential.toLocaleString()} €</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button 
              onClick={() => setViewMode('kanban')} 
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'kanban' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
              📊
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
              📝
            </button>
          </div>
          <Link 
            to={agencyId ? `/estimation/${agencyId}` : '/estimation'} 
            target="_blank" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow font-bold hover:bg-blue-700 whitespace-nowrap"
          >
            + Lead
          </Link>
        </div>
      </header>

      {/* 2. SCROLLABLE AREA */}
      <main className="flex-1 relative overflow-hidden">
        
        {viewMode === 'kanban' && (
          <div className="h-full relative">
            
            {/* --- AUTO-SCROLL ZONES (High Z-Index) --- */}
            
            {/* LEFT ZONE */}
            <div 
              onMouseEnter={() => startScroll('left')} 
              onMouseLeave={stopScroll}
              className="absolute left-0 top-0 bottom-0 w-24 z-50 flex items-center justify-start pl-2 cursor-pointer transition-all hover:bg-gradient-to-r from-black/10 to-transparent group"
            >
              {/* Always visible arrow on hover */}
              <div className="w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-blue-600 border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">
                ⬅️
              </div>
            </div>
            
            {/* RIGHT ZONE */}
            <div 
              onMouseEnter={() => startScroll('right')} 
              onMouseLeave={stopScroll}
              className="absolute right-0 top-0 bottom-0 w-24 z-50 flex items-center justify-end pr-2 cursor-pointer transition-all hover:bg-gradient-to-l from-black/10 to-transparent group"
            >
              <div className="w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-blue-600 border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">
                ➡️
              </div>
            </div>
            
            {/* KANBAN BOARD */}
            <div 
              ref={scrollContainerRef}
              className="flex h-full overflow-x-auto overflow-y-hidden gap-6 p-6 scroll-smooth no-scrollbar items-start"
            >
              {statuts.map((statut, idx) => (
                <div key={statut} className="min-w-[320px] max-w-[320px] flex flex-col h-full bg-slate-100/50 rounded-xl border border-slate-200 max-h-[85vh]">
                  {/* Column Header */}
                  <div className="p-4 font-bold text-slate-700 bg-white/60 rounded-t-xl flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/50">
                    {statut} 
                    <span className="bg-white text-xs px-2 py-1 rounded-full shadow-sm text-slate-500 border">{leads.filter(l => l.statut === statut).length}</span>
                  </div>
                  
                  {/* Cards List */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {leads.filter(l => l.statut === statut).map(lead => (
                      <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-300 transition group relative">
                        
                        <div className="flex justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded">{lead.type_bien || 'Projet'}</span>
                          {lead.score > 0 && (
                            <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded">⚡ {lead.score}%</span>
                          )}
                        </div>
                        
                        <h4 className="font-bold text-slate-900 mb-1">{lead.nom}</h4>
                        <p className="text-sm text-slate-500 font-medium">{(lead.budget || 0).toLocaleString()} €</p>
                        
                        {/* Card Navigation (Inside Card) */}
                        <div className="absolute inset-y-0 right-2 flex flex-col justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           {idx < statuts.length - 1 && (
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 updateStatus(lead.id, statuts[idx+1]);
                               }} 
                               className="w-6 h-6 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-sm"
                             >
                               ▶
                             </button>
                           )}
                           {idx > 0 && (
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 updateStatus(lead.id, statuts[idx-1]);
                               }} 
                               className="w-6 h-6 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm"
                             >
                               ◀
                             </button>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="p-6 h-full overflow-y-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leads.map(lead => (
                    <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-6 py-4 font-bold text-slate-700">{lead.nom}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{lead.statut}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-green-600">{(lead.budget || 0).toLocaleString()} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL */}
        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-8 overflow-y-auto animate-slide-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{selectedLead.nom}</h2>
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-8">
                <a href={`https://wa.me/${selectedLead.telephone?.replace(/\D/g,'')}`} target="_blank" className="flex flex-col items-center p-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200">
                  <span className="text-2xl">💬</span><span className="font-bold text-xs mt-1">WhatsApp</span>
                </a>
                <a href={`tel:${selectedLead.telephone}`} className="flex flex-col items-center p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 border border-blue-200">
                  <span className="text-2xl">📞</span><span className="font-bold text-xs mt-1">Appeler</span>
                </a>
                <a href={calendlyLink || '#'} target="_blank" className="flex flex-col items-center p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 border border-purple-200">
                  <span className="text-2xl">📅</span><span className="font-bold text-xs mt-1">RDV</span>
                </a>
              </div>
              <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-4">Documents</h3>
                <DocumentManager lead={selectedLead} agencyId={session?.user?.id} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
