import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentHistory({ leadId, refreshTrigger }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (leadId) fetchDocuments();
  }, [leadId, refreshTrigger]);


  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Erreur chargement historique documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'devis': return '💰';
      case 'contrat': return '📋';
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
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-gray-700 mb-3">Historique des documents</h4>
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
          <div className="flex items-center space-x-3">
            <span className="text-xl">{getDocumentIcon(doc.type)}</span>
            <div>
              <span className="font-medium capitalize">{doc.type}</span>
              <div className="text-xs text-gray-500">
                {new Date(doc.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.statut)}`}>
              {doc.statut}
            </span>
            {doc.file_url && (
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Télécharger
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
