import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
// import DocumentService from '../services/documentService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentGenerator({ lead, agencyId, onDocumentGenerated, compact = false, agencyType = 'immobilier' }) {
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);

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
      // Vérifier si les informations de l'agence sont complètes
      if (!agencyProfile?.name || !agencyProfile?.legalName) {
        alert('⚠️ Veuillez compléter les informations de l\'agence et les informations légales dans les Paramètres avant de générer des documents.');
        return;
      }
      
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      
      // Générer le PDF
      const doc = new jsPDF();
      
      // En-tête avec logo si disponible
      if (agencyProfile.logo_url) {
        try {
          doc.addImage(agencyProfile.logo_url, 'PNG', 20, 15, 30, 15);
        } catch (e) {
          console.log('Logo non chargé, utilisation du texte');
        }
      }
      
      doc.setFontSize(20);
      doc.text(`${docType.label.toUpperCase()} - ${lead.nom}`, 20, 50);
      
      // Informations agence (complètes)
      doc.setFontSize(12);
      let yPos = 65;
      doc.text(`${agencyProfile.legalName || agencyProfile.name}`, 20, yPos);
      yPos += 10;
      if (agencyProfile.legalStatus) {
        doc.text(`${agencyProfile.legalStatus}`, 20, yPos);
        yPos += 10;
      }
      if (agencyProfile.registrationNumber) {
        doc.text(`${agencyProfile.registrationNumber}`, 20, yPos);
        yPos += 10;
      }
      if (agencyProfile.address) {
        doc.text(`${agencyProfile.address}`, 20, yPos);
        yPos += 10;
      }
      if (agencyProfile.phone) {
        doc.text(`Tél: ${agencyProfile.phone}`, 20, yPos);
        yPos += 10;
      }
      if (agencyProfile.email) {
        doc.text(`Email: ${agencyProfile.email}`, 20, yPos);
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
          content = `Le soussigné ${lead.nom} donne mandat exclusif à ${agencyProfile.legalName || agencyProfile.name} pour la vente du bien situé au [adresse]. Durée: 3 mois. Commission: 5% du prix de vente.`;
          break;
        case 'devis':
          content = `Devis pour services ${agencyType === 'immobilier' ? 'immobiliers' : 'marketing'} - ${lead.nom}\nClient: ${lead.nom}\nAgence: ${agencyProfile.legalName || agencyProfile.name}\nHonoraires: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.03 : 0.05))} (${agencyType === 'immobilier' ? '3%' : '5%'})\n${agencyType === 'immobilier' ? 'Accompagnement vente: Inclus\nMarketing: Inclus' : 'Services: Marketing digital, gestion réseaux sociaux\nCréation contenu: Inclus'}`;
          break;
        case 'compromis':
          content = `COMPROMIS DE VENTE\nVendeur: [Nom du vendeur]\nAcheteur: ${lead.nom}\nBien: [adresse du bien]\nPrix: ${formatBudget(lead.budget || 0)}\nDate: ${new Date().toLocaleDateString()}\nAgence: ${agencyProfile.legalName || agencyProfile.name}\n\nConditions: \n- Accompte 10% à la signature\n- Solde à la levée des clauses suspensives\n- Délai de rétractation: 10 jours`;
          break;
        case 'facture':
          content = `FACTURE N°${Date.now()}\nClient: ${lead.nom}\nPrestataire: ${agencyProfile.legalName || agencyProfile.name}\n${agencyProfile.registrationNumber || ''}\n${agencyProfile.address || ''}\n\nMontant HT: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.03 : 0.05))}\nTVA: 20%\nTotal TTC: ${formatBudget((lead.budget || 0) * (agencyType === 'immobilier' ? 0.036 : 0.06))}\n\n${agencyProfile.paymentConditions || 'Paiement à réception de facture'}`;
          break;
        case 'bon_visite':
          content = `BON DE VISITE\nClient: ${lead.nom}\nBien: [adresse du bien]\nDate: ${new Date().toLocaleDateString()}\nAgent: ${agencyProfile.name || 'Agence'}\nAgence: ${agencyProfile.legalName || agencyProfile.name}\n\nHoraires: [à définir]\nContact: ${agencyProfile.phone || ''}`;
          break;
        case 'contrat':
          content = `CONTRAT DE PRESTATION\nClient: ${lead.nom}\nPrestataire: ${agencyProfile.legalName || agencyProfile.name}\n${agencyProfile.registrationNumber || ''}\n${agencyProfile.address || ''}\n\nServices: Marketing digital, gestion réseaux sociaux\nDurée: 6 mois\nMontant: ${formatBudget((lead.budget || 0) * 0.05)}\n\n${agencyProfile.paymentConditions || 'Paiement mensuel'}`;
          break;
        case 'rapport':
          content = `RAPPORT DE PERFORMANCE\nClient: ${lead.nom}\nPériode: ${new Date().toLocaleDateString()}\nAgence: ${agencyProfile.legalName || agencyProfile.name}\n\nPerformances:\n- Taux d'engagement: [à compléter]\n- Croissance abonnés: [à compléter]\n- Taux de conversion: [à compléter]\n\nRecommandations: [à compléter]`;
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
      
      if (agencyProfile.legalMention) {
        doc.text(agencyProfile.legalMention, 105, pageHeight - 5, { align: 'center' });
      }
      
      // Télécharger le PDF
      doc.save(`${docType.label}_${lead.nom.replace(/\s+/g, '_')}.pdf`);
      
      // Créer l'entrée dans la base de données
      const { data: documentData, error: insertError } = await supabase
        .from('documents')
        .insert({
          lead_id: lead.id,
          agency_id: agencyId,
          type_document: docType.label.toLowerCase(),
          statut: 'généré',
          fichier_url: `${docType.label}_${lead.nom.replace(/\s+/g, '_')}.pdf`,
          contenu: JSON.stringify({
            template: docType.id,
            category: docType.category,
            generatedAt: new Date().toISOString(),
            agencyData: agencyProfile,
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
        console.log('Document créé avec ID:', documentData.id);
      }
      
      // Mettre à jour le statut du lead selon le type de document
      await updateLeadStatus(docType.id);
      
      // Notifier le parent
      if (onDocumentGenerated) {
        onDocumentGenerated({
          type: docType.label,
          leadId: lead.id,
          timestamp: new Date(),
          documentId: documentData?.id
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
    </div>
  );
}
