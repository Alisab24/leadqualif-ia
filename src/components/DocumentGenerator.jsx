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
      
      // Configuration du document
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      let currentY = margin;
      
      // Couleurs professionnelles
      const primaryColor = [59, 130, 246]; // blue-500
      const textGray = [107, 114, 128]; // gray-500
      const textLight = [243, 244, 246]; // gray-100
      
      // Header document
      doc.setFillColor(...textLight);
      doc.rect(0, 0, pageWidth, 80, 'F');
      
      // Logo agence
      if (profileToUse?.logo_url) {
        try {
          doc.addImage(profileToUse.logo_url, 'PNG', margin, 15, 40, 20);
        } catch (e) {
          console.log('Logo non chargé, utilisation du texte');
        }
      }
      
      // Informations agence dans header
      doc.setFontSize(20);
      doc.setTextColor(...primaryColor);
      doc.setFont(undefined, 'bold');
      doc.text(profileToUse?.name || 'Agence', pageWidth - margin - 80, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      if (profileToUse?.address) {
        doc.text(profileToUse.address, pageWidth - margin - 80, 35, { align: 'right' });
      }
      if (profileToUse?.email) {
        doc.text(profileToUse.email, pageWidth - margin - 80, 42, { align: 'right' });
      }
      if (profileToUse?.phone) {
        doc.text(profileToUse.phone, pageWidth - margin - 80, 49, { align: 'right' });
      }
      
      // Type et numéro du document
      currentY = 100;
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(docType.label.toUpperCase(), margin, currentY);
      
      doc.setFontSize(12);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      const documentNumber = `DOC-${Date.now().toString().slice(-6)}`;
      doc.text(`N°: ${documentNumber}`, margin, currentY + 10);
      doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, margin, currentY + 17);
      
      // Ligne de séparation
      doc.setDrawColor(...textGray);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 25, pageWidth - margin, currentY + 25);
      
      // Bloc client
      currentY = currentY + 40;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text('CLIENT', margin, currentY);
      
      currentY += 10;
      doc.setFontSize(11);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      
      const clientInfo = [
        lead.nom || 'Non spécifié',
        lead.email || 'Non spécifié',
        lead.telephone || 'Non spécifié',
        lead.type_bien || 'Projet non spécifié',
        `Budget: ${formatBudget(lead.budget || 0)}`
      ];
      
      clientInfo.forEach(info => {
        doc.text(info, margin, currentY);
        currentY += 7;
      });
      
      // Ligne de séparation
      doc.setDrawColor(...textGray);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 5, pageWidth - margin, currentY + 5);
      
      // Corps du document
      currentY += 15;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text('DÉTAILS', margin, currentY);
      
      currentY += 15;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      
      // Contenu structuré selon type
      let content = '';
      switch (docType.id) {
        case 'mandat':
          content = `OBJET: MANDAT EXCLUSIF DE VENTE\n\nLe soussigné ${lead.nom} donne mandat exclusif à ${profileToUse?.name || 'Agence'} pour la vente du bien situé au [adresse du bien].\n\nDURÉE: 3 mois à compter de la date de signature.\n\nCOMMISSION: 5% du prix de vente HT, payable par le vendeur au moment de la signature de l'acte de vente.\n\nENGAGEMENTS:\n- Le vendeur s'engage à ne pas confier de mandat à une autre agence\n- L'agence s'engage à assurer la promotion du bien\n- Les visites seront organisées selon la disponibilité du vendeur`;
          break;
        case 'devis':
          content = `DEVIS N°${documentNumber}\n\nCLIENT: ${lead.nom}\nAGENCE: ${profileToUse?.name || 'Agence'}\nDATE: ${new Date().toLocaleDateString('fr-FR')}\n\nPRESTATIONS PROPOSÉES:\n${agencyType === 'immobilier' ? '• Accompagnement complet à la vente\n• Estimation et valorisation du bien\n• Marketing professionnel (photos, visites virtuelles)\n• Publication sur les plateformes immobilières\n• Gestion des candidatures et négociations\n• Assistance jusqu\'à la signature' : '• Stratégie marketing digitale personnalisée\n• Gestion des réseaux sociaux\n• Création de contenu professionnel\n• Campagnes publicitaires ciblées\n• Analyse des performances\n• Reporting mensuel'}\n\nMONTANT: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.03 : 0.05))} (${agencyType === 'immobilier' ? '3%' : '5%'} du budget projet)\n\nVALIDITÉ: 1 mois à compter de la date d\'émission`;
          break;
        case 'compromis':
          content = `COMPROMIS DE VENTE\n\nVendeur: [Nom du vendeur]\nAcheteur: ${lead.nom}\nBien: [adresse complète du bien]\nPrix de vente: ${formatBudget(lead.budget || 0)}\nDate de signature: ${new Date().toLocaleDateString('fr-FR')}\n\nCLAUSES SUSPENSIVES:\n• Obtention d'un prêt bancaire (si applicable)\n• Accord de la copropriété (si applicable)\n• Autorisation administrative (si applicable)\n\nDÉLAI DE RÉTRACTATION: 10 jours à compter de la signature\n\nACCOMPTE: ${formatBudget((lead.budget || 0) * 0.10)} (10% du prix de vente)\n\nSOLDE: ${formatBudget((lead.budget || 0) * 0.90)} à la levée des clauses suspensives\n\nDATE PRÉVISIONNELLE DE SIGNATURE DÉFINITIVE: [à déterminer]`;
          break;
        case 'facture':
          content = `FACTURE N°${documentNumber}\n\nCLIENT: ${lead.nom}\n${lead.email}\n${lead.telephone}\n\nPRESTATAIRE: ${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.address || ''}\n${profileToUse?.registrationNumber || ''}\n\nDÉTAIL DES PRESTATIONS:\n${agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Services de marketing digital'}\n\nMONTANT HT: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.03 : 0.05))}\nTVA (20%): ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.006 : 0.01))}\nTOTAL TTC: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.036 : 0.06))}\n\n${profileToUse?.paymentConditions || 'Paiement à réception de facture'}\nÉchéance: 30 jours`;
          break;
        case 'bon_visite':
          content = `BON DE VISITE\n\nCLIENT: ${lead.nom}\nTÉLÉPHONE: ${lead.telephone}\nEMAIL: ${lead.email}\n\nBIEN VISITÉ: [adresse du bien]\nDATE DE VISITE: ${new Date().toLocaleDateString('fr-FR')}\nHEURE: [à définir]\n\nAGENT PRÉSENT: ${profileToUse?.name || 'Agence'}\nCONTACT: ${profileToUse?.phone || ''}\n\nOBSERVATIONS:\n[Notes et remarques sur la visite]\n\nPROCHAINES ÉTAPES:\n• Retour client sous 48h\n• Proposition d'offre (si intérêt)\n• Prise de contact vendeur\n• Préparation compromis (si accord)`;
          break;
        case 'contrat':
          content = `CONTRAT DE PRESTATION DE SERVICES\n\nCLIENT: ${lead.nom}\nPRESTATAIRE: ${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.registrationNumber || ''}\n\nOBJET: Prestations de marketing digital\n\nDURÉE: 6 mois à compter de la date de signature\n\nPRESTATIONS INCLUSES:\n• Stratégie marketing personnalisée\n• Gestion des réseaux sociaux (3 plateformes)\n• Création de contenu mensuel (10 publications)\n• Campagnes publicitaires mensuelles\n• Analyse et reporting mensuel\n• Optimisation continue\n\nMONTANT: ${formatBudget((lead.budget || 0) * 0.05)} par mois\n\nCONDITIONS DE RÉSILIATION:\nPréavis de 30 jours par courriel recommandé`;
          break;
        case 'rapport':
          content = `RAPPORT DE PERFORMANCE\n\nCLIENT: ${lead.nom}\nPÉRIODE: ${new Date().toLocaleDateString('fr-FR')}\nAGENCE: ${profileToUse?.name || 'Agence'}\n\nINDICATEURS CLÉS:\n\nTAUX D'ENGAGEMENT: [à compléter]%\nCROISSANCE DES ABONNÉS: [à compléter]\nTAUX DE CONVERSION: [à compléter]%\nPORTÉE MOYENNE: [à compléter]\n\nPERFORMANCES PAR PLATEFORME:\n\nInstagram: [à compléter]\nFacebook: [à compléter]\nLinkedIn: [à compléter]\n\nRECOMMANDATIONS:\n• [Recommandation 1]\n• [Recommandation 2]\n• [Recommandation 3]\n\nPROCHAINES ACTIONS:\n• Optimisation contenu\n• Nouvelles campagnes\n• Analyse concurrentielle`;
          break;
      }
      
      // Découper le contenu en lignes pour éviter le débordement
      const splitContent = doc.splitTextToSize(content, pageWidth - 2 * margin);
      splitContent.forEach(line => {
        if (currentY > pageHeight - 60) {
          doc.addPage();
          currentY = margin;
        }
        doc.text(line, margin, currentY);
        currentY += 6;
      });
      
      // Footer
      const footerY = pageHeight - 40;
      doc.setDrawColor(...textGray);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Mentions légales
      doc.setFontSize(8);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      if (profileToUse?.legalMention) {
        const splitLegal = doc.splitTextToSize(profileToUse.legalMention, pageWidth - 2 * margin);
        splitLegal.forEach((line, index) => {
          doc.text(line, margin, footerY + 10 + (index * 5));
        });
      }
      
      // Signature
      doc.text('Signature:', margin, pageHeight - 15);
      doc.line(margin + 35, pageHeight - 15, margin + 100, pageHeight - 15);
      
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-200 bg-slate-50 shrink-0">
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
            
            {/* Content - Preview responsive */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              <div className="flex justify-center">
                <div className="bg-white shadow-lg" style={{ 
                  width: '100%', 
                  maxWidth: '842px', // A4 width in pixels at 96 DPI
                  height: 'auto',
                  transform: 'scale(0.9)',
                  transformOrigin: 'top center'
                }}>
                  <iframe
                    src={generatedDocument.pdfUrl}
                    className="w-full border-0"
                    style={{ 
                      height: '1189px', // A4 height in pixels at 96 DPI
                      minHeight: '600px'
                    }}
                    title={`Aperçu ${generatedDocument.type}`}
                  />
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-6 border-t border-slate-200 bg-slate-50 shrink-0">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-slate-600">
                <div>
                  <span className="font-medium">Agence:</span> {generatedDocument.agencyData?.name || 'Non spécifiée'}
                </div>
                <div>
                  <span className="font-medium">Devise:</span> {generatedDocument.agencyData?.devise || 'EUR'}
                </div>
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={downloadDocument}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <span>⬇</span>
                  Télécharger
                </button>
                <button
                  onClick={printDocument}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
