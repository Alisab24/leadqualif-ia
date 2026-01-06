import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// import DocumentService from '../services/documentService';
import CRMHistory from './CRMHistory';
import DocumentGenerator from './DocumentGenerator';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function IntegratedDashboard({ agencyId }) {
  const [activeView, setActiveView] = useState('kanban'); // kanban, documents, stats, history
  const [leads, setLeads] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  // Debug log
  console.log('IntegratedDashboard - agencyId:', agencyId);

  // Menu items
  const menuItems = [
    { id: 'kanban', label: 'Pipeline', icon: '📊', mobile: true },
    { id: 'list', label: 'Liste', icon: '📝', mobile: true },
    { id: 'documents', label: 'Documents', icon: '📂', mobile: true },
    { id: 'stats', label: 'Statistiques', icon: '📈', mobile: true },
    { id: 'history', label: 'Historique', icon: '📋', mobile: true }
  ];

  const generateQuickDocument = async (lead, docType) => {
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      
      // Récupérer le profil de l'agence
      const { data: agencyProfile } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', agencyId)
        .single();
      
      // Générer le PDF
      const doc = new jsPDF();
      
      // En-tête
      doc.setFontSize(20);
      doc.text(`${docType.toUpperCase()} - ${lead.nom}`, 20, 30);
      
      // Informations agence
      if (agencyProfile) {
        doc.setFontSize(12);
        doc.text(`${agencyProfile.name}`, 20, 50);
        doc.text(`${agencyProfile.address || ''}`, 20, 60);
        doc.text(`${agencyProfile.phone || ''}`, 20, 70);
        doc.text(`${agencyProfile.email || ''}`, 20, 80);
      }
      
      // Informations client
      doc.setFontSize(14);
      doc.text('INFORMATIONS CLIENT', 20, 100);
      doc.setFontSize(11);
      doc.text(`Nom: ${lead.nom}`, 20, 115);
      doc.text(`Email: ${lead.email}`, 20, 125);
      doc.text(`Téléphone: ${lead.telephone}`, 20, 135);
      doc.text(`Budget: ${(lead.budget || 0).toLocaleString()} €`, 20, 145);
      doc.text(`Type de bien: ${lead.type_bien || 'Non spécifié'}`, 20, 155);
      
      // Contenu spécifique
      doc.setFontSize(14);
      doc.text('DÉTAILS DU DOCUMENT', 20, 180);
      
      let content = '';
      let newStatus = lead.statut;
      
      switch (docType) {
        case 'mandat':
          content = `Le soussigné ${lead.nom} donne mandat exclusif à ${agencyProfile?.name || 'l\'agence'} pour la vente du bien. Durée: 3 mois. Commission: 5% du prix de vente.`;
          newStatus = 'Mandat signé';
          break;
        case 'devis':
          content = `Devis pour services immobiliers - ${lead.nom}\nHonoraires: ${((lead.budget || 0) * 0.03).toLocaleString()} € (3%)\nAccompagnement vente: Inclus`;
          newStatus = 'Offre en cours';
          break;
        case 'facture':
          content = `FACTURE N°${Date.now()}\nClient: ${lead.nom}\nMontant: ${((lead.budget || 0) * 0.03).toLocaleString()} €`;
          newStatus = 'Gagné';
          break;
        case 'bon_visite':
          content = `BON DE VISITE\nClient: ${lead.nom}\nDate: ${new Date().toLocaleDateString()}`;
          newStatus = 'Visite planifiée';
          break;
      }
      
      doc.setFontSize(11);
      const splitText = doc.splitTextToSize(content, 170);
      doc.text(splitText, 20, 195);
      
      // Pied de page
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Généré par LeadQualif IA - CRM Intelligent", 105, pageHeight - 10, { align: 'center' });
      
      // Télécharger
      doc.save(`${docType}_${lead.nom}.pdf`);
      
      // Mettre à jour le statut du lead
      await supabase
        .from('leads')
        .update({ statut: newStatus })
        .eq('id', lead.id);
      
      // Rafraîchir les données
      fetchData();
      
      console.log(`Document ${docType} généré pour ${lead.nom}`);
      
    } catch (error) {
      console.error('Erreur génération document:', error);
    }
  };

  const fetchData = async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }

    try {
      console.log('Chargement des données pour agencyId:', agencyId);
      
      // Récupérer les leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });
      
      if (leadsError) {
        console.error('Erreur leads:', leadsError);
        setLeads([]);
      } else {
        setLeads(leadsData || []);
      }

      setDocuments([]);
      setStats({ total: 0, thisMonth: 0, immo: 0, smma: 0, byStatus: {} });

    } catch (error) {
      console.error('Erreur générale fetchData:', error);
      setLeads([]);
      setDocuments([]);
      setStats({ total: 0, thisMonth: 0, immo: 0, smma: 0, byStatus: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agencyId) {
      fetchData();
      
      // Timeout de sécurité : arrêter le chargement après 10 secondes
      const timeoutId = setTimeout(() => {
        setLoading(false);
        console.warn('Timeout : arrêt du chargement après 10 secondes');
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
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
          <p className="text-slate-600 mb-4">Chargement du dashboard...</p>
          <button 
            onClick={() => {
              setLoading(false);
              setTimeout(() => setLoading(true), 100);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Vérification si agencyId est disponible
  if (!agencyId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h3 className="text-xl font-bold text-slate-800 mb-2">ID d'agence non trouvé</h3>
          <p className="text-slate-600 mb-6">
            Impossible de charger les données. Veuillez vérifier votre profil.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Actualiser la page
          </button>
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
        {/* Vue Pipeline Kanban - Temporairement désactivé */}
        {activeView === 'kanban' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Pipeline Commercial</h2>
              <p className="text-slate-600">Utilisez la vue Liste pour accéder aux fonctionnalités complètes</p>
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

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
              <p className="text-blue-800 font-medium mb-2">📋 Vue Liste Recommandée</p>
              <p className="text-blue-600 text-sm mb-4">Accédez aux boutons de génération de documents et actions complètes dans la vue Liste.</p>
              <button 
                onClick={() => setActiveView('list')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Aller à la Vue Liste
              </button>
            </div>
          </div>
        )}

        {/* Vue Liste */}
        {activeView === 'list' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Liste des Leads</h2>
              <p className="text-slate-600">{leadStats.total} leads au total</p>
            </div>

            {/* Tableau des leads */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Score IA</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Budget</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {leads.length > 0 ? leads.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{lead.nom}</div>
                            <div className="text-sm text-slate-500">{lead.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-slate-900">85%</span>
                            <div className="ml-2 w-16 bg-slate-200 rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {lead.budget ? `${parseInt(lead.budget).toLocaleString()} €` : 'Non spécifié'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {lead.type_bien || 'Non spécifié'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusColor(lead.statut)}`}>
                            {lead.statut || 'Nouveau'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <DocumentGenerator lead={lead} agencyId={agencyId} compact={true} />
                            <button 
                              onClick={() => setSelectedLead(lead)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Détails
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center">
                          <div className="text-center">
                            <span className="text-6xl mb-4 block">📋</span>
                            <h3 className="text-lg font-medium text-slate-900 mb-2">Aucun lead trouvé</h3>
                            <p className="text-slate-500 mb-4">
                              Commencez par ajouter des leads via le formulaire d'estimation.
                            </p>
                            <Link 
                              to="/estimation"
                              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              + Ajouter un Lead
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Vue Documents */}
        {activeView === 'documents' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Documents</h2>
              <p className="text-slate-600">Accédez à tous vos documents générés</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
              <p className="text-blue-800 font-medium mb-2">📂 Centre de Documents</p>
              <p className="text-blue-600 text-sm mb-4">
                Utilisez le menu latéral pour accéder au Centre de Documents complet.
              </p>
              <Link 
                to="/documents"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Voir tous les documents
              </Link>
            </div>
          </div>
        )}

        {/* Vue Stats */}
        {activeView === 'stats' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Statistiques</h2>
              <p className="text-slate-600">Analysez vos performances</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📈</span>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Statistiques en cours de développement</h3>
                <p className="text-slate-500">
                  Cette section sera bientôt disponible avec des graphiques détaillés.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vue Historique */}
        {activeView === 'history' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Historique</h2>
              <p className="text-slate-600">Consultez l'historique des actions</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📋</span>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Historique en cours de développement</h3>
                <p className="text-slate-500">
                  Cette section sera bientôt disponible avec l'historique complet des activités.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Lead Details */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Détails du Lead</h3>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nom</label>
                <p className="text-slate-900">{selectedLead.nom}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <p className="text-slate-900">{selectedLead.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Téléphone</label>
                <p className="text-slate-900">{selectedLead.telephone}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Budget</label>
                <p className="text-slate-900">{selectedLead.budget ? `${parseInt(selectedLead.budget).toLocaleString()} €` : 'Non spécifié'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Type de bien</label>
                <p className="text-slate-900">{selectedLead.type_bien || 'Non spécifié'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Statut</label>
                <p className="text-slate-900">{selectedLead.statut || 'Nouveau'}</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button 
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
