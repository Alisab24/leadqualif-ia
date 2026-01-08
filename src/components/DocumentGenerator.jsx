import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
// import DocumentService from '../services/documentService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DocumentGenerator({ lead, agencyId, agencyType, onDocumentGenerated, compact = false }) {
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pendingDocType, setPendingDocType] = useState(null);
  const [priceSettings, setPriceSettings] = useState({
    bienPrice: lead.budget || 0,
    commissionType: 'percentage', // 'percentage' ou 'fixed'
    commissionValue: agencyType === 'immobilier' ? 5 : 5,
    honoraires: 0,
    tva: 20,
    frais: 0
  });

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

  // Fonction pour formater les montants avec espaces et symbole
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Fonction pour formater les montants sans symbole (pour tableaux)
  const formatAmountPlain = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Fonction pour créer un tableau financier type Stripe
  const createFinancialTable = (doc, items, totals, startY, margin, pageWidth) => {
    let currentY = startY;
    const tableWidth = pageWidth - 2 * margin;
    const colWidths = [tableWidth * 0.5, tableWidth * 0.2, tableWidth * 0.3];
    
    // En-tête tableau
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY - 8, tableWidth, 25, 'F');
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Description', margin + 5, currentY + 5);
    doc.text('Quantité', margin + colWidths[0] + 5, currentY + 5);
    doc.text('Montant', margin + colWidths[0] + colWidths[1] + 5, currentY + 5);
    
    currentY += 20;
    
    // Lignes de données
    items.forEach((item, index) => {
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(item.description, margin + 5, currentY + (index * 20));
      doc.text(item.quantity || '1', margin + colWidths[0] + 5, currentY + (index * 20));
      doc.text(formatAmountPlain(item.amount), margin + colWidths[0] + colWidths[1] + 5, currentY + (index * 20));
    });
    
    currentY += items.length * 20 + 10;
    
    // Ligne de séparation
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    
    currentY += 10;
    
    // Totaux
    totals.forEach((total, index) => {
      const isBold = total.label.includes('TOTAL') || total.label.includes('TTC');
      doc.setFont(undefined, isBold ? 'bold' : 'normal');
      doc.setFontSize(isBold ? 12 : 11);
      doc.setTextColor(isBold ? 0 : 107, 114, 128);
      
      doc.text(total.label, margin + 5, currentY + (index * 15));
      doc.text(formatAmountPlain(total.amount), pageWidth - margin - 5, currentY + (index * 15), { align: 'right' });
    });
    
    return currentY + (totals.length * 15) + 20;
  };

  const generateDocument = async (docType) => {
    // Pour les documents financiers, ouvrir la modale de prix
    if (docType.id === 'devis' || docType.id === 'facture') {
      setPendingDocType(docType);
      setShowPriceModal(true);
      return;
    }
    
    await generateDocumentDirectly(docType);
  };

  const generateDocumentDirectly = async (docType) => {
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
      
      // Initialiser l'objet document jsPDF
      const doc = new jsPDF();
      
      // Validation de l'objet document
      if (!doc) {
        throw new Error('Impossible d\'initialiser le document PDF');
      }
      
      // Configuration du document
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 25; // Marges plus larges
      let currentY = margin;
      
      // Couleurs professionnelles type Stripe
      const primaryColor = [59, 130, 246]; // blue-500
      const textGray = [107, 114, 128]; // gray-500
      const textLight = [248, 250, 252]; // gray-50
      const accentColor = [34, 197, 94]; // green-500
      
      // Header document avec fond moderne
      doc.setFillColor(...textLight);
      doc.rect(0, 0, pageWidth, 90, 'F');
      
      // Ligne décorative
      doc.setFillColor(...primaryColor);
      doc.rect(0, 88, pageWidth, 2, 'F');
      
      // Logo agence
      if (profileToUse?.logo_url) {
        try {
          doc.addImage(profileToUse.logo_url, 'PNG', margin, 20, 45, 25);
        } catch (e) {
          console.log('Logo non chargé, utilisation du texte');
        }
      }
      
      // Informations agence dans header (alignées à droite)
      doc.setFontSize(22);
      doc.setTextColor(...primaryColor);
      doc.setFont(undefined, 'bold');
      doc.text(profileToUse?.name || 'Agence', pageWidth - margin - 100, 30, { align: 'right' });
      
      doc.setFontSize(11);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      if (profileToUse?.address) {
        doc.text(profileToUse.address, pageWidth - margin - 100, 40, { align: 'right' });
      }
      if (profileToUse?.email) {
        doc.text(profileToUse.email, pageWidth - margin - 100, 47, { align: 'right' });
      }
      if (profileToUse?.phone) {
        doc.text(profileToUse.phone, pageWidth - margin - 100, 54, { align: 'right' });
      }
      
      // Type et numéro du document avec design moderne
      currentY = 110;
      doc.setFontSize(28);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(docType.label.toUpperCase(), margin, currentY);
      
      // Badge de statut
      doc.setFillColor(...accentColor);
      doc.circle(pageWidth - margin - 30, currentY - 8, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('✓', pageWidth - margin - 30, currentY - 5, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      const documentNumber = `DOC-${Date.now().toString().slice(-6)}`;
      doc.text(`Document N°: ${documentNumber}`, margin, currentY + 12);
      doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, margin, currentY + 20);
      
      // Ligne de séparation moderne
      doc.setDrawColor(...textGray);
      doc.setLineWidth(0.8);
      doc.line(margin, currentY + 30, pageWidth - margin, currentY + 30);
      
      // Bloc client avec design aéré
      currentY = currentY + 50;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text('INFORMATIONS CLIENT', margin, currentY);
      
      currentY += 15;
      doc.setFontSize(12);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      
      // Carte client avec fond
      doc.setFillColor(...textLight);
      doc.roundedRect(margin - 5, currentY - 10, pageWidth - 2 * margin + 10, 45, 5, 5, 'F');
      
      const clientInfo = [
        { label: 'Nom', value: lead.nom || 'Non spécifié' },
        { label: 'Email', value: lead.email || 'Non spécifié' },
        { label: 'Téléphone', value: lead.telephone || 'Non spécifié' },
        { label: 'Projet', value: lead.type_bien || 'Projet non spécifié' },
        { label: 'Budget', value: formatAmount(lead.budget || 0) }
      ];
      
      clientInfo.forEach((info, index) => {
        const xPos = index < 2 ? margin : pageWidth - margin - 80;
        const yPos = index < 2 ? currentY + (index * 12) : currentY + ((index - 2) * 12);
        
        doc.setFont(undefined, 'bold');
        doc.text(`${info.label}:`, xPos, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(info.value, xPos + 35, yPos);
      });
      
      currentY += 55;
      
      // Ligne de séparation
      doc.setDrawColor(...textGray);
      doc.setLineWidth(0.8);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      
      // Corps du document avec sections claires
      currentY += 20;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text('DÉTAILS DU DOCUMENT', margin, currentY);
      
      currentY += 20;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      
      // Contenu structuré selon type avec sections claires
      let content = '';
      let financialData = null;
      
      switch (docType.id) {
        case 'mandat':
          content = `OBJET DU MANDAT\n\nLe soussigné ${lead.nom} ci-dessous désigné donne mandat exclusif à ${profileToUse?.name || 'Agence'} pour la vente du bien situé au [adresse complète du bien].\n\nARTICLE 1 - DURÉE DU MANDAT\nLe présent mandat est conclu pour une durée de 3 (trois) mois à compter de la date de signature.\n\nARTICLE 2 - COMMISSION\nUne commission de 5% du prix de vente HT sera due par le vendeur au moment de la signature de l'acte de vente.\n\nARTICLE 3 - ENGAGEMENTS DES PARTIES\nLe vendeur s'engage à ne pas confier de mandat à une autre agence pendant la durée du présent mandat. L'agence s'engage à assurer la promotion active du bien et à organiser les visites selon la disponibilité du vendeur.\n\nARTICLE 4 - RÉSILIATION\nLe mandat peut être résilié par anticipation moyennant un préavis de 15 jours.`;
          break;
        case 'devis':
          content = `DEVIS N°${documentNumber}\n\nINFORMATIONS\nClient: ${lead.nom}\nAgence: ${profileToUse?.name || 'Agence'}\nDate: ${new Date().toLocaleDateString('fr-FR')}\nValidité: 1 mois\n\nPRESTATIONS PROPOSÉES\n${agencyType === 'immobilier' ? '• Accompagnement complet dans la vente de votre bien\n• Estimation professionnelle et valorisation\n• Services de photographie et visites virtuelles\n• Publication sur les principales plateformes immobilières\n• Gestion complète des candidatures et négociations\n• Assistance administrative jusqu\'à la signature finale' : '• Stratégie marketing digitale personnalisée\n• Gestion professionnelle des réseaux sociaux (3 plateformes)\n• Création de contenu mensuel (15 publications)\n• Campagnes publicitaires ciblées sur Instagram/Facebook\n• Analyse détaillée des performances mensuelles\n• Reporting personnalisé et recommandations stratégiques'}`;
          
          // Données financières pour le tableau
          const commissionAmount = priceSettings.commissionType === 'percentage' 
            ? priceSettings.bienPrice * (priceSettings.commissionValue / 100)
            : priceSettings.commissionValue;
          
          const baseAmount = commissionAmount + priceSettings.honoraires + priceSettings.frais;
          
          financialData = {
            items: [
              {
                description: agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Stratégie marketing digitale',
                quantity: '1',
                amount: commissionAmount
              },
              ...(priceSettings.honoraires > 0 ? [{
                description: 'Honoraires supplémentaires',
                quantity: '1',
                amount: priceSettings.honoraires
              }] : []),
              ...(priceSettings.frais > 0 ? [{
                description: 'Frais annexes',
                quantity: '1',
                amount: priceSettings.frais
              }] : [])
            ],
            totals: [
              { label: 'Montant HT', amount: baseAmount },
              { label: `TVA (${priceSettings.tva}%)`, amount: baseAmount * (priceSettings.tva / 100) },
              { label: 'TOTAL TTC', amount: baseAmount * (1 + priceSettings.tva / 100) }
            ]
          };
          break;
        case 'compromis':
          content = `COMPROMIS DE VENTE\n\nPARTIES CONCERNÉES\nVendeur: [Nom et adresse du vendeur]\nAcheteur: ${lead.nom}\n${lead.email ? 'Email: ' + lead.email : ''}\n${lead.telephone ? 'Téléphone: ' + lead.telephone : ''}\n\nBIEN CONCERNÉ\nAdresse: [adresse complète du bien]\nPrix de vente: ${formatAmount(lead.budget || 0)}\n\nCLAUSES SUSPENSIVES\n• Obtention d'un prêt bancaire (si applicable)\n• Accord de la copropriété (si applicable)\n• Autorisation administrative (si applicable)\n\nCONDITIONS FINANCIÈRES\nAccomppte: ${formatAmount((lead.budget || 0) * 0.10)} (10% du prix de vente)\nSolde: ${formatAmount((lead.budget || 0) * 0.90)} à la levée des clauses suspensives\n\nDÉLAIS\nDélai de rétractation: 10 jours à compter de la signature\nDate prévisionnelle de signature définitive: [à déterminer]`;
          break;
        case 'facture':
          content = `FACTURE N°${documentNumber}\n\nINFORMATIONS CLIENT\n${lead.nom}\n${lead.email}\n${lead.telephone}\n\nINFORMATIONS PRESTATAIRE\n${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.address || ''}\n${profileToUse?.registrationNumber || ''}\n\nDÉTAIL DES PRESTATIONS\n${agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Services de marketing digital'}`;
          
          // Données financières pour le tableau
          const commissionAmountFacture = priceSettings.commissionType === 'percentage' 
            ? priceSettings.bienPrice * (priceSettings.commissionValue / 100)
            : priceSettings.commissionValue;
          
          const baseAmountFacture = commissionAmountFacture + priceSettings.honoraires + priceSettings.frais;
          
          financialData = {
            items: [
              {
                description: agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Services de marketing digital',
                quantity: '1',
                amount: commissionAmountFacture
              },
              ...(priceSettings.honoraires > 0 ? [{
                description: 'Honoraires supplémentaires',
                quantity: '1',
                amount: priceSettings.honoraires
              }] : []),
              ...(priceSettings.frais > 0 ? [{
                description: 'Frais annexes',
                quantity: '1',
                amount: priceSettings.frais
              }] : [])
            ],
            totals: [
              { label: 'Montant HT', amount: baseAmountFacture },
              { label: `TVA (${priceSettings.tva}%)`, amount: baseAmountFacture * (priceSettings.tva / 100) },
              { label: 'TOTAL TTC', amount: baseAmountFacture * (1 + priceSettings.tva / 100) }
            ]
          };
          break;
        case 'bon_visite':
          content = `BON DE VISITE\n\nINFORMATIONS VISITE\nClient: ${lead.nom}\nTéléphone: ${lead.telephone}\nEmail: ${lead.email}\n\nBIEN VISITÉ\nAdresse: [adresse complète du bien]\nDate de visite: ${new Date().toLocaleDateString('fr-FR')}\nHeure: [à définir]\n\nAGENT PRÉSENT\nAgence: ${profileToUse?.name || 'Agence'}\nContact: ${profileToUse?.phone || ''}\n\nOBSERVATIONS\n[Notes et remarques sur la visite, état du bien, points d'attention]\n\nPROCHAINES ÉTAPES\n• Retour du client sous 48h\n• Proposition d'offre (si intérêt)\n• Prise de contact avec le vendeur\n• Préparation du compromis de vente (si accord)`;
          break;
        case 'contrat':
          content = `CONTRAT DE PRESTATION DE SERVICES\n\nPARTIES\nClient: ${lead.nom}\nPrestataire: ${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.registrationNumber || ''}\n\nOBJET DU CONTRAT\nPrestations de marketing digital et communication\n\nDURÉE\nLe présent contrat est conclu pour une durée de 6 mois à compter de la date de signature.\n\nPRESTATIONS INCLUSES\n• Stratégie marketing personnalisée\n• Gestion des réseaux sociaux (3 plateformes)\n• Création de contenu mensuel (15 publications)\n• Campagnes publicitaires mensuelles\n• Analyse et reporting mensuel\n• Optimisation continue\n\nMONTANT\n${formatAmount((lead.budget || 0) * 0.05)} par mois\n\nCONDITIONS DE RÉSILIATION\nPréavis de 30 jours par courriel recommandé`;
          break;
        case 'rapport':
          content = `RAPPORT DE PERFORMANCE\n\nINFORMATIONS\nClient: ${lead.nom}\nPériode d'analyse: ${new Date().toLocaleDateString('fr-FR')}\nAgence: ${profileToUse?.name || 'Agence'}\n\nINDICATEURS CLÉS DE PERFORMANCE\n\nTAUX D'ENGAGEMENT: [à compléter]%\nCROISSANCE DES ABONNÉS: [à compléter]\nTAUX DE CONVERSION: [à compléter]%\nPORTÉE MOYENNE: [à compléter]\n\nPERFORMANCES PAR PLATEFORME\n\nInstagram: [à compléter abonnés, taux engagement]\nFacebook: [à compléter abonnés, taux engagement]\nLinkedIn: [à compléter abonnés, taux engagement]\n\nRECOMMANDATIONS STRATÉGIQUES\n• Optimisation du contenu existant\n• Nouvelles campagnes publicitaires\n• Analyse concurrentielle approfondie\n\nPROCHAINES ACTIONS\n• Mise en place des recommandations\n• Nouvelles campagnes ciblées\n• Suivi hebdomadaire des performances`;
          break;
      }
      
      // Découper le contenu en lignes pour éviter le débordement
      const splitContent = doc.splitTextToSize(content, pageWidth - 2 * margin);
      splitContent.forEach(line => {
        if (currentY > pageHeight - 80) {
          doc.addPage();
          currentY = margin;
          
          // Header sur pages supplémentaires
          doc.setFontSize(10);
          doc.setTextColor(...textGray);
          doc.text(`${docType.label} - Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin, margin, { align: 'right' });
        }
        doc.text(line, margin, currentY);
        currentY += 7;
      });
      
      // Ajouter le tableau financier pour devis et factures
      if (financialData && (docType.id === 'devis' || docType.id === 'facture')) {
        currentY += 20;
        
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('RÉCAPITULATIF FINANCIER', margin, currentY);
        
        currentY += 25;
        currentY = createFinancialTable(doc, financialData.items, financialData.totals, currentY, margin, pageWidth);
      }
      
      // Footer professionnel
      const footerY = pageHeight - 60;
      doc.setDrawColor(...textGray);
      doc.setLineWidth(0.8);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Mentions légales
      doc.setFontSize(9);
      doc.setTextColor(...textGray);
      doc.setFont(undefined, 'normal');
      if (profileToUse?.legalMention) {
        const splitLegal = doc.splitTextToSize(profileToUse.legalMention, pageWidth - 2 * margin);
        splitLegal.forEach((line, index) => {
          doc.text(line, margin, footerY + 15 + (index * 6));
        });
      }
      
      // Zone signature
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text('Signature:', margin, pageHeight - 20);
      doc.setDrawColor(...textGray);
      doc.setLineWidth(1);
      doc.line(margin + 40, pageHeight - 20, margin + 120, pageHeight - 20);
      
      // Date signature
      doc.setFont(undefined, 'normal');
      doc.text(`Fait à ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 80, pageHeight - 20);
      
      // Convertir le PDF en Blob pour la preview
      const pdfBlob = doc.output('blob');
      
      // Validation du blob PDF
      if (!pdfBlob) {
        throw new Error('Impossible de générer le blob PDF');
      }
      
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Validation de l'URL
      if (!pdfUrl) {
        throw new Error('Impossible de créer l\'URL du PDF');
      }
      
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
    if (!generatedDocument) {
      console.error('Aucun document généré disponible');
      return;
    }
    
    if (!generatedDocument.pdfBlob) {
      console.error('Le blob PDF n\'est pas disponible');
      return;
    }
    
    if (!generatedDocument.pdfUrl) {
      console.error('L\'URL du document n\'est pas disponible');
      return;
    }
    
    const link = document.createElement('a');
    link.href = generatedDocument.pdfUrl;
    link.download = generatedDocument.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fonction pour imprimer le document
  const printDocument = () => {
    if (!generatedDocument) {
      console.error('Aucun document généré disponible');
      return;
    }
    
    if (!generatedDocument.pdfBlob) {
      console.error('Le blob PDF n\'est pas disponible');
      return;
    }
    
    if (!generatedDocument.pdfUrl) {
      console.error('L\'URL du document n\'est pas disponible');
      return;
    }
    
    const printWindow = window.open(generatedDocument.pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      console.error('Impossible d\'ouvrir la fenêtre d\'impression');
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 md:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full max-h-[98vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm md:text-lg">📄</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">{generatedDocument.type}</h3>
                  <p className="text-xs md:text-sm text-slate-600">
                    {generatedDocument.clientData?.nom} • {new Date(generatedDocument.generatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <button 
                onClick={closePreview}
                className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Content - Preview responsive A4 */}
            <div className="flex-1 overflow-auto bg-slate-100 p-2 md:p-4">
              <div className="flex justify-center min-h-full">
                <div className="bg-white shadow-lg" style={{ 
                  width: '100%', 
                  maxWidth: '842px', // A4 width in pixels at 96 DPI
                  minWidth: '210mm', // A4 minimum width
                  height: 'auto',
                  transform: 'scale(1)',
                  transformOrigin: 'top center'
                }}>
                  <iframe
                    src={generatedDocument.pdfUrl}
                    className="w-full border-0"
                    style={{ 
                      height: '1189px', // A4 height in pixels at 96 DPI
                      minHeight: '297mm', // A4 minimum height
                      width: '210mm' // A4 exact width
                    }}
                    title={`Aperçu ${generatedDocument.type}`}
                  />
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4 p-3 md:p-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs md:text-sm text-slate-600">
                <div>
                  <span className="font-medium">Agence:</span> {generatedDocument.agencyData?.name || 'Non spécifiée'}
                </div>
                <div>
                  <span className="font-medium">Devise:</span> {generatedDocument.agencyData?.devise || 'EUR'}
                </div>
              </div>
              
              <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
                <button
                  onClick={downloadDocument}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <span>⬇</span>
                  <span className="hidden sm:inline">Télécharger</span>
                  <span className="sm:hidden">PDF</span>
                </button>
                <button
                  onClick={printDocument}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                >
                  <span>🖨</span>
                  <span className="hidden sm:inline">Imprimer</span>
                  <span className="sm:hidden">Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de configuration des prix */}
      {showPriceModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-slate-900">⚙️ Configuration des prix</h2>
              <button 
                onClick={() => setShowPriceModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prix du bien (€)
                </label>
                <input
                  type="number"
                  value={priceSettings.bienPrice}
                  onChange={(e) => setPriceSettings(prev => ({ ...prev, bienPrice: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 250000"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type de commission
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPriceSettings(prev => ({ ...prev, commissionType: 'percentage' }))}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors ${
                      priceSettings.commissionType === 'percentage'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Pourcentage (%)
                  </button>
                  <button
                    onClick={() => setPriceSettings(prev => ({ ...prev, commissionType: 'fixed' }))}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors ${
                      priceSettings.commissionType === 'fixed'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Fixe (€)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {priceSettings.commissionType === 'percentage' ? 'Commission (%)' : 'Commission (€)'}
                </label>
                <input
                  type="number"
                  value={priceSettings.commissionValue}
                  onChange={(e) => setPriceSettings(prev => ({ ...prev, commissionValue: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={priceSettings.commissionType === 'percentage' ? 'Ex: 5' : 'Ex: 10000'}
                  min="0"
                  step={priceSettings.commissionType === 'percentage' ? '0.1' : '100'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Honoraires supplémentaires (€)
                </label>
                <input
                  type="number"
                  value={priceSettings.honoraires}
                  onChange={(e) => setPriceSettings(prev => ({ ...prev, honoraires: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Frais annexes (€)
                </label>
                <input
                  type="number"
                  value={priceSettings.frais}
                  onChange={(e) => setPriceSettings(prev => ({ ...prev, frais: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 200"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TVA (%)
                </label>
                <select
                  value={priceSettings.tva}
                  onChange={(e) => setPriceSettings(prev => ({ ...prev, tva: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="0">0%</option>
                  <option value="5.5">5.5%</option>
                  <option value="10">10%</option>
                  <option value="20">20%</option>
                </select>
              </div>

              {/* Récapitulatif */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-slate-900 mb-2">📊 Récapitulatif</h3>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Commission:</span>
                  <span className="font-medium">
                    {formatAmount(priceSettings.commissionType === 'percentage' 
                      ? priceSettings.bienPrice * (priceSettings.commissionValue / 100)
                      : priceSettings.commissionValue)}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Honoraires:</span>
                  <span className="font-medium">{formatAmount(priceSettings.honoraires)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Frais:</span>
                  <span className="font-medium">{formatAmount(priceSettings.frais)}</span>
                </div>
                
                <div className="border-t border-slate-300 pt-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total HT:</span>
                    <span className="font-medium">
                      {formatAmount((priceSettings.commissionType === 'percentage' 
                        ? priceSettings.bienPrice * (priceSettings.commissionValue / 100)
                        : priceSettings.commissionValue) + priceSettings.honoraires + priceSettings.frais)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">TVA ({priceSettings.tva}%):</span>
                    <span className="font-medium">
                      {formatAmount(((priceSettings.commissionType === 'percentage' 
                        ? priceSettings.bienPrice * (priceSettings.commissionValue / 100)
                        : priceSettings.commissionValue) + priceSettings.honoraires + priceSettings.frais) * (priceSettings.tva / 100))}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-base font-bold text-blue-600">
                    <span>Total TTC:</span>
                    <span>
                      {formatAmount(((priceSettings.commissionType === 'percentage' 
                        ? priceSettings.bienPrice * (priceSettings.commissionValue / 100)
                        : priceSettings.commissionValue) + priceSettings.honoraires + priceSettings.frais) * (1 + priceSettings.tva / 100))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setShowPriceModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowPriceModal(false);
                  if (pendingDocType) {
                    generateDocumentDirectly(pendingDocType);
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📄 Générer le document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
