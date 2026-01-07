import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DevisTemplate from './templates/DevisTemplate';
import FactureTemplate from './templates/FactureTemplate';
import MandatTemplate from './templates/MandatTemplate';

export default function DocumentManager({ lead, agencyId, onDocumentGenerated }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userAgencyId, setUserAgencyId] = useState(null);
  const [agencyInfo, setAgencyInfo] = useState(null);
  const [showTemplate, setShowTemplate] = useState(null);

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
          fetchAgencyInfo(profile.agency_id);
        }
      }
    } catch (error) {
      console.error('Erreur récupération agency_id:', error);
    }
  };

  const fetchAgencyInfo = async (agencyId) => {
    try {
      const { data: settings } = await supabase
        .from('agency_settings')
        .select('*')
        .eq('agency_id', agencyId)
        .single();
      
      if (settings) {
        setAgencyInfo(settings);
      }
    } catch (error) {
      console.error('Erreur récupération infos agence:', error);
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
      // Afficher le template dans une nouvelle fenêtre
      setShowTemplate(docType);
      
      // Créer l'entrée dans la table documents
      const documentData = {
        lead_id: lead.id,
        agency_id: userAgencyId || agencyId,
        type_document: docType.toLowerCase(),
        statut: 'généré',
        fichier_url: `${docType}_${lead.nom}_${Date.now()}.pdf`,
        contenu: JSON.stringify({
          client: lead.nom,
          email: lead.email,
          telephone: lead.telephone,
          budget: lead.budget,
          type_bien: lead.type_bien,
          generated_at: new Date().toISOString()
        })
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

  const downloadPDF = async (docType) => {
    try {
      // Utiliser jsPDF basique pour le téléchargement
      const doc = new jsPDF();
      
      // Ajouter le contenu du template de manière simplifiée
      doc.setFontSize(16);
      doc.text(`${docType.toUpperCase()}`, 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Client: ${lead?.nom || 'N/A'}`, 20, 40);
      doc.text(`Email: ${lead?.email || 'N/A'}`, 20, 50);
      doc.text(`Téléphone: ${lead?.telephone || 'N/A'}`, 20, 60);
      doc.text(`Budget: ${lead?.budget ? `${lead.budget.toLocaleString()} €` : 'Non spécifié'}`, 20, 70);
      doc.text(`Type de bien: ${lead?.type_bien || 'N/A'}`, 20, 80);
      
      doc.text(`Agence: ${agencyInfo?.nom || 'LeadQualif IA'}`, 20, 100);
      doc.text(`Email agence: ${agencyInfo?.email || 'N/A'}`, 20, 110);
      
      doc.setFontSize(10);
      doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 20, 140);
      doc.text(`Document N°: ${docType}-${Date.now()}`, 20, 150);
      
      // Sauvegarder le PDF
      const fileName = `${docType}_${lead?.nom}_${Date.now()}.pdf`;
      doc.save(fileName);
      
      // Fermer le template
      setShowTemplate(null);
    } catch (error) {
      console.error('Erreur lors du téléchargement PDF:', error);
      setShowTemplate(null);
    }
  };

  const printDocument = () => {
    window.print();
  };

  const getTemplateComponent = (docType) => {
    switch (docType) {
      case 'Devis':
        return (
          <DevisTemplate 
            agency={agencyInfo}
            lead={lead}
            documentNumber={`DEV-${Date.now()}`}
          />
        );
      case 'Facture':
        return (
          <FactureTemplate 
            agency={agencyInfo}
            lead={lead}
            documentNumber={`FAC-${Date.now()}`}
          />
        );
      case 'Mandat':
        return (
          <MandatTemplate 
            agency={agencyInfo}
            lead={lead}
            documentNumber={`MANDAT-${Date.now()}`}
          />
        );
      default:
        return null;
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
          onClick={() => generateDocument('Facture')} 
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer Facture'}
        </button>
        <button 
          onClick={() => generateDocument('Mandat')} 
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer Mandat'}
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
                  {doc.type_document === 'devis' && '💰'}
                  {doc.type_document === 'contrat' && '📋'}
                  {doc.type_document === 'mandat' && '✍️'}
                  {doc.type_document === 'facture' && '🧾'}
                  {doc.type_document === 'autre' && '📄'}
                </div>
                <div>
                  <span className="font-medium capitalize">{doc.type_document}</span>
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
                {doc.fichier_url && (
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    Télécharger
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal pour afficher le template */}
      {showTemplate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {showTemplate} - {lead?.nom}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadPDF(showTemplate)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  📥 Télécharger PDF
                </button>
                <button
                  onClick={printDocument}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  🖨️ Imprimer
                </button>
                <button
                  onClick={() => setShowTemplate(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                >
                  ✕ Fermer
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
              <div id="document-template">
                {getTemplateComponent(showTemplate)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
