import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
// import DocumentService from '../services/documentService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentGenerator({ lead, agencyId, onDocumentGenerated, compact = false }) {
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);

  // Templates de documents disponibles
  const documentTypes = [
    { id: 'mandat', label: 'Mandat', icon: '📄', category: 'IMMO' },
    { id: 'devis', label: 'Devis', icon: '📋', category: 'IMMO' },
    { id: 'facture', label: 'Facture', icon: '🧾', category: 'IMMO' },
    { id: 'bon_visite', label: 'Bon de visite', icon: '🏠', category: 'IMMO' },
    { id: 'contrat', label: 'Contrat', icon: '📝', category: 'SMMA' },
    { id: 'rapport', label: 'Rapport', icon: '📊', category: 'SMMA' }
  ];

  React.useEffect(() => {
    const fetchAgencyProfile = async () => {
      if (agencyId) {
        const { data } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', agencyId)
          .single();
        setAgencyProfile(data);
      }
    };
    fetchAgencyProfile();
  }, [agencyId]);

  const generateDocument = async (docType) => {
    setLoading(true);
    
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      
      // Générer le PDF
      const doc = new jsPDF();
      
      // En-tête
      doc.setFontSize(20);
      doc.text(`${docType.label.toUpperCase()} - ${lead.nom}`, 20, 30);
      
      // Informations agence
      if (agencyProfile) {
        doc.setFontSize(12);
        doc.text(`${agencyProfile.name}`, 20, 50);
        doc.text(`${agencyProfile.address || ''}`, 20, 60);
        doc.text(`${agencyProfile.phone || ''}`, 20, 70);
        doc.text(`${agencyProfile.email || ''}`, 20, 80);
      }
      
      // Informations client
      doc.setFontSize(14);
      doc.text('INFORMATIONS CLIENT', 20, 100);
      doc.setFontSize(11);
      doc.text(`Nom: ${lead.nom}`, 20, 115);
      doc.text(`Email: ${lead.email}`, 20, 125);
      doc.text(`Téléphone: ${lead.telephone}`, 20, 135);
      doc.text(`Budget: ${(lead.budget || 0).toLocaleString()} €`, 20, 145);
      doc.text(`Type de bien: ${lead.type_bien || 'Non spécifié'}`, 20, 155);
      
      // Contenu spécifique selon type
      doc.setFontSize(14);
      doc.text('DÉTAILS DU DOCUMENT', 20, 180);
      
      let content = '';
      switch (docType.id) {
        case 'mandat':
          content = `Le soussigné ${lead.nom} donne mandat exclusif à ${agencyProfile?.name || 'l\'agence'} pour la vente du bien situé au [adresse]. Durée: 3 mois. Commission: 5% du prix de vente.`;
          break;
        case 'devis':
          content = `Devis pour services immobiliers - ${lead.nom}\nHonoraires: ${((lead.budget || 0) * 0.03).toLocaleString()} € (3%)\nAccompagnement vente: Inclus\nMarketing: Inclus`;
          break;
        case 'facture':
          content = `FACTURE N°${Date.now()}\nClient: ${lead.nom}\nMontant: ${((lead.budget || 0) * 0.03).toLocaleString()} €\nTVA: 20%\nTotal TTC: ${((lead.budget || 0) * 0.036).toLocaleString()} €`;
          break;
        case 'bon_visite':
          content = `BON DE VISITE\nClient: ${lead.nom}\nBien: [adresse du bien]\nDate: ${new Date().toLocaleDateString()}\nAgent: ${agencyProfile?.name || 'Agence'}`;
          break;
        case 'contrat':
          content = `CONTRAT DE SERVICES\nClient: ${lead.nom}\nPrestataire: ${agencyProfile?.name || 'Agence'}\nServices: Marketing digital, gestion réseaux sociaux\nDurée: 6 mois\nMontant: ${((lead.budget || 0) * 0.05).toLocaleString()} €`;
          break;
        case 'rapport':
          content = `RAPPORT D'ACTIVITÉ\nClient: ${lead.nom}\nPériode: ${new Date().toLocaleDateString()}\nPerformances: [à compléter]\nRecommandations: [à compléter]`;
          break;
      }
      
      doc.setFontSize(11);
      const splitText = doc.splitTextToSize(content, 170);
      doc.text(splitText, 20, 195);
      
      // Pied de page
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Généré par LeadQualif IA - CRM Intelligent", 105, pageHeight - 10, { align: 'center' });
      
      // Télécharger le PDF
      doc.save(`${docType.label}_${lead.nom}.pdf`);
      
      // Créer l'entrée dans la base de données
      // await DocumentService.createDocument({
      //   leadId: lead.id,
      //   agencyId: agencyId,
      //   type: docType.label,
      //   title: `${docType.label} - ${lead.nom}`,
      //   content: {
      //     template: docType.id,
      //     category: docType.category,
      //     generatedAt: new Date().toISOString(),
      //     agencyData: agencyProfile
      //   },
      //   metadata: {
      //     clientName: lead.nom,
      //     clientEmail: lead.email,
      //     clientPhone: lead.telephone,
      //     budget: lead.budget,
      //     typeBien: lead.type_bien,
      //     delai: lead.delai
      //   },
      //   userId: user?.id
      // });
      
      // Mettre à jour le statut du lead selon le type de document
      await updateLeadStatus(docType.id);
      
      // Notifier le parent
      if (onDocumentGenerated) {
        onDocumentGenerated({
          type: docType.label,
          leadId: lead.id,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('Erreur génération document:', error);
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
