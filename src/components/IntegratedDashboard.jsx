import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import DocumentService from '../services/documentService';
import CRMHistory from './CRMHistory';

export default function IntegratedDashboard({ agencyId }) {
  const [activeView, setActiveView] = useState('kanban'); // kanban, documents, stats, history
  const [leads, setLeads] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  // Menu items
  const menuItems = [
    { id: 'kanban', label: 'Pipeline', icon: '📊', mobile: true },
    { id: 'documents', label: 'Documents', icon: '📂', mobile: true },
    { id: 'stats', label: 'Statistiques', icon: '📈', mobile: true },
    { id: 'history', label: 'Historique', icon: '📋', mobile: true }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les leads
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false });
        
        setLeads(leadsData || []);

        // Récupérer les documents
        const docs = await DocumentService.getAgencyDocuments(agencyId);
        setDocuments(docs);

        // Récupérer les statistiques
        const documentStats = await DocumentService.getDocumentStats(agencyId);
        setStats(documentStats);

      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };

    if (agencyId) {
      fetchData();
    }
  }, [agencyId]);

  const getLeadStats = () => {
    const stats = {
      total: leads.length,
      thisMonth: leads.filter(lead => {
        const leadDate = new Date(lead.created_at);
        const now = new Date();
        return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
      }).length,
      byStatus: {
        'Nouveau': leads.filter(l => l.statut === 'Nouveau').length,
        'Qualifié': leads.filter(l => l.statut === 'Qualifié').length,
        'Proposition': leads.filter(l => l.statut === 'Proposition').length,
        'Négociation': leads.filter(l => l.statut === 'Négociation').length,
        'Gagné': leads.filter(l => l.statut === 'Gagné').length,
        'Perdu': leads.filter(l => l.statut === 'Perdu').length
      }
    };
    return stats;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Brouillon': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'Généré': return 'bg-green-50 text-green-700 border-green-200';
      case 'Envoyé': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Signé': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  const leadStats = getLeadStats();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* MENU HORIZONTAL (Desktop) */}
      <div className="hidden lg:block bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-slate-800">LeadQualif IA</h1>
              <nav className="flex space-x-1">
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === item.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                to="/estimation"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + Nouveau Lead
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* MENU VERTICAL (Mobile/Tablet) */}
      <div className="lg:hidden bg-white border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-slate-800">LeadQualif IA</h1>
            <Link 
              to="/estimation"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Lead
            </Link>
          </div>
          <nav className="flex space-x-2 overflow-x-auto pb-2">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeView === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Vue Pipeline Kanban */}
        {activeView === 'kanban' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Pipeline Commercial</h2>
              <p className="text-slate-600">{leadStats.total} leads • Pipeline actif</p>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-800">{leadStats.total}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-600">Ce mois</p>
                <p className="text-2xl font-bold text-green-600">{leadStats.thisMonth}</p>
              </div>
              {Object.entries(leadStats.byStatus).map(([status, count]) => (
                <div key={status} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-600">{status}</p>
                  <p className="text-2xl font-bold text-slate-800">{count}</p>
                </div>
              ))}
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.keys(leadStats.byStatus).map(status => (
                <div key={status} className="bg-slate-100/50 rounded-xl border border-slate-200">
                  <div className="p-4 font-bold text-slate-700 bg-white/60 rounded-t-xl flex justify-between">
                    {status}
                    <span className="bg-slate-200 text-xs px-2 py-1 rounded-full">
                      {leadStats.byStatus[status]}
                    </span>
                  </div>
                  <div className="p-3 space-y-3 min-h-[200px]">
                    {leads.filter(l => l.statut === status).map(lead => (
                      <div 
                        key={lead.id} 
                        onClick={() => setSelectedLead(lead)}
                        className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition"
                      >
                        <h4 className="font-bold text-slate-900 truncate">{lead.nom}</h4>
                        <p className="text-sm text-slate-500">{(lead.budget || 0).toLocaleString()} €</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vue Documents */}
        {activeView === 'documents' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Centre de Documents</h2>
              <p className="text-slate-600">{documents.length} documents générés</p>
            </div>

            {/* Stats Documents */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Total</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl">📄</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Ce mois</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.thisMonth}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 text-xl">📅</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Immobilier</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.immo}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 text-xl">🏠</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Marketing</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.smma}</p>
                    </div>
                    <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 text-xl">🚀</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Signés</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.byStatus?.Signé || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-xl">✅</div>
                  </div>
                </div>
              </div>
            )}

            {/* Documents List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left p-4 font-medium text-slate-700">Type</th>
                      <th className="text-left p-4 font-medium text-slate-700">Client</th>
                      <th className="text-left p-4 font-medium text-slate-700">Version</th>
                      <th className="text-left p-4 font-medium text-slate-700">Statut</th>
                      <th className="text-left p-4 font-medium text-slate-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 10).map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-50 text-red-500 rounded flex items-center justify-center text-xs font-bold">PDF</div>
                            <span className="font-medium text-slate-700">{doc.type}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-slate-700">{doc.leads?.nom || 'N/A'}</p>
                            <p className="text-xs text-slate-500">{doc.leads?.email || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-slate-50 text-slate-700 text-xs font-bold rounded-full border border-slate-200">
                            v{doc.version}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600">
                          <div>
                            <p>{new Date(doc.created_at).toLocaleDateString()}</p>
                            <p className="text-xs text-slate-500">{new Date(doc.created_at).toLocaleTimeString().slice(0,5)}</p>
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

        {/* Vue Statistiques */}
        {activeView === 'stats' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Statistiques Globales</h2>
              <p className="text-slate-600">Vue d'ensemble de votre activité</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stats Leads */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">📊 Leads</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Leads</span>
                    <span className="text-2xl font-bold text-slate-800">{leadStats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Ce mois</span>
                    <span className="text-xl font-bold text-green-600">{leadStats.thisMonth}</span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(leadStats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-slate-600">{status}</span>
                        <span className="font-medium text-slate-800">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats Documents */}
              {stats && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">📂 Documents</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Total Documents</span>
                      <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Ce mois</span>
                      <span className="text-xl font-bold text-green-600">{stats.thisMonth}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Immobilier</span>
                      <span className="font-medium text-slate-800">{stats.immo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Marketing</span>
                      <span className="font-medium text-slate-800">{stats.smma}</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(stats.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center">
                          <span className="text-slate-600">{status}</span>
                          <span className="font-medium text-slate-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vue Historique */}
        {activeView === 'history' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Historique CRM</h2>
              <p className="text-slate-600">Timeline de toutes les activités</p>
            </div>

            {/* Lead Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Sélectionner un lead</label>
              <select
                value={selectedLead?.id || ''}
                onChange={(e) => setSelectedLead(leads.find(l => l.id === e.target.value))}
                className="w-full md:w-1/2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choisir un lead...</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.nom} - {lead.email}
                  </option>
                ))}
              </select>
            </div>

            {/* History Display */}
            {selectedLead ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">
                  Historique de {selectedLead.nom}
                </h3>
                <CRMHistory lead={selectedLead} agencyId={agencyId} />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <span className="text-4xl mb-4 block">📋</span>
                <p className="text-slate-600">Sélectionnez un lead pour voir son historique</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALE LEAD (si sélectionné) */}
      {selectedLead && activeView === 'kanban' && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedLead.nom}</h2>
                <p className="text-xs text-slate-400">Ajouté le {new Date(selectedLead.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <a href={`tel:${selectedLead.telephone}`} className="flex flex-col items-center justify-center p-4 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200 transition">
                <span className="text-2xl mb-1">📞</span>
                <span className="font-bold text-sm">Appeler</span>
              </a>
              <a href={`mailto:${selectedLead.email}`} className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 border border-blue-200 transition">
                <span className="text-2xl mb-1">📧</span>
                <span className="font-bold text-sm">Email</span>
              </a>
              <a href={`https://wa.me/${selectedLead.telephone.replace(/[^0-9]/g, '')}?text=Bonjour ${selectedLead.nom}, je vous contacte concernant votre projet.`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 border border-green-200 transition">
                <span className="text-2xl mb-1">💬</span>
                <span className="font-bold text-sm">WhatsApp</span>
              </a>
              <a href={`/estimation/${agencyId}`} target="_blank" className="flex flex-col items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 border border-purple-200 transition">
                <span className="text-2xl mb-1">📅</span>
                <span className="font-bold text-sm">RDV</span>
              </a>
            </div>

            {/* Info Lead */}
            <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div><p className="text-xs font-bold text-slate-400 uppercase">Email</p><p className="font-medium">{selectedLead.email}</p></div>
              <div><p className="text-xs font-bold text-slate-400 uppercase">Tel</p><p className="font-medium">{selectedLead.telephone}</p></div>
              <div><p className="text-xs font-bold text-slate-400 uppercase">Budget</p><p className="font-bold text-green-600 text-lg">{selectedLead.budget?.toLocaleString()} €</p></div>
              <div><p className="text-xs font-bold text-slate-400 uppercase">Délai</p><p className="font-medium">{selectedLead.delai || 'Non défini'}</p></div>
            </div>

            {/* Historique CRM */}
            <div className="border-t border-slate-100 pt-8">
              <h3 className="font-bold text-xl text-slate-800 mb-4 flex items-center gap-2">📋 Historique CRM</h3>
              <CRMHistory lead={selectedLead} agencyId={agencyId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
