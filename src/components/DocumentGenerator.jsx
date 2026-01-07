import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
// import DocumentService from '../services/documentService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentGenerator({ lead, agencyId, onDocumentGenerated, compact = false, agencyType = 'immobilier' }) {
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Templates de documents selon type d'agence
  const getDocumentTypes = () => {
    if (agencyType === 'immobilier') {
      return [
        { id: 'mandat', label: 'Mandat', icon: '📄', category: 'IMMO' },
        { id: 'devis', label: 'Devis', icon: '📋', category: 'IMMO' },
        { id: 'compromis', label: 'Compromis', icon: '🤝', category: 'IMMO' },
        { id: 'facture', label: 'Facture', icon: '🧾', category: 'IMMO' },
        { id: 'bon_visite', label: 'Bon de visite', icon: '🏠', category: 'IMMO' }
      ];
    } else {
      return [
        { id: 'devis', label: 'Devis', icon: '📋', category: 'SMMA' },
        { id: 'contrat', label: 'Contrat de prestation', icon: '📝', category: 'SMMA' },
        { id: 'facture', label: 'Facture', icon: '🧾', category: 'SMMA' },
        { id: 'rapport', label: 'Rapport de performance', icon: '📊', category: 'SMMA' }
      ];
    }
  };

  const documentTypes = getDocumentTypes();

  // Fonction pour formater le budget selon la devise de l'agence
  const formatBudget = (amount) => {
    if (!agencyProfile) return `${amount.toLocaleString()} €`;
    
    const { devise, symbole_devise, format_devise } = agencyProfile;
    
    switch (devise) {
      case 'XOF':
        return `${amount.toLocaleString()} ${symbole_devise}`;
      case 'CAD':
        return `${symbole_devise}${amount.toLocaleString()}`;
      case 'EUR':
      default:
        return `${amount.toLocaleString()} ${symbole_devise}`;
    }
  };

  React.useEffect(() => {
    const fetchAgencyProfile = async () => {
      if (agencyId) {
        // Essayer de récupérer depuis les profiles d'abord
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('agency_id', agencyId)
          .single();
        
        if (profileData) {
          setAgencyProfile({
            name: profileData.nom_agence || profileData.nom_legal || 'Agence',
            address: profileData.adresse_legale || profileData.adresse,
            phone: profileData.telephone,
            email: profileData.email,
            legalName: profileData.nom_legal,
            legalStatus: profileData.statut_juridique,
            registrationNumber: profileData.numero_enregistrement,
            legalMention: profileData.mention_legale,
            paymentConditions: profileData.conditions_paiement
          });
        } else {
          // Fallback sur la table agencies si elle existe
          const { data } = await supabase
            .from('agencies')
            .select('*')
            .eq('id', agencyId)
            .single();
          setAgencyProfile(data);
        }
      }
    };
    fetchAgencyProfile();
  }, [agencyId]);

  const generateDocument = async (docType) => {
    setLoading(true);
    
    try {
      // Vérification non bloquante avec valeurs par défaut
      let profileToUse = agencyProfile;
      
      if (!agencyProfile?.name || !agencyProfile?.legalName) {
        console.warn('⚠️ Informations agence incomplètes - utilisation des valeurs par défaut');
        
        // Valeurs par défaut pour garantir la génération
        profileToUse = {
          name: agencyProfile?.nom_agence || 'Agence',
          legalName: agencyProfile?.nom_legal || '—',
          address: agencyProfile?.adresse || '—',
          phone: agencyProfile?.telephone || '—',
          email: agencyProfile?.email || '—',
          legalStatus: agencyProfile?.statut_juridique || 'À compléter',
          registrationNumber: agencyProfile?.numero_enregistrement || '—',
          legalMention: agencyProfile?.mention_legale || '—',
          paymentConditions: agencyProfile?.conditions_paiement || '—',
          devise: agencyProfile?.devise || 'EUR',
          symbole_devise: agencyProfile?.symbole_devise || '€'
        };
      }
      
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      
      // Générer le PDF
      const doc = new jsPDF();
      
      // En-tête avec logo si disponible
      if (profileToUse?.logo_url) {
        try {
          doc.addImage(profileToUse.logo_url, 'PNG', 20, 15, 30, 15);
        } catch (e) {
          console.log('Logo non chargé, utilisation du texte');
        }
      }
      
      doc.setFontSize(20);
      doc.text(`${docType.label.toUpperCase()} - ${lead.nom}`, 20, 50);
      
      // Informations agence (complètes)
      doc.setFontSize(12);
      let yPos = 65;
      doc.text(`${profileToUse.legalName || profileToUse.name}`, 20, yPos);
      yPos += 10;
      if (profileToUse.legalStatus) {
        doc.text(`${profileToUse.legalStatus}`, 20, yPos);
        yPos += 10;
      }
      if (profileToUse.registrationNumber) {
        doc.text(`${profileToUse.registrationNumber}`, 20, yPos);
        yPos += 10;
      }
      if (profileToUse.address) {
        doc.text(`${profileToUse.address}`, 20, yPos);
        yPos += 10;
      }
      if (profileToUse.phone) {
        doc.text(`Tél: ${profileToUse.phone}`, 20, yPos);
        yPos += 10;
      }
      if (profileToUse.email) {
        doc.text(`Email: ${profileToUse.email}`, 20, yPos);
        yPos += 10;
      }
      
      // Informations client
      yPos += 10;
      doc.setFontSize(14);
      doc.text('INFORMATIONS CLIENT', 20, yPos);
      yPos += 15;
      doc.setFontSize(11);
      doc.text(`Nom: ${lead.nom}`, 20, yPos);
      yPos += 10;
      doc.text(`Email: ${lead.email}`, 20, yPos);
      yPos += 10;
      doc.text(`Téléphone: ${lead.telephone}`, 20, yPos);
      yPos += 10;
      doc.text(`Budget: ${formatBudget(lead.budget || 0)}`, 20, yPos);
      yPos += 10;
      doc.text(`Type de bien: ${lead.type_bien || 'Non spécifié'}`, 20, yPos);
      
      // Contenu spécifique selon type
      yPos += 15;
      doc.setFontSize(14);
      doc.text('DÉTAILS DU DOCUMENT', 20, yPos);
      yPos += 15;
      
      let content = '';
      switch (docType.id) {
        case 'mandat':
          content = `Le soussigné ${lead.nom} donne mandat exclusif à ${profileToUse.legalName || profileToUse.name} pour la vente du bien situé au [adresse]. Durée: 3 mois. Commission: 5% du prix de vente.`;
          break;
        case 'devis':
          content = `Devis pour services ${agencyType === 'immobilier' ? 'immobiliers' : 'marketing'} - ${lead.nom}\nClient: ${lead.nom}\nAgence: ${profileToUse.legalName || profileToUse.name}\nHonoraires: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.03 : 0.05))} (${agencyType === 'immobilier' ? '3%' : '5%'})\n${agencyType === 'immobilier' ? 'Accompagnement vente: Inclus\nMarketing: Inclus' : 'Services: Marketing digital, gestion réseaux sociaux\nCréation contenu: Inclus'}`;
          break;
        case 'compromis':
          content = `COMPROMIS DE VENTE\nVendeur: [Nom du vendeur]\nAcheteur: ${lead.nom}\nBien: [adresse du bien]\nPrix: ${formatBudget(lead.budget || 0)}\nDate: ${new Date().toLocaleDateString()}\nAgence: ${profileToUse.legalName || profileToUse.name}\n\nConditions: \n- Accompte 10% à la signature\n- Solde à la levée des clauses suspensives\n- Délai de rétractation: 10 jours`;
          break;
        case 'facture':
          content = `FACTURE N°${Date.now()}\nClient: ${lead.nom}\nPrestataire: ${profileToUse.legalName || profileToUse.name}\n${profileToUse.registrationNumber || ''}\n${profileToUse.address || ''}\n\nMontant HT: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.03 : 0.05))}\nTVA: 20%\nTotal TTC: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.036 : 0.06))}\n\n${profileToUse.paymentConditions || 'Paiement à réception de facture'}`;
          break;
        case 'bon_visite':
          content = `BON DE VISITE\nClient: ${lead.nom}\nBien: [adresse du bien]\nDate: ${new Date().toLocaleDateString()}\nAgent: ${profileToUse.name || 'Agence'}\nAgence: ${profileToUse.legalName || profileToUse.name}\n\nHoraires: [à définir]\nContact: ${profileToUse.phone || ''}`;
          break;
        case 'contrat':
          content = `CONTRAT DE PRESTATION\nClient: ${lead.nom}\nPrestataire: ${profileToUse.legalName || profileToUse.name}\n${profileToUse.registrationNumber || ''}\n${profileToUse.address || ''}\n\nServices: Marketing digital, gestion réseaux sociaux\nDurée: 6 mois\nMontant: ${formatBudget((lead.budget || 0) * 0.05)}\n\n${profileToUse.paymentConditions || 'Paiement mensuel'}`;
          break;
        case 'rapport':
          content = `RAPPORT DE PERFORMANCE\nClient: ${lead.nom}\nPériode: ${new Date().toLocaleDateString()}\nAgence: ${profileToUse.legalName || profileToUse.name}\n\nPerformances:\n- Taux d'engagement: [à compléter]\n- Croissance abonnés: [à compléter]\n- Taux de conversion: [à compléter]\n\nRecommandations: [à compléter]`;
          break;
      }
      
      doc.setFontSize(11);
      const splitText = doc.splitTextToSize(content, 170);
      doc.text(splitText, 20, yPos);
      
      // Pied de page avec mentions légales
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Généré par LeadQualif IA - CRM Intelligent", 105, pageHeight - 10, { align: 'center' });
      
      if (profileToUse.legalMention) {
        doc.text(profileToUse.legalMention, 105, pageHeight - 5, { align: 'center' });
      }
      
      // Convertir le PDF en Blob pour la preview
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Créer l'objet document pour la preview
      const documentData = {
        id: Date.now(),
        type: docType.label,
        typeKey: docType.id,
        pdfUrl: pdfUrl,
        pdfBlob: pdfBlob,
        fileName: `${docType.label}_${lead.nom.replace(/\s+/g, '_')}.pdf`,
        agencyData: profileToUse,
        clientData: {
          nom: lead.nom,
          email: lead.email,
          telephone: lead.telephone,
          budget: lead.budget,
          type_bien: lead.type_bien
        },
        generatedAt: new Date().toISOString()
      };
      
      setGeneratedDocument(documentData);
      setShowPreview(true);
      
      // Créer l'entrée dans la base de données
      const { data: dbDocumentData, error: insertError } = await supabase
        .from('documents')
        .insert({
          lead_id: lead.id,
          agency_id: agencyId,
          type_document: docType.label.toLowerCase(),
          titre: `${docType.label} - ${lead.nom}`,
          contenu_html: JSON.stringify({
            template: docType.id,
            category: docType.category,
            generatedAt: new Date().toISOString(),
            agencyData: profileToUse,
            clientData: {
              nom: lead.nom,
              email: lead.email,
              telephone: lead.telephone,
              budget: lead.budget,
              type_bien: lead.type_bien
            }
          }),
          montant: lead.budget || 0,
          devise: profileToUse?.devise || 'EUR',
          client_nom: lead.nom,
          client_email: lead.email,
          client_telephone: lead.telephone,
          statut: 'généré',
          fichier_url: documentData.fileName,
          contenu: JSON.stringify({
            template: docType.id,
            category: docType.category,
            generatedAt: new Date().toISOString(),
            agencyData: profileToUse,
            clientData: {
              nom: lead.nom,
              email: lead.email,
              telephone: lead.telephone,
              budget: lead.budget,
              type_bien: lead.type_bien
            }
          }),
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Erreur insertion document:', insertError);
      } else {
        console.log('Document créé avec ID:', dbDocumentData.id);
      }
      
      // Mettre à jour le statut du lead selon le type de document
      await updateLeadStatus(docType.id);
      
      // Notifier le parent
      if (onDocumentGenerated) {
        onDocumentGenerated({
          type: docType.label,
          leadId: lead.id,
          timestamp: new Date(),
          documentId: dbDocumentData?.id
        });
      }
      
    } catch (error) {
      console.error('Erreur génération document:', error);
      alert('Erreur lors de la génération du document: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (documentType) => {
    let newStatus = lead.statut;
    
    switch (documentType) {
      case 'mandat':
        newStatus = 'Mandat signé';
        break;
      case 'devis':
        newStatus = 'Offre en cours';
        break;
      case 'facture':
        newStatus = 'Gagné';
        break;
      case 'bon_visite':
        newStatus = 'Visite planifiée';
        break;
      default:
        newStatus = 'Document généré';
    }
    
    try {
      await supabase
        .from('leads')
        .update({ statut: newStatus })
        .eq('id', lead.id);
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
    }
  };

  // Fonction pour télécharger le document
  const downloadDocument = () => {
    if (generatedDocument?.pdfBlob) {
      const link = document.createElement('a');
      link.href = generatedDocument.pdfUrl;
      link.download = generatedDocument.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Fonction pour imprimer le document
  const printDocument = () => {
    if (generatedDocument?.pdfBlob) {
      const printWindow = window.open(generatedDocument.pdfUrl, '_blank');
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Fonction pour fermer la preview
  const closePreview = () => {
    setShowPreview(false);
    if (generatedDocument?.pdfUrl) {
      URL.revokeObjectURL(generatedDocument.pdfUrl);
    }
    setGeneratedDocument(null);
  };

  if (compact) {
    // Version compacte pour les cartes Kanban
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-600 mb-2">📄 Documents</p>
        <div className="grid grid-cols-2 gap-1">
          {documentTypes.slice(0, 4).map(docType => (
            <button
              key={docType.id}
              onClick={() => generateDocument(docType)}
              disabled={loading}
              className="text-xs bg-blue-50 text-blue-600 p-1.5 rounded hover:bg-blue-100 disabled:opacity-50 flex items-center justify-center gap-1"
              title={`Générer ${docType.label}`}
            >
              <span>{docType.icon}</span>
              <span className="hidden sm:inline">{docType.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Version complète pour la modale
  return (
    <div className="space-y-4">
      <h4 className="font-bold text-slate-800 flex items-center gap-2">
        📄 Génération de Documents
      </h4>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {documentTypes.map(docType => (
          <button
            key={docType.id}
            onClick={() => generateDocument(docType)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition disabled:opacity-50"
          >
            <span className="text-2xl mb-2">{docType.icon}</span>
            <span className="text-sm font-medium">{docType.label}</span>
            <span className="text-xs text-slate-500">{docType.category}</span>
          </button>
        ))}
      </div>
      
      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-slate-600">Génération en cours...</p>
        </div>
      )}
      
      {/* Preview Modal */}
      {showPreview && generatedDocument && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📄</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{generatedDocument.type}</h3>
                  <p className="text-sm text-slate-600">
                    {generatedDocument.clientData?.nom} • {new Date(generatedDocument.generatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <button 
                onClick={closePreview}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={generatedDocument.pdfUrl}
                className="w-full h-full border-0"
                title={`Aperçu ${generatedDocument.type}`}
              />
            </div>
            
            {/* Actions */}
            <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Agence:</span> {generatedDocument.agencyData?.name || 'Non spécifiée'}
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Devise:</span> {generatedDocument.agencyData?.devise || 'EUR'}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={downloadDocument}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <span>⬇</span>
                  Télécharger
                </button>
                <button
                  onClick={printDocument}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <span>🖨</span>
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
