import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [agencyType, setAgencyType] = useState('immobilier');
  const [filter, setFilter] = useState('tous');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocs();
    fetchAgencyType();
  }, []);

  const fetchAgencyType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('type_agence')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.type_agence) {
          setAgencyType(profile.type_agence);
        }
      }
    } catch (error) {
      console.error('Erreur récupération type agence:', error);
    }
  };

  const fetchDocs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🎯 CORRECTION : Utiliser user_id au lieu de agency_user_id
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', {ascending: false});
      
      if (data) {
        // 🎯 RÉCUPÉRER LES LEADS SÉPARÉMENT
        const leadIds = [...new Set(data.map(doc => doc.lead_id))];
        if (leadIds.length > 0) {
          const { data: leads } = await supabase
            .from('leads')
            .select('id, nom, email, telephone')
            .in('id', leadIds);
          
          // 🎯 COMBINER LES DONNÉES
          const docsWithLeads = data.map(doc => ({
            ...doc,
            leads: leads.find(lead => lead.id === doc.lead_id) || null
          }));
          
          setDocs(docsWithLeads);
        } else {
          setDocs(data);
        }
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour formater le montant selon la devise
  const formatAmount = (amount, currency) => {
    if (!amount) return '—';
    
    switch (currency) {
      case 'XOF':
        return `${amount.toLocaleString()} FCFA`;
      case 'CAD':
        return `$${amount.toLocaleString()}`;
      case 'EUR':
      default:
        return `${amount.toLocaleString()} €`;
    }
  };

  // Types de documents selon type d'agence
  const getDocumentTypes = () => {
    if (agencyType === 'immobilier') {
      return [
        { id: 'tous', label: 'Tous', icon: '📄' },
        { id: 'mandat', label: 'Mandats', icon: '📄' },
        { id: 'devis', label: 'Devis', icon: '📋' },
        { id: 'compromis', label: 'Compromis', icon: '🤝' },
        { id: 'facture', label: 'Factures', icon: '🧾' },
        { id: 'bon de visite', label: 'Bons de visite', icon: '🏠' }
      ];
    } else {
      return [
        { id: 'tous', label: 'Tous', icon: '📄' },
        { id: 'devis', label: 'Devis', icon: '📋' },
        { id: 'contrat de prestation', label: 'Contrats', icon: '📝' },
        { id: 'facture', label: 'Factures', icon: '🧾' },
        { id: 'rapport de performance', label: 'Rapports', icon: '📊' }
      ];
    }
  };

  // Filtrer les documents selon le filtre sélectionné
  const filteredDocs = filter === 'tous' 
    ? docs 
    : docs.filter(doc => doc.type_document === filter);

  // Fonction pour obtenir l'icône selon le type de document
  const getDocumentIcon = (type) => {
    const iconMap = {
      'mandat': '📄',
      'devis': '📋',
      'compromis': '🤝',
      'facture': '🧾',
      'bon de visite': '🏠',
      'contrat de prestation': '📝',
      'rapport de performance': '📊'
    };
    return iconMap[type] || '📄';
  };

  // Fonction pour obtenir la couleur selon le statut
  const getStatusColor = (status) => {
    const colorMap = {
      'généré': 'bg-green-100 text-green-800',
      'envoyé': 'bg-blue-100 text-blue-800',
      'signé': 'bg-purple-100 text-purple-800',
      'brouillon': 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">📂 Centre de Documents</h1>
          <p className="text-slate-600">
            Documents {agencyType === 'immobilier' ? 'immobiliers' : 'SMMA'} - {filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Filtres par type de document */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {getDocumentTypes().map(docType => (
              <button
                key={docType.id}
                onClick={() => setFilter(docType.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === docType.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span className="mr-2">{docType.icon}</span>
                {docType.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Chargement des documents...</p>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-800">
                  {filter === 'tous' ? 'Tous les documents' : getDocumentTypes().find(d => d.id === filter)?.label}
                </h3>
                <div className="text-sm text-slate-600">
                  {filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''}
                </div>
              </div>
              
              {filteredDocs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {filteredDocs.map((doc) => (
                    <div key={doc.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* En-tête du document */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getDocumentIcon(doc.type_document)}</span>
                          <div>
                            <h4 className="font-semibold text-slate-900">{doc.titre || doc.type_document}</h4>
                            <p className="text-xs text-slate-500">ID: {doc.id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
                          {doc.statut}
                        </span>
                      </div>
                      
                      {/* Informations client */}
                      <div className="mb-3">
                        <p className="font-medium text-slate-900">{doc.client_nom || doc.leads?.nom || 'Client inconnu'}</p>
                        <p className="text-sm text-slate-600">{doc.client_email || doc.leads?.email || '—'}</p>
                        <p className="text-sm text-slate-600">{doc.client_telephone || doc.leads?.telephone || '—'}</p>
                      </div>
                      
                      {/* Montant et devise */}
                      <div className="mb-3">
                        <p className="text-sm font-medium text-slate-900">
                          Montant: {formatAmount(doc.total_ttc || doc.montant, doc.devise)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Devise: {doc.devise || 'EUR'}
                        </p>
                      </div>
                      
                      {/* Date et fichier */}
                      <div className="mb-4">
                        <p className="text-xs text-slate-500">
                          Généré le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {doc.fichier_url || 'Document.pdf'}
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button 
                          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded hover:bg-blue-100 transition-colors"
                          title="Aperçu"
                        >
                          👁
                        </button>
                        <button 
                          className="flex-1 px-3 py-2 bg-green-50 text-green-600 text-sm font-medium rounded hover:bg-green-100 transition-colors"
                          title="Télécharger"
                        >
                          ⬇
                        </button>
                        <button 
                          className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 text-sm font-medium rounded hover:bg-purple-100 transition-colors"
                          title="Imprimer"
                        >
                          🖨
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <div className="text-4xl mb-4">📄</div>
                  <p className="text-lg font-medium mb-2">Aucun document trouvé</p>
                  <p className="text-sm">
                    {filter === 'tous' 
                      ? "Commencez par générer vos premiers documents depuis le CRM" 
                      : `Aucun ${filter.slice(0, -1)} trouvé pour le moment`
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
