import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentManager({ lead, agencyId, onDocumentGenerated }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userAgencyId, setUserAgencyId] = useState(null);

  useEffect(() => {
    if (lead?.id) fetchDocuments();
    fetchUserAgencyId();
  }, [lead]);

  const fetchUserAgencyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.agency_id) {
          setUserAgencyId(profile.agency_id);
        }
      }
    } catch (error) {
      console.error('Erreur récupération agency_id:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
      setDocuments([]);
    }
  };

  const generateDocument = async (docType) => {
    setLoading(true);
    
    try {
      // Créer l'entrée dans la table documents
      const documentData = {
        lead_id: lead.id,
        agency_id: userAgencyId || agencyId,
        type: docType.toLowerCase(), // 'devis' | 'contrat' | 'facture'
        statut: 'généré',
        file_url: null, // Pas de fichier pour l'instant
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single();
      
      if (error) {
        console.error('Erreur lors de la création du document:', error);
      } else {
        // Rafraîchir la liste des documents
        fetchDocuments();
        console.log('Document créé avec succès:', data);
        
        // Notifier le parent pour rafraîchir l'historique et la timeline
        if (onDocumentGenerated) {
          onDocumentGenerated(data);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la génération du document:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => generateDocument('Devis')} 
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer Devis'}
        </button>
        <button 
          onClick={() => generateDocument('Contrat')} 
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer Contrat'}
        </button>
      </div>
      
      <div className="space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📄</div>
            <p>Aucun document généré pour ce lead</p>
            <p className="text-sm">Cliquez sur les boutons ci-dessus pour créer des documents</p>
          </div>
        ) : (
          documents.map(doc => (
            <div key={doc.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {doc.type === 'devis' && '💰'}
                  {doc.type === 'contrat' && '📋'}
                  {doc.type === 'facture' && '🧾'}
                </div>
                <div>
                  <span className="font-medium capitalize">{doc.type}</span>
                  <div className="text-xs text-gray-500">
                    Créé le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  doc.statut === 'généré' ? 'bg-green-100 text-green-800' :
                  doc.statut === 'envoyé' ? 'bg-blue-100 text-blue-800' :
                  doc.statut === 'signé' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {doc.statut}
                </span>
                {doc.file_url && (
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    Télécharger
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
