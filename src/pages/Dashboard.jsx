import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('kanban');
  
  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, won: 0, potential: 0 });

  // Refs pour le scroll automatique (optionnel)
  const scrollContainerRef = useRef(null);

  // États pour les flèches de scroll
  const [showLeftArrow, setShowLeftArrow] = useState(true);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollInterval = useRef(null);

  const statuts = ['À traiter', 'Contacté', 'Offre en cours', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

  // Composant ActionBtn pour les actions rapides
  function ActionBtn({ icon, label, color, onClick }) {
    const colors = {
      green: "bg-green-50 text-green-700 hover:bg-green-100",
      blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      purple: "bg-purple-50 text-purple-700 hover:bg-purple-100",
      orange: "bg-orange-50 text-orange-700 hover:bg-orange-100",
    };

    return (
      <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-3 rounded-lg text-xs font-semibold hover:scale-[1.03] transition-all ${colors[color]}`}
      >
        <span className="text-xl mb-1">{icon}</span>
        {label}
      </button>
    );
  }

  // Composant InfoRow pour les informations client
  function InfoRow({ icon, label, value, highlight, badge }) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="text-base">{icon}</span>
          <span className="text-sm">{label}</span>
        </div>

        {badge ? (
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            value === 'À traiter' ? 'bg-gray-100 text-gray-800' :
            value === 'Contacté' ? 'bg-blue-100 text-blue-800' :
            value === 'Offre en cours' ? 'bg-yellow-100 text-yellow-800' :
            value === 'RDV fixé' ? 'bg-orange-100 text-orange-800' :
            value === 'Négociation' ? 'bg-purple-100 text-purple-800' :
            value === 'Gagné' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {value}
          </span>
        ) : (
          <span className={`font-semibold text-sm ${highlight ? "text-green-600" : "text-slate-800"}`}>
            {value}
          </span>
        )}
      </div>
    );
  }

  // Logique de scroll simple et stable type Bitrix24
  const checkScrollOverflow = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const hasOverflow = container.scrollWidth > container.clientWidth;
    const canScrollLeft = container.scrollLeft > 0;
    const canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth;
    
    setShowLeftArrow(hasOverflow && canScrollLeft);
    setShowRightArrow(hasOverflow && canScrollRight);
  };

  const scrollByAmount = (amount) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.scrollBy({
      left: amount,
      behavior: 'smooth'
    });
    
    setTimeout(checkScrollOverflow, 300);
  };

  // Scroll continu au hover
  const startHoverScroll = (direction) => {
    if (scrollInterval.current) return;
    
    scrollInterval.current = setInterval(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      
      const scrollAmount = direction === 'left' ? -8 : 8;
      container.scrollLeft += scrollAmount;
    }, 30);
  };

  const stopHoverScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  // Vérification au chargement et au scroll
  useEffect(() => {
    setTimeout(checkScrollOverflow, 500);
    window.addEventListener('resize', checkScrollOverflow);
    
    return () => {
      window.removeEventListener('resize', checkScrollOverflow);
      stopHoverScroll(); // Nettoyer l'intervalle
    };
  }, []);

  // Fonctions de scroll automatique (optionnel et sécurisé)
  const startScroll = (direction) => {
    if (!scrollContainerRef.current) return;
    
    // Arrêter le scroll précédent
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
    }
    
    // Scroll fluide
    scrollInterval.current = setInterval(() => {
      if (!scrollContainerRef.current) return;
      
      const scrollAmount = 5;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }, 30);
  };

  const stopScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  const handleMouseMove = (e) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    // Zones de 50px sur les côtés
    const leftZone = 50;
    const rightZone = width - 50;
    
    if (x <= leftZone) {
      startScroll('left');
    } else if (x >= rightZone) {
      startScroll('right');
    } else {
      stopScroll();
    }
  };

  const handleMouseLeave = () => {
    stopScroll();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchLeads();
        fetchStats();
      }
    });
  }, []);

  // Nettoyage des intervalles au démontage
  useEffect(() => {
    return () => {
      stopScroll();
    };
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erreur chargement leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: leads } = await supabase
        .from('leads')
        .select('budget, statut');
      if (leads) {
        const total = leads.length;
        const won = leads.filter(l => l.statut === 'Gagné').length;
        const potential = leads.reduce((sum, l) => sum + (l.budget || 0), 0);
        setStats({ total, won, potential });
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const updateStatus = async (leadId, newStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatus } : l));
    await supabase
      .from('leads')
      .update({ statut: newStatus })
      .eq('id', leadId);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Chargement...</div>;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-6 z-40 shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900 hidden md:block">Pipeline</h1>
          <div className="flex gap-2">
             <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">{stats.total} leads</span>
             <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100 hidden sm:block">{stats.potential.toLocaleString()} €</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button 
              onClick={() => setViewMode('kanban')} 
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              📋 Kanban
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              📋 Liste
            </button>
          </div>
          
          <Link to="/stats" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            📊 Stats
          </Link>
          
          <Link to="/documents" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            📂 Documents
          </Link>
          
          <Link to="/settings" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            ⚙️ Settings
          </Link>
          
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            🚪 Déconnexion
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {viewMode === 'kanban' && (
          <div className="p-6 h-full overflow-hidden">
            {/* Flèche gauche fixe */}
            {showLeftArrow && (
              <button
                onClick={() => scrollByAmount(-320)}
                onMouseEnter={() => startHoverScroll('left')}
                onMouseLeave={stopHoverScroll}
                className="fixed left-16 top-1/2 -translate-y-1/2 z-50 w-11 h-11 bg-white/90 hover:bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                style={{ opacity: 0.9 }}
              >
                <span className="text-gray-700 text-lg select-none">◀</span>
              </button>
            )}
            
            {/* Flèche droite fixe */}
            {showRightArrow && (
              <button
                onClick={() => scrollByAmount(320)}
                onMouseEnter={() => startHoverScroll('right')}
                onMouseLeave={stopHoverScroll}
                className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 bg-white/90 hover:bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                style={{ opacity: 0.9 }}
              >
                <span className="text-gray-700 text-lg select-none">▶</span>
              </button>
            )}
            
            <div 
              ref={scrollContainerRef}
              className="p-6 h-full overflow-x-auto overflow-y-hidden"
              onScroll={checkScrollOverflow}
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                whiteSpace: 'nowrap',
                WebkitScrollbar: 'none'
              }}
            >
            <div className="flex gap-6 h-full">
              {statuts.map((statut, idx) => (
                <div key={statut} className="min-w-[320px] max-w-[320px] flex flex-col h-full max-h-[85vh] bg-slate-100/50 rounded-xl border border-slate-200">
                  <div className="p-4 font-bold text-slate-700 bg-white/80 rounded-t-xl flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/50">
                    {statut} 
                    <span className="bg-white text-xs px-2 py-1 rounded-full shadow-sm text-slate-500 border">{leads.filter(l => l.statut === statut).length}</span>
                  </div>
                  
                  <div className="p-3 space-y-3 overflow-y-auto flex-1">
                    {leads.filter(l => l.statut === statut).map(lead => (
                      <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-300 transition">
                        <div className="flex justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded">{lead.type_bien || 'Projet'}</span>
                          <div className="flex gap-1">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 updateStatus(lead.id, statuts[idx+1]);
                               }} 
                               className="w-6 h-6 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-sm"
                             >
                               →
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 updateStatus(lead.id, statuts[idx-1]);
                               }} 
                               className="w-6 h-6 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm"
                             >
                               ←
                             </button>
                          </div>
                        </div>
                        <div className="font-bold text-slate-900 mb-1">{lead.nom}</div>
                        <div className="text-sm text-slate-600 mb-2">{lead.email}</div>
                        <div className="text-sm text-slate-600">{lead.telephone}</div>
                        <div className="text-sm font-bold text-green-600">{(lead.budget || 0).toLocaleString()} €</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="min-w-[50px]"></div>
            </div>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="p-6 h-full overflow-y-auto w-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Score IA</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Budget</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Dernière act.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leads.map(lead => (
                      <tr 
                        key={lead.id} 
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-bold text-slate-900">{lead.nom}</div>
                            <div className="text-xs text-slate-400">{lead.email || '—'}</div>
                            <div className="text-xs text-slate-400">{lead.telephone || '—'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">
                            {lead.type_bien || 'Non défini'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            lead.statut === 'À traiter' ? 'bg-gray-100 text-gray-800' :
                            lead.statut === 'Contacté' ? 'bg-blue-100 text-blue-800' :
                            lead.statut === 'Offre en cours' ? 'bg-yellow-100 text-yellow-800' :
                            lead.statut === 'RDV fixé' ? 'bg-orange-100 text-orange-800' :
                            lead.statut === 'Négociation' ? 'bg-purple-100 text-purple-800' :
                            lead.statut === 'Gagné' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {lead.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {lead.score_ia || lead.ia_score ? (
                            <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${
                              (lead.score_ia || lead.ia_score) < 40 ? 'bg-red-100 text-red-800' :
                              (lead.score_ia || lead.ia_score) < 70 ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {(lead.score_ia || lead.ia_score) < 40 ? '🔴' : 
                               (lead.score_ia || lead.ia_score) < 70 ? '🟠' : '🟢'} {lead.score_ia || lead.ia_score}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          {(lead.budget || 0).toLocaleString('fr-FR')} €
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {(() => {
                            const date = new Date(lead.updated_at || lead.created_at);
                            const now = new Date();
                            const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((now - date) / (1000 * 60 * 60));
                            
                            if (hours < 1) return "il y a <1h";
                            if (hours < 24) return `il y a ${hours}h`;
                            if (diff === 1) return "Hier";
                            if (diff < 7) return `il y a ${diff}j`;
                            if (diff < 30) return `il y a ${Math.floor(diff/7)}s`;
                            return date.toLocaleDateString('fr-FR');
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs rounded bg-slate-50 text-slate-700 border">
                            {lead.source || 'Inconnue'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-1">
                            <a 
                              href={`https://wa.me/${lead.telephone?.replace(/\D/g,'')}`} 
                              target="_blank" 
                              className="text-green-600 hover:text-green-800 p-1"
                              title="WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              💬
                            </a>
                            <a 
                              href={`tel:${lead.telephone}`} 
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Appeler"
                              onClick={(e) => e.stopPropagation()}
                            >
                              📞
                            </a>
                            <button 
                              className="text-indigo-600 hover:text-indigo-800 p-1"
                              title="Documents"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                              }}
                            >
                              📄
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedLead.nom}</h2>
                  <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    ✕
                  </button>
                </div>

                {/* Zone 1 - Actions rapides */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                  <ActionBtn 
                    icon="💬" 
                    label="WhatsApp" 
                    color="green" 
                    onClick={() => window.open(`https://wa.me/${selectedLead.telephone?.replace(/\D/g,'')}`, '_blank')}
                  />
                  <ActionBtn 
                    icon="📞" 
                    label="Appeler" 
                    color="blue" 
                    onClick={() => window.open(`tel:${selectedLead.telephone}`, '_blank')}
                  />
                  <ActionBtn 
                    icon="📅" 
                    label="RDV" 
                    color="purple" 
                    onClick={() => {}}
                  />
                  <ActionBtn 
                    icon="✉️" 
                    label="Email" 
                    color="orange" 
                    onClick={() => window.open(`mailto:${selectedLead.email}`, '_blank')}
                  />
                </div>

                {/* Zone 2 - Informations client */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                  <InfoRow icon="📧" label="Email" value={selectedLead.email || '—'} />
                  <InfoRow icon="📱" label="Téléphone" value={selectedLead.telephone || '—'} />
                  <InfoRow icon="💰" label="Budget" value={`${(selectedLead.budget || 0).toLocaleString('fr-FR')} €`} highlight />
                  <InfoRow icon="📌" label="Statut" value={selectedLead.statut} badge />
                  <InfoRow icon="🏠" label="Type de bien" value={selectedLead.type_bien || 'Non défini'} />
                  {selectedLead.score_ia && (
                    <InfoRow icon="🧠" label="Score IA" value={`${selectedLead.score_ia}/100`} highlight />
                  )}
                  {selectedLead.source && (
                    <InfoRow icon="🌐" label="Source" value={selectedLead.source} />
                  )}
                </div>
              </div>

              {/* Zone 3 - Actions avancées */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Actions avancées</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center gap-3 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 font-medium transition-colors">
                    📄 Documents
                  </button>
                  <button className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 font-medium transition-colors">
                    🧠 Suggestion IA
                  </button>
                  <button className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg text-green-700 font-medium transition-colors">
                    📋 Historique
                  </button>
                  <button className="flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 rounded-lg text-orange-700 font-medium transition-colors">
                    ✏️ Modifier
                  </button>
                </div>

                {/* Timeline */}
                <div className="mt-6">
                  <h3 className="font-bold text-slate-900 mb-4">Historique</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">Création du lead</div>
                        <div className="text-xs text-slate-500">
                          {new Date(selectedLead.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    {selectedLead.updated_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">Dernière modification</div>
                          <div className="text-xs text-slate-500">
                            {new Date(selectedLead.updated_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
