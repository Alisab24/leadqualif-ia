/**
 * ARCHITECTE SaaS - Page Documents Stripe-like
 * 
 * Principes :
 * - Agency-centric: uniquement agency_id
 * - Performance: pagination et filtrage optimisés
 * - UX moderne: interface claire et professionnelle
 * - Conversion: devis → facture intégrée
 * - RLS: respect des politiques de sécurité
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import DevisToFactureService from '../services/devisToFactureService';

const DocumentsPage = () => {
  // États principaux
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // États de filtrage
  const [filters, setFilters] = useState({
    type: 'tous',
    statut: 'tous',
    dateRange: 'tous',
    searchTerm: ''
  });
  
  // États de pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    offset: 0
  });
  
  // États UI
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);

  // Récupération du profil agence
  useEffect(() => {
    fetchAgencyProfile();
  }, []);

  // Récupération des documents
  useEffect(() => {
    if (agencyProfile) {
      fetchDocuments();
    }
  }, [agencyProfile, filters, pagination.page]);

  const fetchAgencyProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🎯 Récupérer le profil pour obtenir l'agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setAgencyProfile(profile);
    } catch (error) {
      console.error('❌ Erreur chargement profil:', error);
    }
  };

  const fetchDocuments = useCallback(async () => {
    if (!agencyProfile?.agency_id) return;

    setLoading(true);
    try {
      // 🎯 AGENCY-CENTRIC: Utiliser agency_id pour les documents
      // L'agence est l'unité de vérité - Multi-user compatible
      let query = supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('agency_id', agencyProfile.agency_id); // ✅ JAMAIS user_id

      // Filtrage par type
      if (filters.type !== 'tous') {
        query = query.eq('type', filters.type);
      }

      // Filtrage par statut
      if (filters.statut !== 'tous') {
        query = query.eq('statut', filters.statut);
      }

      // Filtrage par date
      if (filters.dateRange !== 'tous') {
        const dateFilter = getDateFilter(filters.dateRange);
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
      }

      // Recherche textuelle
      if (filters.searchTerm) {
        query = query.or(
          `reference.ilike.%${filters.searchTerm}%,titre.ilike.%${filters.searchTerm}%,client_nom.ilike.%${filters.searchTerm}%`
        );
      }

      // Pagination
      const offset = (pagination.page - 1) * pagination.limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      setDocuments(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('❌ Erreur chargement documents:', error);
    } finally {
      setLoading(false);
    }
  }, [agencyProfile, filters, pagination]);

  const getDateFilter = (range) => {
    const now = new Date();
    switch (range) {
      case '7jours':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30jours':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90jours':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset page
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleConvertToInvoice = async (document) => {
    if (document.type !== 'devis') return;

    setConvertingId(document.id);
    try {
      const result = await DevisToFactureService.convertDevisToFacture(document.id, {
        dateFacturation: new Date(),
        notes: 'Conversion depuis page Documents'
      });

      if (result.success) {
        // Rafraîchir la liste
        await fetchDocuments();
        setShowConversionModal(false);
        setSelectedDocument(null);
        
        // Notification de succès
        alert(`✅ Facture créée avec succès !\nRéférence: ${result.metadata.factureReference}`);
      } else {
        alert(`❌ Erreur lors de la conversion: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Erreur conversion:', error);
      alert(`❌ Erreur lors de la conversion: ${error.message}`);
    } finally {
      setConvertingId(null);
    }
  };

  const handlePreview = (document) => {
    setPreviewDocument(document);
    setShowPreviewModal(true);
  };

  const handleDownload = async (document) => {
    try {
      // Créer un blob à partir du HTML
      const blob = new Blob([document.preview_html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Créer un lien temporaire
      const link = document.createElement('a');
      link.href = url;
      link.download = `${document.reference}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Nettoyer
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Erreur téléchargement:', error);
      alert('❌ Erreur lors du téléchargement');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    if (!amount) return '0,00 €';
    
    // 🎯 CORRECTION: Convertir le symbole € en code ISO 4217
    // Intl.NumberFormat n'accepte que les codes ISO, pas les symboles
    const normalizedCurrency = currency === '€' ? 'EUR' : currency;
    
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: normalizedCurrency
      }).format(amount);
    } catch (error) {
      console.warn('⚠️ Erreur formatCurrency avec devise:', currency, error);
      // Fallback en cas d'erreur
      return `${amount.toLocaleString('fr-FR')} ${currency}`;
    }
  };

  const getStatusColor = (statut) => {
    const colors = {
      'généré': 'bg-blue-100 text-blue-800',
      'validé': 'bg-green-100 text-green-800',
      'facturé': 'bg-purple-100 text-purple-800',
      'émis': 'bg-yellow-100 text-yellow-800',
      'payé': 'bg-emerald-100 text-emerald-800',
      'annulé': 'bg-red-100 text-red-800'
    };
    return colors[statut] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'devis': '📄',
      'facture': '🧾',
      'mandat': '📋',
      'rapport': '📊',
      'contrat': '📝',
      'attestation': '✅',
      'convention': '🤝'
    };
    return icons[type] || '📄';
  };

  const totalPages = Math.ceil(totalCount / pagination.limit);

  if (!agencyProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
              <p className="text-sm text-gray-600 mt-1">
                {totalCount} document{totalCount > 1 ? 's' : ''} • {agencyProfile.nom_agence}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {agencyProfile.type_agence === 'immobilier' ? '🏠 Immobilier' : '📱 SMMA'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Recherche */}
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Rechercher par référence, titre ou client..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type */}
            <div>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="tous">Tous les types</option>
                <option value="devis">📄 Devis</option>
                <option value="facture">🧾 Factures</option>
                <option value="mandat">📋 Mandats</option>
                <option value="rapport">📊 Rapports</option>
                <option value="contrat">📝 Contrats</option>
              </select>
            </div>

            {/* Statut */}
            <div>
              <select
                value={filters.statut}
                onChange={(e) => handleFilterChange('statut', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="tous">Tous les statuts</option>
                <option value="généré">📝 Généré</option>
                <option value="validé">✅ Validé</option>
                <option value="facturé">🧾 Facturé</option>
                <option value="émis">📤 Émis</option>
                <option value="payé">💰 Payé</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="tous">Toutes les dates</option>
                <option value="7jours">📅 7 derniers jours</option>
                <option value="30jours">📅 30 derniers jours</option>
                <option value="90jours">📅 90 derniers jours</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun document trouvé</h3>
            <p className="text-gray-600">
              {filters.searchTerm || filters.type !== 'tous' || filters.statut !== 'tous'
                ? 'Essayez de modifier vos filtres'
                : 'Commencez par créer votre premier document'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Liste des documents */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Document
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{getTypeIcon(doc.type)}</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{doc.reference}</div>
                              <div className="text-sm text-gray-500">{doc.titre}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{doc.client_nom || '-'}</div>
                          {doc.client_email && (
                            <div className="text-sm text-gray-500">{doc.client_email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(doc.total_ttc, doc.devise)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
                            {doc.statut}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            {/* Preview */}
                            <button
                              onClick={() => handlePreview(doc)}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                              title="Aperçu"
                            >
                              👁️
                            </button>

                            {/* Download */}
                            <button
                              onClick={() => handleDownload(doc)}
                              className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                              title="Télécharger"
                            >
                              ⬇️
                            </button>

                            {/* Convert to Invoice */}
                            {doc.type === 'devis' && (
                              <button
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setShowConversionModal(true);
                                }}
                                className="text-purple-600 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-50"
                                title="Convertir en facture"
                              >
                                🔄
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
                  {Math.min(pagination.page * pagination.limit, totalCount)} sur {totalCount} documents
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <span className="px-3 py-2 text-sm font-medium text-gray-700">
                    Page {pagination.page} sur {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de conversion devis → facture */}
      {showConversionModal && selectedDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Convertir le devis en facture
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Vous allez convertir le document suivant :
                </p>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Référence :</span>
                    <span>{selectedDocument.reference}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Client :</span>
                    <span>{selectedDocument.client_nom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Montant :</span>
                    <span>{formatCurrency(selectedDocument.total_ttc, selectedDocument.devise)}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowConversionModal(false);
                    setSelectedDocument(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleConvertToInvoice(selectedDocument)}
                  disabled={convertingId === selectedDocument.id}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {convertingId === selectedDocument.id ? 'Conversion...' : 'Convertir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de preview */}
      {showPreviewModal && previewDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 h-5/6 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Aperçu : {previewDocument.reference}
              </h3>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewDocument(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="h-5/6 overflow-auto border rounded">
              <div dangerouslySetInnerHTML={{ __html: previewDocument.preview_html }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
