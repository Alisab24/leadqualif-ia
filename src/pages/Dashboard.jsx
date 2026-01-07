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
  const scrollInterval = useRef(null);

  const statuts = ['À traiter', 'Contacté', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

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
          <div 
            ref={scrollContainerRef}
            className="p-6 h-full overflow-x-auto"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
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
        )}

        {viewMode === 'list' && (
          <div className="p-6 h-full overflow-y-auto w-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
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

        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-8 overflow-y-auto">
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
                <a href="#" className="flex flex-col items-center p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 border border-purple-200">
                  <span className="text-2xl">📅</span><span className="font-bold text-xs mt-1">RDV</span>
                </a>
              </div>

              {/* Actions pro - UI enrichie */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <a 
                  href={`mailto:${selectedLead.email || ''}?subject=Suivi de votre projet immobilier&body=Bonjour ${selectedLead.nom || ''},%0D%0A%0D%0AJe vous contacte concernant votre projet immobilier.%0D%0A%0D%0AN'hésitez pas à me faire savoir vos disponibilités pour en discuter.%0D%0A%0D%0ACordialement,%0D%0A[Votre nom]`}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-colors ${
                    selectedLead.email 
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200' 
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <span className="text-2xl">✉️</span>
                  <span className="font-bold text-xs mt-1">Email</span>
                </a>
                
                <button 
                  onClick={() => {
                    // TODO: Ouvrir panneau documents
                    console.log('Documents button clicked');
                  }}
                  className="flex flex-col items-center p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 border border-indigo-200"
                >
                  <span className="text-2xl">📄</span>
                  <span className="font-bold text-xs mt-1">Documents</span>
                </button>
                
                <button 
                  onClick={() => {
                    // TODO: Afficher suggestion IA
                    console.log('IA suggestion button clicked');
                  }}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-colors ${
                    selectedLead.score_ia || selectedLead.ia_score
                      ? 'bg-pink-50 text-pink-700 hover:bg-pink-100 border-pink-200' 
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <span className="text-2xl">🧠</span>
                  <span className="font-bold text-xs mt-1">Suggestion IA</span>
                </button>
              </div>
              
              <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-4">Informations</h3>
                <div className="space-y-3">
                  <div><strong>Email:</strong> {selectedLead.email}</div>
                  <div><strong>Téléphone:</strong> {selectedLead.telephone}</div>
                  <div><strong>Budget:</strong> {(selectedLead.budget || 0).toLocaleString()} €</div>
                  <div><strong>Statut:</strong> {selectedLead.statut}</div>
                  <div><strong>Type de bien:</strong> {selectedLead.type_bien || 'Non spécifié'}</div>
                </div>
              </div>

              {/* Timeline d'historique du lead */}
              <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-4">📜 Historique du lead</h3>
                
                {(() => {
                  // Données déjà disponibles dans le lead
                  const events = [];
                  
                  // Création du lead
                  if (selectedLead.created_at) {
                    events.push({
                      icon: '👤',
                      label: 'Lead créé',
                      detail: `Nouveau lead : ${selectedLead.nom}`,
                      date: selectedLead.created_at,
                      color: 'bg-blue-100 text-blue-800 border-blue-200'
                    });
                  }
                  
                  // Suggestion IA
                  if (selectedLead.score_ia || selectedLead.ia_score) {
                    events.push({
                      icon: '🧠',
                      label: 'IA',
                      detail: `Lead chaud (score ${selectedLead.score_ia || selectedLead.ia_score})`,
                      date: selectedLead.created_at,
                      color: 'bg-purple-100 text-purple-800 border-purple-200'
                    });
                  }
                  
                  // Changement de statut
                  if (selectedLead.statut) {
                    events.push({
                      icon: '📊',
                      label: 'Statut',
                      detail: `Statut actuel : ${selectedLead.statut}`,
                      date: selectedLead.updated_at || selectedLead.created_at,
                      color: 'bg-green-100 text-green-800 border-green-200'
                    });
                  }
                  
                  // RDV (simulation basée sur statut)
                  if (selectedLead.statut === 'RDV fixé') {
                    events.push({
                      icon: '📅',
                      label: 'RDV fixé',
                      detail: 'Rendez-vous programmé',
                      date: selectedLead.updated_at || selectedLead.created_at,
                      color: 'bg-orange-100 text-orange-800 border-orange-200'
                    });
                  }
                  
                  // Document généré (simulation)
                  if (selectedLead.statut === 'Négociation' || selectedLead.statut === 'Gagné') {
                    events.push({
                      icon: '📄',
                      label: 'Devis généré',
                      detail: 'Document créé et envoyé',
                      date: selectedLead.updated_at || selectedLead.created_at,
                      color: 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    });
                  }
                  
                  // Tri par date
                  events.sort((a, b) => new Date(b.date) - new Date(a.date));
                  
                  if (events.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-3xl mb-2">📜</div>
                        <p className="text-sm">Aucun historique disponible</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-4">
                      {events.map((event, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          {/* Icône */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${event.color}`}>
                            <span className="text-sm">{event.icon}</span>
                          </div>
                          
                          {/* Contenu */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{event.label}</span>
                              <span className="text-xs text-gray-500">
                                {event.date ? 
                                  new Date(event.date).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  }) : 
                                  'Date inconnue'
                                }
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{event.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
