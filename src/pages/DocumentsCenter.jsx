import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function DocumentsCenter() {
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredLeadId, setFilteredLeadId] = useState(searchParams.get('lead'));

  useEffect(() => {
    fetchDocuments();
  }, [filteredLeadId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Utilisateur non authentifié');
        setDocuments([]);
        return;
      }

      // 🎯 Récupérer l'agency_id depuis le profil (user_id → agency_id)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', user.id)
        .single();

      const agencyId = profileData?.agency_id;

      if (!agencyId) {
        console.error('❌ Agency ID non trouvé dans le profil');
        setDocuments([]);
        return;
      }

      console.log("🎯 AGENCY-CENTRIC: Requête documents pour agency_id:", agencyId);

      // 🎯 AGENCY-CENTRIC: Utiliser agency_id pour les documents
      // L'agence est l'unité de vérité - Multi-user compatible
      let query = supabase
        .from('documents')
        .select('*')
        .eq('agency_id', agencyId); // ✅ JAMAIS user_id

      // 🎯 AJOUTER FILTRE PAR LEAD SI PRÉSENT
      if (filteredLeadId) {
        console.log("🔍 FILTRÉ PAR LEAD ID:", filteredLeadId);
        query = query.eq('lead_id', filteredLeadId);
      }

      const { data: documents, error: documentsError } = await query
        .order('created_at', { ascending: false });

      if (documentsError) {
        console.error('❌ Erreur requête documents:', documentsError);
        throw documentsError;
      }
      
      console.log('📚 Documents trouvés:', documents?.length || 0);
      
      // 🎯 Récupérer les leads séparément si nécessaire
      if (documents && documents.length > 0) {
        const leadIds = [...new Set(documents.map(doc => doc.lead_id))].filter(Boolean);
        
        if (leadIds.length > 0) {
          console.log('🔍 Lead IDs à récupérer:', leadIds);
          
          const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, nom, email, telephone, statut, budget, type_bien')
            .in('id', leadIds);
            
          if (leadsError) {
            console.error('❌ Erreur récupération leads:', leadsError);
          } else {
            // Combiner les données
            const docsWithLeads = documents.map(doc => ({
              ...doc,
              lead: leads.find(lead => lead.id === doc.lead_id) || null
            }));
            
            setDocuments(docsWithLeads);
          }
        } else {
          setDocuments(documents);
        }
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('❌ Erreur fetchDocuments:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'devis': return '💰';
      case 'contrat': return '📋';
      case 'mandat': return '✍️';
      case 'facture': return '🧾';
      default: return '📄';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'généré': return 'bg-green-100 text-green-800';
      case 'envoyé': return 'bg-blue-100 text-blue-800';
      case 'signé': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLeadStatusColor = (status) => {
    switch (status) {
      case 'À traiter': return 'bg-slate-100 text-slate-700';
      case 'Contacté': return 'bg-blue-100 text-blue-700';
      case 'RDV fixé': return 'bg-yellow-100 text-yellow-700';
      case 'Négociation': return 'bg-orange-100 text-orange-700';
      case 'Gagné': return 'bg-green-100 text-green-700';
      case 'Perdu': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Centre de Documents</h1>
              <p className="text-slate-600">
                {filteredLeadId 
                  ? `Documents du lead #${filteredLeadId}` 
                  : 'Vue d\'ensemble de tous les documents générés pour votre agence'
                }
              </p>
            </div>
            {filteredLeadId && (
              <button
                onClick={() => setFilteredLeadId(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                ← Voir tous les documents
              </button>
            )}
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total documents</p>
                <p className="text-2xl font-bold text-slate-900">{documents.length}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <span className="text-2xl">📄</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Devis</p>
                <p className="text-2xl font-bold text-green-600">
                  {documents.filter(d => d.type_document === 'devis').length}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Contrats</p>
                <p className="text-2xl font-bold text-blue-600">
                  {documents.filter(d => d.type_document === 'contrat').length}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Signés</p>
                <p className="text-2xl font-bold text-purple-600">
                  {documents.filter(d => d.statut === 'signé').length}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <span className="text-2xl">✍️</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau des documents */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Document</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Lead</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Statut Lead</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Statut Doc</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{getDocumentIcon(doc.type_document)}</span>
                        <span className="font-medium capitalize">{doc.type_document}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{doc.leads?.nom}</div>
                      {doc.leads?.budget && (
                        <div className="text-sm text-green-600">{doc.leads.budget.toLocaleString()} €</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">
                        <div>{doc.leads?.email}</div>
                        <div>{doc.leads?.telephone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getLeadStatusColor(doc.leads?.statut)}`}>
                        {doc.leads?.statut || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
                        {doc.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <Link
                          to={`/documents/view/${doc.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Voir document
                        </Link>
                        <button
                          onClick={() => window.open(`/dashboard?lead=${doc.lead_id}`, '_blank')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Voir lead
                        </button>
                        {doc.fichier_url && (
                          <button
                            onClick={() => {
                              console.log('Téléchargement du document:', doc.fichier_url);
                            }}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Télécharger
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

        {documents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Aucun document</h3>
            <p className="text-slate-600">Commencez par générer des documents depuis les fiches leads</p>
          </div>
        )}
      </div>
    </div>
  );
}
