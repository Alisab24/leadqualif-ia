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
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ProfileManager from '../services/profileManager';
import DevisToFactureService from '../services/devisToFactureService';

const DocumentsPage = () => {
  const [searchParams] = useSearchParams();
  const leadIdFilter = searchParams.get('lead') || null;

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

      // 🛡️ PROTECTION ROBUSTE: Utiliser ProfileManager
      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: true,  // Créer automatiquement si non trouvé
        useFallback: true,      // Utiliser fallback si échec
        required: ['agency_id'], // agency_id est obligatoire
        verbose: true
      });

      if (!profileResult.success) {
        console.error('❌ Impossible de récupérer le profil:', profileResult.error);
        setAgencyProfile(null);
        return;
      }

      const profile = profileResult.profile;
      console.log('✅ Profil chargé:', {
        action: profileResult.action,
        agencyId: ProfileManager.getSafeAgencyId(profile),
        isFallback: ProfileManager.isFallbackProfile(profile)
      });

      setAgencyProfile(profile);
    } catch (error) {
      console.error('❌ Erreur chargement profil:', error);
      setAgencyProfile(null);
    }
  };

  const fetchDocuments = useCallback(async () => {
    if (!agencyProfile?.agency_id) {
      console.warn('⚠️ fetchDocuments: agencyProfile ou agency_id manquant');
      return;
    }

    setLoading(true);
    try {
      // 🛡️ PROTECTION: Utiliser getSafeAgencyId pour éviter les erreurs
      const agencyId = ProfileManager.getSafeAgencyId(agencyProfile);
      
      if (!agencyId) {
        console.error('❌ fetchDocuments: Agency ID non disponible');
        return;
      }

      // 🎯 AGENCY-CENTRIC: Utiliser agency_id pour les documents
      // L'agence est l'unité de vérité - Multi-user compatible
      let query = supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('agency_id', agencyId); // ✅ JAMAIS user_id

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

      // Filtrage par lead (provient de /documents-center?lead=xxx)
      if (leadIdFilter) {
        query = query.eq('lead_id', leadIdFilter);
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
  }, [agencyProfile, filters, pagination, leadIdFilter]);

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

  /**
   * 🛡️ FONCTION DE TÉLÉCHARGEMENT PDF - DOM Natif
   * Corrige l'erreur "createElement is not a function"
   * Utilise document.createElement natif au lieu des objets React
   */
  const downloadDocument = (document) => {
    try {
      // 🎯 Vérification des données requises
      if (!document) {
        console.error('❌ downloadDocument: document est null ou undefined');
        alert('❌ Document non disponible pour le téléchargement');
        return;
      }

      if (!document.preview_html && !document.content_json) {
        console.error('❌ downloadDocument: aucun contenu HTML trouvé');
        alert('❌ Aucun contenu à télécharger');
        return;
      }

      // 🎯 Récupérer le contenu HTML
      const htmlContent = document.preview_html || 
                        (document.content_json?.html_content) || 
                        `<html><body><h1>${document.reference || 'Document'}</h1></body></html>`;

      // 🎯 Créer un Blob à partir du HTML
      const blob = new Blob([htmlContent], { 
        type: 'text/html;charset=utf-8' 
      });

      // 🎯 Créer une URL temporaire
      const url = window.URL.createObjectURL(blob);

      // 🎯 Créer un élément <a> natif (pas React)
      const link = window.document.createElement('a');
      
      // 🎯 Configurer le lien de téléchargement
      link.href = url;
      link.download = `${document.reference || 'document'}.html`;
      link.style.display = 'none'; // Cacher le lien
      
      // 🎯 Ajouter au DOM, cliquer, puis nettoyer
      window.document.body.appendChild(link);
      
      // 🎯 Déclencher le téléchargement
      link.click();
      
      // 🎯 Nettoyer le DOM
      window.document.body.removeChild(link);
      
      // 🎯 Libérer l'URL (important pour la mémoire)
      window.URL.revokeObjectURL(url);

      console.log('✅ Document téléchargé:', document.reference);
      
    } catch (error) {
      console.error('❌ Erreur téléchargement document:', error);
      alert('❌ Erreur lors du téléchargement du document');
    }
  };

  /**
   * 🔄 FONCTION DÉPRÉCIÉE - Maintenue pour compatibilité
   * @deprecated Utiliser downloadDocument() à la place
   */
  const handleDownload = async (document) => {
    console.warn('⚠️ handleDownload est déprécié, utilisez downloadDocument()');
    downloadDocument(document);
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
      <div className="flex flex-col items-center justify-center h-screen text-slate-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
        <p className="text-sm">Chargement du profil…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* ── En-tête de page (slim, intégré à la sidebar Layout) ── */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-xl">📂</span>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Documents</h1>
              <p className="text-xs text-slate-500">
                {totalCount} document{totalCount > 1 ? 's' : ''} · {agencyProfile.nom_agence}
                {agencyProfile.type_agence === 'immobilier' ? ' · 🏠 Immo' : ' · 📱 SMMA'}
              </p>
            </div>
          </div>
          {leadIdFilter && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                🔍 Lead filtré
              </span>
              <a href="/documents" className="text-xs text-slate-500 hover:text-slate-700 underline">
                Voir tout
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex-none bg-white border-b border-slate-100 px-6 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {/* Recherche */}
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="Référence, titre ou client…"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none bg-slate-50"
            />
          </div>

          {/* Type */}
          <div>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
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
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
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
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none bg-slate-50"
            >
              <option value="tous">Toutes les dates</option>
              <option value="7jours">7 derniers jours</option>
              <option value="30jours">30 derniers jours</option>
              <option value="90jours">90 derniers jours</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Contenu principal scrollable ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-sm">Chargement des documents…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-5xl mb-4">📄</span>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Aucun document trouvé</h3>
            <p className="text-sm">
              {filters.searchTerm || filters.type !== 'tous' || filters.statut !== 'tous'
                ? 'Essayez de modifier vos filtres'
                : 'Créez votre premier document depuis un lead'}
            </p>
          </div>
        ) : (
          <>
            {/* Liste des documents */}
            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="text-xl shrink-0">{getTypeIcon(doc.type)}</span>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{doc.reference}</div>
                              <div className="text-xs text-slate-400 truncate max-w-[160px]">{doc.titre}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-sm text-slate-700">{doc.client_nom || '—'}</div>
                          {doc.client_email && (
                            <div className="text-xs text-slate-400">{doc.client_email}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-800">
                            {formatCurrency(doc.total_ttc, doc.devise)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
                            {doc.statut}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400 hidden sm:table-cell">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handlePreview(doc)}
                              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Aperçu"
                            >👁️</button>
                            <button
                              onClick={() => downloadDocument(doc)}
                              className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Télécharger"
                            >⬇️</button>
                            {doc.type === 'devis' && (
                              <button
                                onClick={() => { setSelectedDocument(doc); setShowConversionModal(true); }}
                                className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Convertir en facture"
                              >🔄</button>
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
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, totalCount)} sur {totalCount} documents
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Précédent
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    {pagination.page} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Suivant →
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
