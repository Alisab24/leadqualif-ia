import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentHistory({ leadId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Vérification de sécurité
  if (!leadId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">⚠️ Lead non sélectionné</p>
      </div>
    );
  }

  useEffect(() => {
    fetchDocuments();
  }, [leadId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // Vérification si la table documents existe
      const { error: tableError } = await supabase
        .from('documents')
        .select('id')
        .limit(1);
      
      if (tableError) {
        setDocuments([]);
        return;
      }

      // Récupération des documents
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      
    } catch (error) {
      console.error('Erreur chargement documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'devis': return '💰';
      case 'facture': return '🧾';
      case 'mandat': return '📋';
      case 'contrat': return '📄';
      default: return '📄';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'brouillon': return 'bg-gray-100 text-gray-800';
      case 'généré': return 'bg-green-100 text-green-800';
      case 'envoyé': return 'bg-blue-100 text-blue-800';
      case 'signé': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-sm text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm">Aucun document généré pour ce lead</p>
      </div>
    );
  }

  return (
    <div className="border-t pt-6">
      <h3 className="font-bold text-lg mb-4">📜 Historique documentaire</h3>
      
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-3">
              <span className="text-xl">{getDocumentIcon(doc.type_document)}</span>
              <div>
                <span className="font-medium capitalize">
                  {doc.type_document} {doc.type_document === 'devis' ? 'généré' : 
                   doc.type_document === 'facture' ? 'émise' : 
                   doc.type_document === 'mandat' ? 'signé' : 'créé'}
                </span>
                <div className="text-xs text-gray-500">
                  {doc.created_at ? 
                    new Date(doc.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }) : 
                    'Date inconnue'
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
                Statut : {doc.statut}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
