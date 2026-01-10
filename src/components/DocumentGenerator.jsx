import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
// import DocumentService from '../services/documentService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DocumentPreview from './DocumentPreview';
import DocumentPdfLayout from './DocumentPdfLayout';
import { DocumentCounterService } from '../services/documentCounterService';
import '../styles/document-print.css';

export default function DocumentGenerator({ lead, agencyId, agencyType, onDocumentGenerated, compact = false }) {
  // const navigate = useNavigate(); // PLUS DE NAVIGATION
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreGenerationModal, setShowPreGenerationModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pendingDocType, setPendingDocType] = useState(null);
  
  // 🎯 État pour la validation préventive (ZÉRO BUG)
  const [canGenerate, setCanGenerate] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  
  // NOUVEAUX STATES POUR LA MODALE DE PREVIEW
  const [openPreview, setOpenPreview] = useState(false);
  const [docData, setDocData] = useState(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [htmlDocument, setHtmlDocument] = useState(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  
  // État pour le composant PDF dédié
  const [pdfActions, setPdfActions] = useState(null);
  const [metadataSettings, setMetadataSettings] = useState({
    // Champs IMMO
    notes: '',
    reference: '',
    dateEcheance: '',
    lieuSignature: '',
    
    // Champs SMMA
    periodeFacturation: '',
    modeReglement: '',
    contactFacturation: '',
    prestationDetails: '',
    
    // Option montant en lettres
    showAmountInWords: true
  });

  // États pour la modale de pré-génération
  const [documentSettings, setDocumentSettings] = useState({
    // Champs IMMO
    bienPrice: lead.budget || 0,
    commissionType: 'percentage',
    commissionValue: agencyType === 'immobilier' ? 5 : 5,
    tva: 20,
    honoraires: 0,
    frais: 0,
    conditionsPaiement: '50% à la signature, 50% à la livraison',
    
    // Champs SMMA
    designationPrestation: agencyType === 'smma' ? 'Stratégie marketing digitale complète' : '',
    prixHT: agencyType === 'smma' ? (lead.budget || 0) * 0.05 : 0,
    periodicite: 'one-shot',
    conditionsPaiementSMMA: 'Paiement à réception de facture'
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

  React.useEffect(() => {
    const fetchAgencyProfile = async () => {
      if (!agencyId) {
        setProfileError('ID agence manquant');
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        setProfileError(null);

        // Source unique : profiles avec user_id (aligné avec Settings.jsx)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('Utilisateur non authentifié');
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('❌ profiles non trouvé pour user_id:', user.id, profileError);
          throw new Error(`Paramètres agence non trouvés. Veuillez compléter les paramètres agence.`);
        }

        // Utiliser profiles directement (aligné avec Settings.jsx)
        const profile = {
          id: profileData.id,
          name: profileData.nom_agence || profileData.nom_commercial || profileData.nom_legal || 'Agence',
          legalName: profileData.nom_legal || null, // PAS de valeur par défaut factice
          address: profileData.adresse_legale || profileData.adresse || null,
          phone: profileData.telephone || null,
          email: profileData.email || null,
          legalStatus: profileData.statut_juridique || null,
          registrationNumber: profileData.numero_enregistrement || null,
          legalMention: profileData.mention_legale || null,
          paymentConditions: profileData.conditions_paiement || null,
          devise: profileData.devise || null,
          symbole_devise: profileData.symbole_devise || null,
          logo_url: profileData.logo_url || null,
          siret: profileData.siret || null,
          tva: profileData.tva || null,
          pays: profileData.pays || null,
          source: 'profiles'
        };

        // DEBUG TEMPORAIRE : Loguer les données brutes et mappées
        console.log("🔍 PROFILES DATA USED FOR DOC", profileData);
        console.log("🔍 user_id:", user.id);
        console.log("🔍 nom_legal resolved =", profile.legalName);
        console.log("🔍 nom_agence =", profileData.nom_agence);
        console.log("🔍 TOUS LES CHAMPS DISPONIBLES:", Object.keys(profileData));
        console.log("🔍 CHAMPS LÉGAUX OBLIGATOIRES:", {
          nom_legal: profileData.nom_legal,
          statut_juridique: profileData.statut_juridique,
          adresse_legale: profileData.adresse_legale,
          numero_enregistrement: profileData.numero_enregistrement,
          mention_legale: profileData.mention_legale,
          conditions_paiement: profileData.conditions_paiement,
          devise: profileData.devise,
          symbole_devise: profileData.symbole_devise
        });
        console.log("🔍 Final profile object:", profile);

        setAgencyProfile(profile);
      } catch (error) {
        console.error('❌ Erreur chargement profil agence:', error);
        setProfileError(error.message);
        
        // PAS de profil par défaut - bloquer si profiles n'existe pas
        setAgencyProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchAgencyProfile();
  }, [agencyId]);

  // 🎯 VALIDATION PRÉVENTIVE (ZÉRO BUG, ZÉRO FRUSTRATION)
  useEffect(() => {
    if (profileLoading) {
      setCanGenerate(false);
      setValidationMessage('Chargement du profil...');
      return;
    }

    if (!agencyProfile) {
      setCanGenerate(false);
      setValidationMessage('Profil agence non disponible');
      return;
    }

    // Validation CLÉ : champs obligatoires pour la génération
    const requiredFields = [
      { field: agencyProfile.legalName, name: 'nom légal' },
      { field: agencyProfile.pays, name: 'pays' },
      { field: agencyProfile.devise, name: 'devise' }
    ];

    const missingFields = requiredFields.filter(
      ({ field }) => !field || field === null || field === undefined || field.trim() === ''
    );

    if (missingFields.length > 0) {
      setCanGenerate(false);
      setValidationMessage(`Complétez les informations légales dans Paramètres → Documents (${missingFields.map(f => f.name).join(', ')})`);
      return;
    }

    // ✅ Tous les champs OK
    setCanGenerate(true);
    setValidationMessage('');
  }, [agencyProfile, profileLoading]);

  // Fonction pour formater les montants avec espaces et symbole
  const formatAmount = (amount) => {
    if (amount === null || amount === undefined || amount === 0) {
      return '0 €';
    }
    
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(amount);
    
    return formatted;
  };

  // Fonction pour formater les montants sans symbole (pour tableaux)
  const formatAmountPlain = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(amount || 0);
  };

  // Fonction pour créer un tableau financier type Stripe
  const createFinancialTable = (doc, items, totals, startY, margin, pageWidth) => {
    let currentY = startY;
    const tableWidth = pageWidth - 2 * margin;
    const colWidths = [tableWidth * 0.6, tableWidth * 0.15, tableWidth * 0.25];
    const rowHeight = 20;
    
    // En-tête tableau avec fond subtil
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
    
    // Bordure supérieure uniquement
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);
    
    // Texte en-tête
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Description', margin + 8, currentY + 13);
    doc.text('Qté', margin + colWidths[0] + 5, currentY + 13);
    doc.text('Montant (€)', margin + colWidths[0] + colWidths[1] + 5, currentY + 13);
    
    currentY += rowHeight;
    
    // Lignes de données
    items.forEach((item, index) => {
      // Ligne de séparation très subtile
      if (index < items.length - 1) {
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);
      }
      
      // Texte des données
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      
      // Description (tronquer si trop long)
      let description = item.description;
      if (description.length > 45) {
        description = description.substring(0, 42) + '...';
      }
      doc.text(description, margin + 8, currentY + 13);
      
      // Quantité
      doc.text(item.quantity || '1', margin + colWidths[0] + 5, currentY + 13);
      
      // Montant (aligné à droite)
      const amountText = formatAmountPlain(item.amount);
      doc.text(amountText, pageWidth - margin - 8, currentY + 13, { align: 'right' });
      
      currentY += rowHeight;
    });
    
    // Ligne de séparation avant totaux
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY + 5, pageWidth - margin, currentY + 5);
    
    currentY += 12;
    
    // Totaux simplifiés
    totals.forEach((total, index) => {
      const isTotalTTC = total.label.includes('TOTAL TTC');
      const isBold = total.label.includes('TOTAL');
      
      // Style selon type de total
      if (isTotalTTC) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(59, 130, 246);
      } else if (isBold) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(31, 41, 55);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
      }
      
      // Libellé et montant
      doc.text(total.label, margin + 8, currentY + 12);
      const totalAmountText = `${formatAmountPlain(total.amount)} €`;
      doc.text(totalAmountText, pageWidth - margin - 8, currentY + 12, { align: 'right' });
      
      currentY += 16;
    });
    
    return currentY;
  };

  // Fonctions de calcul pour les montants en temps réel
  const calculateCommission = () => {
    if (documentSettings.commissionType === 'percentage') {
      return documentSettings.bienPrice * (documentSettings.commissionValue / 100);
    }
    return documentSettings.commissionValue;
  };

  const calculateTotalHT = () => {
    if (agencyType === 'immobilier') {
      return calculateCommission() + documentSettings.honoraires + documentSettings.frais;
    } else {
      return documentSettings.prixHT;
    }
  };

  const calculateTVA = () => {
    return calculateTotalHT() * (documentSettings.tva / 100);
  };

  const calculateTotalTTC = () => {
    return calculateTotalHT() * (1 + documentSettings.tva / 100);
  };

  const generateDocument = async (docType) => {
    // Pour les documents financiers, ouvrir la modale de pré-génération
    if (docType.id === 'devis' || docType.id === 'facture') {
      setPendingDocType(docType);
      setShowPreGenerationModal(true);
      return;
    }
    
    // Pour les autres documents, afficher le popup de métadonnées
    setPendingDocType(docType);
    setShowMetadataModal(true);
  };

  // Convertir le montant en lettres
  const getAmountInWords = (amount) => {
    if (!amount) return '';
    
    // Implémentation simple pour les montants en euros
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    const euros = Math.floor(amount);
    const centimes = Math.round((amount - euros) * 100);
    
    let result = '';
    
    if (euros === 0) {
      result = 'zéro';
    } else if (euros < 10) {
      result = units[euros];
    } else if (euros < 20) {
      result = teens[euros - 10];
    } else if (euros < 100) {
      const ten = Math.floor(euros / 10);
      const unit = euros % 10;
      result = tens[ten];
      if (unit > 0) {
        result += '-' + units[unit];
      }
    } else {
      // Simplification pour les centaines
      const hundred = Math.floor(euros / 100);
      const remainder = euros % 100;
      if (hundred === 1) {
        result = 'cent';
      } else {
        result = units[hundred] + ' cent';
      }
      if (remainder > 0) {
        result += ' ' + getAmountInWords(remainder);
      }
    }
    
    result += ' euro' + (euros > 1 ? 's' : '');
    
    if (centimes > 0) {
      result += ' et ' + centimes + ' centime' + (centimes > 1 ? 's' : '');
    }
    
    return result;
  };

  // Fonction de validation UNIQUEMENT sur profiles
  const validateAgencyProfile = (profile) => {
    if (!profile) {
      return {
        isValid: false,
        missingFields: ['Paramètres agence non trouvés. Veuillez compléter les paramètres agence.'],
        canGenerate: false
      };
    }

    const missingFields = [];
    const warnings = [];

    // DEBUG TEMPORAIRE : Loguer le profil reçu
    console.log("🔍 PROFILE RECEIVED FOR VALIDATION:", profile);

    // Validation UNIQUEMENT sur profiles.nom_legal
    console.log("🔍 LEGAL NAME VALIDATION (PROFILES ONLY):", {
      legalName: profile.legalName,
      isNull: profile.legalName === null,
      isUndefined: profile.legalName === undefined,
      isEmpty: profile.legalName?.trim() === ''
    });

    // Validation stricte du nom légal (PAS de valeurs factices)
    if (profile.legalName === null || profile.legalName === undefined || profile.legalName?.trim() === '') {
      missingFields.push('Nom légal (paramètres agence)');
    }

    // Validation stricte des autres champs bloquants
    if (profile.pays === null || profile.pays === undefined || profile.pays?.trim() === '') {
      missingFields.push('Pays (paramètres agence)');
    }

    if (profile.devise === null || profile.devise === undefined || profile.devise?.trim() === '') {
      missingFields.push('Devise (paramètres agence)');
    }

    // Champs WARNING (non bloquants)
    if (profile.name === null || profile.name === undefined || profile.name?.trim() === '') {
      warnings.push('Nom de l\'agence (paramètres agence)');
    }
    if (profile.address === null || profile.address === undefined || profile.address?.trim() === '') {
      warnings.push('Adresse légale (paramètres agence)');
    }
    if (profile.phone === null || profile.phone === undefined || profile.phone?.trim() === '') {
      warnings.push('Téléphone (paramètres agence)');
    }
    if (profile.email === null || profile.email === undefined || profile.email?.trim() === '') {
      warnings.push('Email (paramètres agence)');
    }

    const result = {
      isValid: missingFields.length === 0,
      missingFields,
      warnings,
      canGenerate: missingFields.length === 0,
      debugInfo: {
        legalName: profile.legalName,
        pays: profile.pays,
        devise: profile.devise,
        source: profile.source
      }
    };

    console.log("🔍 VALIDATION RESULT (PROFILES ONLY):", result);
    return result;
  };

  const generateHtmlDocument = async (docType) => {
    setLoading(true);
    
    try {
      // 🎯 ZÉRO VALIDATION ICI - tout est déjà validé par canGenerate
      // 🎯 ZÉRO ALERT() - plus jamais de messages bloquants
      
      // 🎯 GÉNÉRATION DU NUMÉRO LÉGAL
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const documentNumber = await DocumentCounterService.generateDocumentNumber(
        docType.id, 
        user.id
      );

      console.log('📄 Numéro de document généré:', documentNumber);
      
      // Préparer les données du document
      let documentData = {
        type: docType,
        number: documentNumber, // 🎯 Numéro légal (string direct)
        settings: documentSettings,
        metadata: {
          ...metadataSettings,
          amountInWords: metadataSettings.showAmountInWords ? 
            DocumentCounterService.formatAmountInWords(documentSettings.bienPrice || 0) : 
            null
        },
        financialData: null
      };

      // Préparer les données financières si nécessaire
      if (docType.id === 'devis' || docType.id === 'facture') {
        const commissionAmount = documentSettings.commissionType === 'percentage' 
          ? documentSettings.bienPrice * (documentSettings.commissionValue / 100)
          : documentSettings.commissionValue;
        
        const baseAmount = commissionAmount + documentSettings.honoraires + documentSettings.frais;
        const tvaAmount = baseAmount * (documentSettings.tva / 100);
        const totalTTC = baseAmount + tvaAmount;

        // 🎯 UTILISER LE MONTANT TOTAL TTC POUR LES MONTANTS EN LETTRES
        const amountForWords = totalTTC;
        const documentTypeLabel = docType.id === 'devis' ? 'devis' : 'facture';

        documentData.metadata.amountInWords = metadataSettings.showAmountInWords ? 
          `Arrêté la présente ${documentTypeLabel} à la somme de ${DocumentCounterService.formatAmountInWords(amountForWords)}` : 
          null;

        documentData.financialData = {
          items: [
            {
              description: agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Services de marketing digital',
              quantity: '1',
              amount: commissionAmount
            },
            ...(documentSettings.honoraires > 0 ? [{
              description: 'Honoraires supplémentaires',
              quantity: '1',
              amount: documentSettings.honoraires
            }] : []),
            ...(documentSettings.frais > 0 ? [{
              description: 'Frais annexes',
              quantity: '1',
              amount: documentSettings.frais
            }] : [])
          ],
          totals: [
            { label: 'Montant HT', amount: baseAmount },
            { label: `TVA (${documentSettings.tva}%)`, amount: tvaAmount },
            { label: 'TOTAL TTC', amount: totalTTC }
          ]
        };
      }

      // PLUS DE SAUVEGARDE LOCALSTORAGE NI NAVIGATION
      // Afficher directement dans la modal de preview
      console.log("🎯 DocumentGenerator - documentData.number =", documentData.number);
      console.log("🎯 DocumentGenerator - docData complet =", {document: documentData, agencyProfile, lead});
      
      setDocData({
        document: documentData,
        agencyProfile: agencyProfile,
        lead: lead
      });
      setOpenPreview(true);
      
    } catch (error) {
      console.error('Erreur lors de la génération du document:', error);
      alert('Erreur lors de la génération du document: ' + error.message);
    } finally {
      setLoading(false);
    }
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
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, 90, 'F');
      
      // Ligne décorative
      doc.setFillColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.text(profileToUse?.name || 'Agence', pageWidth - margin - 100, 30, { align: 'right' });
      
      doc.setFontSize(11);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
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
      doc.setFont('helvetica', 'bold');
      doc.text(docType.label.toUpperCase(), margin, currentY);
      
      // Badge de statut
      doc.setFillColor(34, 197, 94);
      doc.ellipse(pageWidth - margin - 30, currentY - 8, 8, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('✓', pageWidth - margin - 30, currentY - 5, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      const documentNumber = `DOC-${Date.now().toString().slice(-6)}`;
      doc.text(`Document N°: ${documentNumber}`, margin, currentY + 12);
      doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, margin, currentY + 20);
      
      // Ligne de séparation moderne
      doc.setDrawColor(107, 114, 128);
      doc.setLineWidth(0.8);
      doc.line(margin, currentY + 30, pageWidth - margin, currentY + 30);
      
      // Bloc client avec design aéré
      currentY = currentY + 50;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS CLIENT', margin, currentY);
      
      currentY += 15;
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      
      // Carte client avec fond
      doc.setFillColor(248, 250, 252);
      doc.rect(margin - 5, currentY - 10, pageWidth - 2 * margin + 10, 45, 'F');
      
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
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${info.label}:`, xPos, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(info.value, xPos + 35, yPos);
      });
      
      currentY += 55;
      
      // Ligne de séparation
      doc.setDrawColor(107, 114, 128);
      doc.setLineWidth(0.8);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      
      // Corps du document avec sections claires
      currentY += 20;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('DÉTAILS DU DOCUMENT', margin, currentY);
      
      currentY += 20;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
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
          const commissionAmount = documentSettings.commissionType === 'percentage' 
            ? documentSettings.bienPrice * (documentSettings.commissionValue / 100)
            : documentSettings.commissionValue;
          
          const baseAmount = commissionAmount + documentSettings.honoraires + documentSettings.frais;
          
          financialData = {
            items: [
              {
                description: agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Stratégie marketing digitale',
                quantity: '1',
                amount: commissionAmount
              },
              ...(documentSettings.honoraires > 0 ? [{
                description: 'Honoraires supplémentaires',
                quantity: '1',
                amount: documentSettings.honoraires
              }] : []),
              ...(documentSettings.frais > 0 ? [{
                description: 'Frais annexes',
                quantity: '1',
                amount: documentSettings.frais
              }] : [])
            ],
            totals: [
              { label: 'Montant HT', amount: baseAmount },
              { label: `TVA (${documentSettings.tva}%)`, amount: baseAmount * (documentSettings.tva / 100) },
              { label: 'TOTAL TTC', amount: baseAmount * (1 + documentSettings.tva / 100) }
            ]
          };
          break;
        case 'compromis':
          content = `COMPROMIS DE VENTE\n\nPARTIES CONCERNÉES\nVendeur: [Nom et adresse du vendeur]\nAcheteur: ${lead.nom}\n${lead.email ? 'Email: ' + lead.email : ''}\n${lead.telephone ? 'Téléphone: ' + lead.telephone : ''}\n\nBIEN CONCERNÉ\nAdresse: [adresse complète du bien]\nPrix de vente: ${formatAmount(lead.budget || 0)}\n\nCLAUSES SUSPENSIVES\n• Obtention d'un prêt bancaire (si applicable)\n• Accord de la copropriété (si applicable)\n• Autorisation administrative (si applicable)\n\nCONDITIONS FINANCIÈRES\nAccomppte: ${formatAmount((lead.budget || 0) * 0.10)} (10% du prix de vente)\nSolde: ${formatAmount((lead.budget || 0) * 0.90)} à la levée des clauses suspensives\n\nDÉLAIS\nDélai de rétractation: 10 jours à compter de la signature\nDate prévisionnelle de signature définitive: [à déterminer]`;
          break;
        case 'facture':
          content = `FACTURE N°${documentNumber}\n\nINFORMATIONS CLIENT\n${lead.nom}\n${lead.email}\n${lead.telephone}\n\nINFORMATIONS PRESTATAIRE\n${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.address || ''}\n${profileToUse?.registrationNumber || ''}\n\nDÉTAIL DES PRESTATIONS\n${agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Services de marketing digital'}`;
          
          // Données financières pour le tableau
          const commissionAmountFacture = documentSettings.commissionType === 'percentage' 
            ? documentSettings.bienPrice * (documentSettings.commissionValue / 100)
            : documentSettings.commissionValue;
          
          const baseAmountFacture = commissionAmountFacture + documentSettings.honoraires + documentSettings.frais;
          
          financialData = {
            items: [
              {
                description: agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : 'Services de marketing digital',
                quantity: '1',
                amount: commissionAmountFacture
              },
              ...(documentSettings.honoraires > 0 ? [{
                description: 'Honoraires supplémentaires',
                quantity: '1',
                amount: documentSettings.honoraires
              }] : []),
              ...(documentSettings.frais > 0 ? [{
                description: 'Frais annexes',
                quantity: '1',
                amount: documentSettings.frais
              }] : [])
            ],
            totals: [
              { label: 'Montant HT', amount: baseAmountFacture },
              { label: `TVA (${documentSettings.tva}%)`, amount: baseAmountFacture * (documentSettings.tva / 100) },
              { label: 'TOTAL TTC', amount: baseAmountFacture * (1 + documentSettings.tva / 100) }
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
        doc.setFont('helvetica', 'bold');
        doc.text('RÉCAPITULATIF FINANCIER', margin, currentY);
        
        currentY += 25;
        currentY = createFinancialTable(doc, financialData.items, financialData.totals, currentY, margin, pageWidth);
      }
      
      // Footer professionnel simplifié
      const footerY = pageHeight - 50;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);
      
      // Mentions légales compactes
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'normal');
      if (profileToUse?.legalMention) {
        const splitLegal = doc.splitTextToSize(profileToUse.legalMention, pageWidth - 2 * margin);
        splitLegal.slice(0, 2).forEach((line, index) => {
          doc.text(line, margin, footerY + 12 + (index * 5));
        });
      }
      
      // Zone signature compacte
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text('Signature', margin, pageHeight - 25);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin + 35, pageHeight - 25, margin + 100, pageHeight - 25);
      
      // Date signature compacte
      doc.text(`Fait le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 60, pageHeight - 25);
      
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
    // ❌ BOUTON TÉLÉCHARGER DÉSACTIVÉ : FONCTIONNALITÉ NON FONCTIONNELLE
    console.log('🚫 Bouton Télécharger désactivé - fonctionnalité non disponible');
    alert('Fonctionnalité de téléchargement désactivée. Utilisez "Imprimer" pour générer le PDF.');
    return;
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
              disabled={loading || !canGenerate}
              className={`text-xs p-1.5 rounded flex items-center justify-center gap-1 transition-all ${
                canGenerate 
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              } ${loading ? 'opacity-50' : ''}`}
              title={canGenerate ? `Générer ${docType.label}` : validationMessage}
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

      {/* Modale de pré-génération professionnelle */}
      {showPreGenerationModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {agencyType === 'immobilier' ? '🏠 Configuration Document Immobilier' : '📱 Configuration Document SMMA'}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {pendingDocType?.label} • {lead.nom}
                </p>
              </div>
              <button 
                onClick={() => setShowPreGenerationModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {agencyType === 'immobilier' ? (
                /* ===== CHAMPS IMMO ===== */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Prix du bien (€) *
                      </label>
                      <input
                        type="number"
                        value={documentSettings.bienPrice}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, bienPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                        placeholder="Ex: 250000"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Type de commission *
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDocumentSettings(prev => ({ ...prev, commissionType: 'percentage' }))}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                            documentSettings.commissionType === 'percentage'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          Pourcentage (%)
                        </button>
                        <button
                          onClick={() => setDocumentSettings(prev => ({ ...prev, commissionType: 'fixed' }))}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                            documentSettings.commissionType === 'fixed'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          Montant fixe (€)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {documentSettings.commissionType === 'percentage' ? 'Commission (%)' : 'Commission (€)'} *
                      </label>
                      <input
                        type="number"
                        value={documentSettings.commissionValue}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, commissionValue: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={documentSettings.commissionType === 'percentage' ? 'Ex: 5' : 'Ex: 10000'}
                        min="0"
                        step={documentSettings.commissionType === 'percentage' ? '0.1' : '100'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Taux de TVA (%)
                      </label>
                      <select
                        value={documentSettings.tva}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, tva: parseFloat(e.target.value) }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="0">0%</option>
                        <option value="5.5">5.5%</option>
                        <option value="10">10%</option>
                        <option value="20">20%</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Honoraires supplémentaires (€)
                      </label>
                      <input
                        type="number"
                        value={documentSettings.honoraires}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, honoraires: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: 500"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Frais annexes (€)
                      </label>
                      <input
                        type="number"
                        value={documentSettings.frais}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, frais: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: 200"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Conditions de paiement
                    </label>
                    <textarea
                      value={documentSettings.conditionsPaiement}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, conditionsPaiement: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={3}
                      placeholder="Ex: 50% à la signature, 50% à la livraison"
                    />
                  </div>
                </>
              ) : (
                /* ===== CHAMPS SMMA ===== */
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Désignation de la prestation *
                    </label>
                    <input
                      type="text"
                      value={documentSettings.designationPrestation}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, designationPrestation: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Stratégie marketing digitale complète"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Prix HT (€) *
                      </label>
                      <input
                        type="number"
                        value={documentSettings.prixHT}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, prixHT: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: 2000"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Taux de TVA (%)
                      </label>
                      <select
                        value={documentSettings.tva}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, tva: parseFloat(e.target.value) }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="0">0%</option>
                        <option value="5.5">5.5%</option>
                        <option value="10">10%</option>
                        <option value="20">20%</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Périodicité *
                      </label>
                      <select
                        value={documentSettings.periodicite}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, periodicite: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="one-shot">One-shot</option>
                        <option value="mensuel">Mensuel</option>
                        <option value="trimestriel">Trimestriel</option>
                        <option value="annuel">Annuel</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Conditions de paiement
                    </label>
                    <textarea
                      value={documentSettings.conditionsPaiementSMMA}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, conditionsPaiementSMMA: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={3}
                      placeholder="Ex: Paiement à réception de facture"
                    />
                  </div>
                </>
              )}

              {/* ===== RÉCAPITULATIF FINANCIER ===== */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  📊 Récapitulatif financier
                </h3>
                
                <div className="space-y-3">
                  {agencyType === 'immobilier' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Commission:</span>
                        <span className="font-medium text-slate-900">
                          {formatAmount(calculateCommission())}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Honoraires:</span>
                        <span className="font-medium text-slate-900">{formatAmount(documentSettings.honoraires)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Frais annexes:</span>
                        <span className="font-medium text-slate-900">{formatAmount(documentSettings.frais)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Prestation:</span>
                      <span className="font-medium text-slate-900">{documentSettings.designationPrestation}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-blue-200 pt-3 mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total HT:</span>
                      <span className="font-medium text-slate-900">
                        {formatAmount(calculateTotalHT())}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">TVA ({documentSettings.tva}%):</span>
                      <span className="font-medium text-slate-900">
                        {formatAmount(calculateTVA())}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-lg font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
                      <span>Total TTC:</span>
                      <span>
                        {formatAmount(calculateTotalTTC())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowPreGenerationModal(false)}
                className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowPreGenerationModal(false);
                  if (pendingDocType) {
                    generateHtmlDocument(pendingDocType);
                  }
                }}
                disabled={!canGenerate || loading}
                className={`flex-1 px-6 py-3 rounded-lg transition-all font-medium shadow-lg ${
                  canGenerate && !loading
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={canGenerate ? `Générer le ${pendingDocType?.label}` : validationMessage}
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Génération...
                  </>
                ) : (
                  <>
                    📄 Générer le {pendingDocType?.label}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Popup métadonnées optionnel */}
      {showMetadataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                Options du {pendingDocType?.label || 'document'}
              </h2>
              <button
                onClick={() => setShowMetadataModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Champs IMMO */}
              {agencyType === 'immobilier' && (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes internes
                      </label>
                      <textarea
                        value={metadataSettings.notes}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder="Notes internes sur le bien ou le client..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Référence dossier
                      </label>
                      <input
                        type="text"
                        value={metadataSettings.reference}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, reference: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Référence interne du dossier"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date d'échéance
                      </label>
                      <input
                        type="date"
                        value={metadataSettings.dateEcheance}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, dateEcheance: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lieu de signature
                      </label>
                      <input
                        type="text"
                        value={metadataSettings.lieuSignature}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, lieuSignature: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ville ou lieu précis"
                      />
                    </div>
                  </div>
                </>
              )}
              
              {/* Champs SMMA */}
              {agencyType === 'smma' && (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Période de facturation
                      </label>
                      <select
                        value={metadataSettings.periodeFacturation}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, periodeFacturation: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Sélectionner...</option>
                        <option value="mensuel">Mensuel</option>
                        <option value="trimestriel">Trimestriel</option>
                        <option value="semestriel">Semestriel</option>
                        <option value="annuel">Annuel</option>
                        <option value="ponctuel">Ponctuel</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mode de règlement
                      </label>
                      <select
                        value={metadataSettings.modeReglement}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, modeReglement: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Sélectionner...</option>
                        <option value="virement">Virement bancaire</option>
                        <option value="carte">Carte bancaire</option>
                        <option value="cheque">Chèque</option>
                        <option value="paypal">PayPal</option>
                        <option value="stripe">Stripe</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact facturation
                      </label>
                      <input
                        type="text"
                        value={metadataSettings.contactFacturation}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, contactFacturation: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Service comptabilité ou contact facturation"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Détails de la prestation
                      </label>
                      <textarea
                        value={metadataSettings.prestationDetails}
                        onChange={(e) => setMetadataSettings(prev => ({ ...prev, prestationDetails: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder="Description détaillée des services fournis..."
                      />
                    </div>
                  </div>
                </>
              )}
              
              {/* Champ commun */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pre-rempli"
                    checked={metadataSettings.notes || metadataSettings.reference || metadataSettings.dateEcheance || metadataSettings.lieuSignature}
                    onChange={(e) => setMetadataSettings(prev => ({ ...prev, preRempli: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="pré-rempli" className="ml-2 text-sm text-gray-700">
                    Pré-remplir les données si elles existent déjà
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="show-amount-words"
                    checked={metadataSettings.showAmountInWords}
                    onChange={(e) => setMetadataSettings(prev => ({ ...prev, showAmountInWords: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="show-amount-words" className="ml-2 text-sm text-gray-700">
                    Afficher le montant total en lettres
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowMetadataModal(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (!profileLoading && canGenerate) {
                    setShowMetadataModal(false);
                    generateHtmlDocument(pendingDocType);
                  }
                }}
                disabled={!canGenerate || profileLoading || loading}
                className={`flex-1 px-6 py-3 font-medium shadow-lg transition-all ${
                  !canGenerate || profileLoading || loading
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 hover:scale-105'
                }`}
                title={canGenerate ? `Générer le ${pendingDocType?.label}` : validationMessage}
              >
                {loading || profileLoading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Génération...
                  </>
                ) : (
                  <>
                    📄 Générer le {pendingDocType?.label}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Preview Locale */}
      {openPreview && docData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {docData.document.type?.label?.toUpperCase() || 'DOCUMENT'}
              </h2>
              <button
                onClick={() => setOpenPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {/* Contenu du document */}
              <div className="document-preview-content">
                {/* Header */}
                <div className="header-section">
                  <div className="agency-info">
                    <h2>{docData.agencyProfile?.name || 'Agence'}</h2>
                    <div className="agency-details">
                      {docData.agencyProfile?.address && <p>{docData.agencyProfile.address}</p>}
                      {docData.agencyProfile?.email && <p>{docData.agencyProfile.email}</p>}
                      {docData.agencyProfile?.phone && <p>{docData.agencyProfile.phone}</p>}
                    </div>
                  </div>
                  
                  <div className="document-info">
                    <div className="document-title">{docData.document?.type?.label?.toUpperCase() || 'DOCUMENT'}</div>
                    <div className="document-meta">
                      <div style={{ fontWeight: '600' }}>N° {docData.document?.number || 'En attente'}</div>
                      <div>Date: {new Date().toLocaleDateString('fr-FR')}</div>
                      <div>Devise: EUR</div>
                    </div>
                  </div>
                </div>

                {/* Client */}
                <div className="client-section">
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>CLIENT</h3>
                  <div className="client-grid">
                    <div>
                      <div className="client-item">
                        <span className="client-label">Nom:</span>
                        <span className="client-value">{docData.lead?.nom || 'Non spécifié'}</span>
                      </div>
                      {docData.lead?.email && (
                        <div className="client-item">
                          <span className="client-label">Email:</span>
                          <span className="client-value">{docData.lead.email}</span>
                        </div>
                      )}
                      {docData.lead?.telephone && (
                        <div className="client-item">
                          <span className="client-label">Tél:</span>
                          <span className="client-value">{docData.lead.telephone}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="client-item">
                        <span className="client-label">Projet:</span>
                        <span className="client-value">{docData.lead?.type_bien || 'Non spécifié'}</span>
                      </div>
                      {docData.lead?.budget && (
                        <div className="client-item">
                          <span className="client-label">Budget:</span>
                          <span className="client-value">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(docData.lead.budget)}</span>
                        </div>
                      )}
                      <div className="client-item">
                        <span className="client-label">Source:</span>
                        <span className="client-value">Formulaire IA</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tableau financier */}
                {docData.document.financialData && (
                  <div>
                    <table className="financial-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th style={{ textAlign: 'center', width: '60px' }}>Qté</th>
                          <th style={{ textAlign: 'right', width: '120px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docData.document.financialData.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.description}</td>
                            <td style={{ textAlign: 'center', color: '#6b7280' }}>
                              {item.quantity || '1'}
                            </td>
                            <td className="amount">
                              {new Intl.NumberFormat('fr-FR', { 
                                style: 'currency', 
                                currency: 'EUR',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {docData.document.financialData.totals.map((total, index) => {
                          const isTotalTTC = total.label.includes('TOTAL TTC');
                          const isBold = total.label.includes('TOTAL');
                          
                          return (
                            <tr key={index} className={isTotalTTC ? 'total-ttc' : ''}>
                              <td colSpan="2" style={{
                                fontWeight: isTotalTTC ? 'bold' : isBold ? '600' : 'normal',
                                fontSize: isTotalTTC ? '14px' : '11px',
                                color: isTotalTTC ? '#1d4ed8' : '#374151'
                              }}>
                                {total.label}
                              </td>
                              <td className="amount" style={{
                                fontWeight: isTotalTTC ? 'bold' : isBold ? '600' : 'normal',
                                fontSize: isTotalTTC ? '14px' : '11px',
                                color: isTotalTTC ? '#1d4ed8' : '#374151'
                              }}>
                                {new Intl.NumberFormat('fr-FR', { 
                                  style: 'currency', 
                                  currency: 'EUR',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                }).format(total.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Métadonnées */}
                {docData.document?.metadata?.amountInWords && (
                  <div className="metadata-content" style={{ marginTop: '10px', fontStyle: 'italic', textAlign: 'center', fontSize: '14px' }}>
                    <strong>{docData.document.metadata.amountInWords}</strong>
                  </div>
                )}

                {/* Signature */}
                <div className="signature-section">
                  <div className="signature-block">
                    <div className="signature-label">Signature agence</div>
                    <div className="signature-line"></div>
                    <div className="signature-label">{docData.agencyProfile?.name || 'Agence'}</div>
                  </div>
                  <div className="signature-block">
                    <div className="signature-label">Signature client</div>
                    <div className="signature-line"></div>
                    <div className="signature-label">{docData.lead?.nom || 'Client'}</div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#6b7280' }}>
                  Fait à Paris, le {new Date().toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setOpenPreview(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  // Imprimer le HTML preview avec window.print()
                  window.print();
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🖨️ Imprimer
              </button>
              </div>
          </div>
        </div>
      )}
      
      {/* Composant PDF dédié (jamais affiché à l'écran) */}
      {docData?.document && (
        <DocumentPdfLayout
          document={docData.document}
          agencyProfile={docData.agencyProfile}
          lead={docData.lead}
          onPdfGenerated={(actions) => {
            setPdfActions(actions);
          }}
        />
      )}
    </div>
  );
}
