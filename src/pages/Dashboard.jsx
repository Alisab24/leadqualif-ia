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

  // --- MOTEUR DE SCROLL BITRIX (Auto-Scroll) ---
  const scrollContainerRef = useRef(null);
  const scrollInterval = useRef(null);

  const startScroll = (direction) => {
    stopScroll(); // Reset avant de lancer
    scrollInterval.current = setInterval(() => {
      if (scrollContainerRef.current) {
        // Vitesse de défilement (ajuster le 25 si trop rapide)
        scrollContainerRef.current.scrollLeft += direction === 'right' ? 25 : -25;
      }
    }, 16); // ~60 FPS
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
    // CONTAINER PRINCIPAL FIXE (Ne scrolle pas globalement)
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 1. HEADER FIXE (Reste toujours en haut) */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 z-20 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Pipeline <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{stats.total} leads</span>
          </h1>
          <p className="text-sm text-green-600 font-bold mt-1">Potentiel : {stats.potential.toLocaleString()} €</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button 
              onClick={() => setViewMode('kanban')} 
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'kanban' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              📊 Tableau
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              📝 Liste
            </button>
          </div>
          <Link 
            to={agencyId ? `/estimation/${agencyId}` : '/estimation'} 
            target="_blank" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow font-bold hover:bg-blue-700 transition"
          >
            + Nouveau
          </Link>
        </div>
      </header>

      {/* 2. ZONE DE CONTENU (C'est ici que ça scrolle) */}
      <main className="flex-1 relative overflow-hidden">
        
        {/* VUE KANBAN AVEC SCROLL INTELLIGENT */}
        {viewMode === 'kanban' && (
          <div className="h-full relative">
            
            {/* --- ZONES ACTIVES DE SCROLL (Moteur Invisible + Flèches Visibles) --- */}
            
            {/* ZONE GAUCHE */}
            <div 
              onMouseEnter={() => startScroll('left')} 
              onMouseLeave={stopScroll}
              className="absolute left-0 top-0 bottom-0 w-20 z-30 flex items-center justify-start pl-2 hover:bg-gradient-to-r from-slate-900/10 to-transparent cursor-pointer group transition-all"
            >
              <button className="w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-blue-600 border border-slate-100 hover:scale-110 transition active:scale-95">
                ⬅️
              </button>
            </div>
            
            {/* ZONE DROITE */}
            <div 
              onMouseEnter={() => startScroll('right')} 
              onMouseLeave={stopScroll}
              className="absolute right-0 top-0 bottom-0 w-20 z-30 flex items-center justify-end pr-2 hover:bg-gradient-to-l from-slate-900/10 to-transparent cursor-pointer group transition-all"
            >
              <button className="w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-blue-600 border border-slate-100 hover:scale-110 transition active:scale-95">
                ➡️
              </button>
            </div>
            
            {/* LE TABLEAU (Scrollable) */}
            <div 
              ref={scrollContainerRef}
              className="flex h-full overflow-x-auto overflow-y-hidden gap-6 p-6 scroll-smooth no-scrollbar items-start"
            >
              {statuts.map((statut, idx) => (
                <div key={statut} className="min-w-[320px] max-w-[320px] flex flex-col h-full bg-slate-100/50 rounded-xl border border-slate-200 max-h-[85vh]">
                  {/* Header Colonne */}
                  <div className="p-4 font-bold text-slate-700 bg-white/60 rounded-t-xl flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/50">
                    {statut} 
                    <span className="bg-white text-xs px-2 py-1 rounded-full shadow-sm text-slate-500 border">{leads.filter(l => l.statut === statut).length}</span>
                  </div>
                  
                  {/* Cartes (Scroll Vertical interne) */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {leads.filter(l => l.statut === statut).map(lead => (
                      <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-300 transition group relative">
                        
                        {/* Badges */}
                        <div className="flex justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded">{lead.type_bien || 'Projet'}</span>
                          {lead.score > 0 && (
                            <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded">⚡ {lead.score}%</span>
                          )}
                        </div>
                        
                        <h4 className="font-bold text-slate-900 mb-1">{lead.nom}</h4>
                        <p className="text-sm text-slate-500 font-medium">{(lead.budget || 0).toLocaleString()} €</p>
                        
                        {/* Navigation Carte (Apparaît au survol) */}
                        <div className="absolute inset-y-0 left-0 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx > 0 && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(lead.id, statuts[idx-1]);
                              }} 
                              className="w-6 h-6 bg-white shadow-md rounded-full text-slate-400 hover:text-blue-600 flex items-center justify-center -ml-3 text-xs border"
                            >
                              ◀
                            </button>
                          )}
                        </div>
                        <div className="absolute inset-y-0 right-0 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx < statuts.length - 1 && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(lead.id, statuts[idx+1]);
                              }} 
                              className="w-6 h-6 bg-white shadow-md rounded-full text-blue-600 hover:text-blue-700 flex items-center justify-center -mr-3 text-xs border"
                            >
                              ▶
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

        {/* VUE LISTE (Simple table) */}
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

        {/* MODALE DÉTAIL (Toujours là) */}
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
