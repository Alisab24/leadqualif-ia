import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import LeadForm from '../components/LeadForm';
import DocumentTemplateGenerator from '../components/DocumentTemplateGenerator';

function Dashboard() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('kanban');
  
  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({ total: 0, won: 0, potential: 0 });
  const [agencyType, setAgencyType] = useState('immobilier');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showTemplateGenerator, setShowTemplateGenerator] = useState(false);

  // Refs pour le scroll automatique (optionnel)
  const scrollContainerRef = useRef(null);

  // États pour les flèches de scroll
  const [showLeftArrow, setShowLeftArrow] = useState(true);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollInterval = useRef(null);

  const statuts = ['À traiter', 'Contacté', 'Offre en cours', 'RDV fixé', 'Négociation', 'Gagné', 'Perdu'];

  // Fonction pour gérer les rendez-vous
  const handleRendezVous = (lead) => {
    const calendlyUrl = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com';
    window.open(`${calendlyUrl}/${lead.telephone}`, '_blank');
  };

  // Fonction pour récupérer les leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      // Récupérer le profil pour obtenir l'agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        console.error('Profil non trouvé');
        setLoading(false);
        return;
      }

      // Récupérer les leads de l'agence
      const { data: leadsData, error } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des leads:', error);
      } else {
        setLeads(leadsData || []);
        
        // Calculer les statistiques
        const total = leadsData?.length || 0;
        const won = leadsData?.filter(lead => lead.statut === 'Gagné').length || 0;
        const potential = leadsData?.filter(lead => ['À traiter', 'Contacté', 'RDV fixé'].includes(lead.statut)).length || 0;
        
        setStats({ total, won, potential });
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  // Effet pour charger les leads au montage
  useEffect(() => {
    fetchLeads();
  }, []);

  // Effet pour gérer le scroll horizontal
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth);
    };

    container.addEventListener('scroll', checkScroll);
    checkScroll();

    return () => {
      container.removeEventListener('scroll', checkScroll);
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
      }
    };
  }, []);

  // Fonction pour le scroll automatique
  const scroll = (direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300;
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Fonction pour le scroll automatique continue
  const startAutoScroll = (direction) => {
    if (scrollInterval.current) return;
    
    scrollInterval.current = setInterval(() => {
      scroll(direction);
    }, 50);
  };

  const stopAutoScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <span className="ml-4 text-sm text-slate-500">
                {agencyType === 'immobilier' ? '🏠 Immobilier' : '📱 SMMA'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  viewMode === 'kanban' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  viewMode === 'table' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tableau
              </button>
              <button
                onClick={() => setShowLeadForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H8m8 8v8m0-12h8" />
                </svg>
                Nouveau Lead
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 00-6-6h2.172a4 4 0 001.414 1.414M5 21h6a2 2 0 002-2v-1a6 6 0 00-6-6H6a6 6 0 00-6 6v1a2 2 0 002 2zm6-10V7a4 4 0 00-4-4H7a4 4 0 00-4 4v4a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Leads</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm0 0h6v-6h-6v6h6z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Gagnés</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.won}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7m0 10v-10l-5.293 5.294c-.63.926-1.086 1.426L15.707 15.707c.63-.183 1.086-.526 1.426L13 10z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Potentiels</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.potential}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leads */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Leads</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => scroll('left')}
                  className={`p-2 rounded-md ${showLeftArrow ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 cursor-not-allowed'}`}
                  disabled={!showLeftArrow}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => startAutoScroll('left')}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => stopAutoScroll()}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                </button>
                <button
                  onClick={() => startAutoScroll('right')}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => scroll('right')}
                  className={`p-2 rounded-md ${showRightArrow ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 cursor-not-allowed'}`}
                  disabled={!showRightArrow}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Scrollable container */}
            <div ref={scrollContainerRef} className="overflow-x-auto">
              {viewMode === 'kanban' ? (
                <div className="flex space-x-6 pb-4" style={{ minWidth: `${leads.length * 320}px` }}>
                  {leads.map((lead) => (
                    <div key={lead.id} className="flex-shrink-0 w-80 bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{lead.nom}</h4>
                          <p className="text-sm text-gray-500">{lead.email}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Téléphone</label>
                          <p className="text-sm text-gray-900">{lead.telephone}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Budget</label>
                          <p className="text-sm text-gray-900">{lead.budget ? `${lead.budget.toLocaleString('fr-FR')} €` : 'Non défini'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Source</label>
                          <p className="text-sm text-gray-900">{lead.source || 'Non défini'}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Voir détails
                        </button>
                        <button
                          onClick={() => handleRendezVous(lead)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          RDV
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{lead.nom}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.telephone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.budget ? `${lead.budget.toLocaleString('fr-FR')} €` : 'Non défini'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Voir détails
                            </button>
                            <button
                              onClick={() => handleRendezVous(lead)}
                              className="text-green-600 hover:text-green-800"
                            >
                              RDV
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Génération de documents */}
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Génération de documents</h3>
          <button
            onClick={() => setShowTemplateGenerator(true)}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            disabled={!selectedLead}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {selectedLead ? `Générer un document pour ${selectedLead.nom}` : 'Sélectionnez un lead'}
          </button>
        </div>
      </main>

      {/* Modal Lead Details */}
      {selectedLead && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900">{selectedLead.nom}</h2>
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                  ✕
                </button>
              </div>
            </div>
            
            {/* Actions rapides */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button 
                onClick={() => window.open(`https://wa.me/${selectedLead.telephone?.replace(/\D/g,'')}`, '_blank')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors"
                title="WhatsApp"
              >
                <span className="text-lg mb-1">💬</span>
                WhatsApp
              </button>
              <button 
                onClick={() => window.open(`tel:${selectedLead.telephone}`, '_blank')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                title="Appeler"
              >
                <span className="text-lg mb-1">📞</span>
                Appeler
              </button>
              <button 
                onClick={() => window.open(`mailto:${selectedLead.email}`, '_blank')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold transition-colors"
                title="Email"
              >
                <span className="text-lg mb-1">📧</span>
                Email
              </button>
              <button 
                onClick={() => setShowTemplateGenerator(true)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition-colors"
                title="Documents"
              >
                <span className="text-lg mb-1">📄</span>
                Documents
              </button>
            </div>

            {/* Informations compactes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{selectedLead.nom}</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  selectedLead.lead_role === 'proprietaire' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {selectedLead.lead_role === 'proprietaire' ? '🔑 Propriétaire' : '🏠 Client'}
                </span>
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className="text-sm text-slate-500">📧</span>
                <span className="text-sm text-slate-800">{selectedLead.email || '—'}</span>
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className="text-sm text-slate-500">📞</span>
                <span className="text-sm text-slate-800">{selectedLead.telephone || '—'}</span>
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className="text-sm text-slate-500">💰</span>
                <span className="text-sm font-bold text-green-600">{(selectedLead.budget || 0).toLocaleString('fr-FR')} €</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale Nouveau Lead */}
      {showLeadForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-slate-900">➕ Nouveau Lead</h2>
              <button 
                onClick={() => setShowLeadForm(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
              >
                ✕
              </button>
            </div>
              
            <LeadForm 
              onClose={() => setShowLeadForm(false)}
              onSuccess={() => {
                setShowLeadForm(false);
                fetchLeads(); // Rafraîchir la liste des leads
              }}
            />
          </div>
        </div>
      )}

      {/* Générateur de templates unifié */}
      {showTemplateGenerator && selectedLead && (
        <DocumentTemplateGenerator
          lead={selectedLead}
          agencyId={session?.user?.user_metadata?.agency_id || 'default'}
          agencyType={agencyType}
          onDocumentGenerated={(document) => {
            console.log('Document généré:', document);
            setShowTemplateGenerator(false);
            // Optionnel: rafraîchir les leads
            fetchLeads();
          }}
          onClose={() => setShowTemplateGenerator(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
