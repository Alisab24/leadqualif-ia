import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { DocumentCounterService } from '../services/documentCounterService';
import { generateDocumentHtml } from '../utils/generateDocumentHtml';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DocumentPreview from './DocumentPreview';
import DocumentPdfLayout from './DocumentPdfLayout';
import { useNavigate } from 'react-router-dom';
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

  // États supplémentaires par type de document (mandat, contrat_gestion, bon_visite, compromis, contrat SMMA, rapport)
  const [documentExtraSettings, setDocumentExtraSettings] = useState({
    // ─── IMMO : Mandat ───
    adresseBien: lead.adresse || '',
    typeBienMandat: lead.type_bien_recherche || lead.type_bien || 'Appartement',
    surfaceBien: '',
    prixVenteMandat: lead.budget || 0,
    tauxCommissionMandat: 5,
    dureeMandat: 3,
    mandatExclusif: true,
    // ─── IMMO : Contrat de gestion locative ───
    adresseBienGestion: lead.adresse || '',
    typeBienGestion: lead.type_bien || 'Appartement',
    loyerMensuel: '',
    tauxGestion: 8,
    dureeContratGestion: 12,
    // ─── IMMO : Bon de visite ───
    adresseBienVisite: lead.adresse || '',
    dateVisite: new Date().toISOString().split('T')[0],
    heureVisite: '10:00',
    agentNom: '',
    observationsVisite: '',
    // ─── IMMO : Compromis ───
    nomVendeur: '',
    adresseVendeur: '',
    prixVenteCompromis: lead.budget || 0,
    acompteCompromis: Math.round((lead.budget || 0) * 0.1),
    // ─── SMMA : Contrat de prestation ───
    prixMensuelContrat: Math.round(((lead.budget_marketing ? parseInt(lead.budget_marketing) : (lead.budget || 0)) * 0.05)) || 1500,
    dureeContratSMMA: 6,
    servicesContrat: 'Stratégie marketing digitale personnalisée\nGestion réseaux sociaux (3 plateformes)\nCréation de contenu mensuel (15 publications)\nCampagnes publicitaires mensuelles\nReporting et analyse mensuelle\nOptimisation continue',
    plateformesContrat: 'Instagram, Facebook, LinkedIn',
    // ─── SMMA : Rapport de performance ───
    periodeDateDebut: '',
    periodeDateFin: '',
    kpiInstagramAbonnes: '',
    kpiInstagramEngagement: '',
    kpiInstagramPortee: '',
    kpiFacebookAbonnes: '',
    kpiFacebookEngagement: '',
    kpiFacebookPortee: '',
    kpiLinkedInAbonnes: '',
    kpiLinkedInEngagement: '',
    kpiConversion: '',
    kpiLeads: '',
    kpiCA: '',
    recommandationsRapport: 'Optimisation du contenu existant\nNouvelles campagnes publicitaires ciblées\nAnalyse concurrentielle approfondie',
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
    prixHT: agencyType === 'smma' ? (lead.budget || 0) : 0,
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
        { id: 'bon_visite', label: 'Bon de visite', icon: '🏠', category: 'IMMO' },
        { id: 'contrat_gestion', label: 'Contrat de gestion', icon: '📑', category: 'IMMO' }
      ];
    } else if (agencyType === 'smma') {
      return [
        { id: 'devis', label: 'Devis', icon: '📋', category: 'SMMA' },
        { id: 'contrat', label: 'Contrat de prestation', icon: '📝', category: 'SMMA' },
        { id: 'facture', label: 'Facture', icon: '🧾', category: 'SMMA' },
        { id: 'rapport', label: 'Rapport de performance', icon: '📊', category: 'SMMA' }
      ];
    } else {
      // type_agence non défini : afficher les types communs uniquement
      return [
        { id: 'devis', label: 'Devis', icon: '📋', category: 'COMMUN' },
        { id: 'facture', label: 'Facture', icon: '🧾', category: 'COMMUN' },
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
          .maybeSingle();  // maybeSingle évite l'erreur 406 si aucune ligne

        if (profileError) {
          console.error('❌ profiles erreur pour user_id:', user.id, profileError);
          throw new Error(`Erreur de chargement du profil agence.`);
        }

        if (!profileData) {
          // Profil inexistant → profil minimal pour ne pas bloquer
          console.warn('⚠️ Aucun profil trouvé, utilisation des valeurs par défaut');
          setAgencyProfile({
            id: user.id,
            agency_id: user.id,
            name: 'Mon Agence',
            legalName: 'Mon Agence',
            pays: 'France',
            devise: 'EUR',
            symbole_devise: '€',
            source: 'default'
          });
          setProfileLoading(false);
          return;
        }

        // Utiliser profiles directement (aligné avec Settings.jsx)
        const profile = {
          id: profileData.id,
          agency_id: profileData.agency_id,
          name: profileData.nom_agence || profileData.nom_commercial || profileData.nom_legal || 'Mon Agence',
          // legalName : fallback nom_agence/nom_commercial pour ne jamais bloquer la génération
          legalName: profileData.nom_legal || profileData.nom_agence || profileData.nom_commercial || 'Mon Agence',
          address: profileData.adresse_legale || profileData.adresse || null,
          phone: profileData.telephone || null,
          email: profileData.email || null,
          legalStatus: profileData.statut_juridique || null,
          registrationNumber: profileData.numero_enregistrement || null,
          legalMention: profileData.mention_legale || null,
          paymentConditions: profileData.conditions_paiement || 'À réception de facture',
          devise: profileData.devise || 'EUR',
          symbole_devise: profileData.symbole_devise || '€',
          logo_url: profileData.logo_url || null,
          signature_url: profileData.signature_url || null,
          ville: profileData.ville_agence || null,
          siret: profileData.siret || null,
          tva: profileData.tva || null,
          pays: profileData.pays || 'France',
          show_amount_in_words: profileData.show_amount_in_words ?? false,
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

  // Initialiser showAmountInWords depuis le paramètre agence (Settings → show_amount_in_words)
  useEffect(() => {
    if (agencyProfile && agencyProfile.show_amount_in_words !== undefined) {
      setMetadataSettings(prev => ({ ...prev, showAmountInWords: agencyProfile.show_amount_in_words }));
    }
  }, [agencyProfile]);

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

    // Validation : seul le nom légal est vraiment requis.
    // pays et devise ont des valeurs par défaut (France, EUR).
    if (!agencyProfile.legalName || agencyProfile.legalName.trim() === '') {
      // Ne jamais bloquer si nom_agence existe (fallback déjà appliqué)
      setCanGenerate(false);
      setValidationMessage('Renseignez le nom de votre agence dans Paramètres');
      return;
    }

    // ✅ OK
    setCanGenerate(true);
    setValidationMessage('');
  }, [agencyProfile, profileLoading]);

  // Fonction pour formater les montants avec espaces et symbole
  const formatAmount = (amount, currency = 'EUR') => {
    if (amount === null || amount === undefined || amount === 0) {
      return `0 ${agencyProfile?.symbole_devise || '€'}`;
    }
    
    // 🎯 CORRECTION: Convertir le symbole € en code ISO 4217
    // Intl.NumberFormat n'accepte que les codes ISO, pas les symboles
    const normalizedCurrency = currency === '€' ? 'EUR' : currency;
    
    try {
      const formatted = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true
      }).format(amount);
      
      return formatted;
    } catch (error) {
      console.warn('⚠️ Erreur formatAmount avec devise:', currency, error);
      // Fallback en cas d'erreur
      return `${amount.toLocaleString('fr-FR')} ${currency}`;
    }
  };

  // Wrapper pratique : formatAmount avec la devise du profil agence courant
  const fmtA = (v) => formatAmount(v, agencyProfile?.devise || 'EUR');
  // Symbole court pour les labels de formulaire
  const sym = agencyProfile?.symbole_devise || '€';

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
    doc.text(`Montant (${agencyProfile?.symbole_devise || '€'})`, margin + colWidths[0] + colWidths[1] + 5, currentY + 13);
    
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
      const totalAmountText = `${formatAmountPlain(total.amount)} ${agencyProfile?.symbole_devise || '€'}`;
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
    // Tous les types de documents passent par la modale de pré-génération
    // (formulaire adapté selon docType.id)
    setPendingDocType(docType);
    setShowPreGenerationModal(true);
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
      
      // ─── Construire le contenu du corps du document selon le type ───
      const buildBodyContent = () => {
        const ex = documentExtraSettings;
        const fmtAmt = (v) => formatAmount(v, agencyProfile?.devise || 'EUR');
        const agencyName = agencyProfile?.name || 'Agence';
        const today = new Date().toLocaleDateString('fr-FR');

        switch (docType.id) {
          case 'mandat': {
            const commission = ex.tauxCommissionMandat
              ? `${ex.tauxCommissionMandat}% du prix de vente HT`
              : '5% du prix de vente HT';
            const prixVente = ex.prixVenteMandat ? fmtAmt(ex.prixVenteMandat) : fmtAmt(lead.budget || 0);
            return [
              { heading: 'MANDAT EXCLUSIF DE VENTE', type: 'title' },
              { heading: 'Entre les soussignés', type: 'section' },
              { text: `Vendeur(s) : ${lead.nom}${lead.adresse ? ' — ' + lead.adresse : ''}\nMandataire : ${agencyName}${agencyProfile?.address ? ', ' + agencyProfile.address : ''}` },
              { heading: 'Objet du mandat', type: 'section' },
              { text: `Le vendeur donne ${ex.mandatExclusif ? 'mandat exclusif' : 'mandat simple'} à ${agencyName} pour la vente du bien suivant :\n\nAdresse : ${ex.adresseBien || '[adresse du bien]'}\nType : ${ex.typeBienMandat}${ex.surfaceBien ? ' — Surface : ' + ex.surfaceBien + ' m²' : ''}\nPrix de vente souhaité : ${prixVente}` },
              { heading: 'Article 1 — Durée du mandat', type: 'section' },
              { text: `Le présent mandat est conclu pour une durée de ${ex.dureeMandat} mois à compter de la date de signature. À défaut de dénonciation par lettre recommandée avec AR au moins 15 jours avant l'échéance, il se renouvelle par tacite reconduction, sauf si la réglementation impose une limite.` },
              { heading: 'Article 2 — Commission', type: 'section' },
              { text: `Une commission de ${commission} (toutes taxes comprises) sera due par le vendeur exclusivement lors de la signature de l'acte authentique de vente.\n\n${ex.mandatExclusif ? 'Dans le cadre de ce mandat exclusif, le vendeur s\'engage à ne pas confier de mandat à une autre agence pendant toute la durée du présent mandat.' : ''}` },
              { heading: 'Article 3 — Engagements de l\'agence', type: 'section' },
              { text: `${agencyName} s\'engage à :\n• Assurer la promotion active du bien sur les principaux portails immobiliers et son propre réseau\n• Organiser les visites selon les disponibilités du vendeur\n• Rendre compte régulièrement de ses démarches\n• Présenter toute offre d\'achat sans délai` },
              { heading: 'Article 4 — Résiliation', type: 'section' },
              { text: `Le mandat peut être résilié par anticipation par lettre recommandée avec AR moyennant un préavis de 15 jours calendaires.\n\nFait à ${agencyProfile?.ville || agencyProfile?.address?.split(',')[0]?.trim() || 'Paris'}, le ${today}` },
              { type: 'signature' },
            ];
          }

          case 'contrat_gestion': {
            const loyer = ex.loyerMensuel ? fmtAmt(parseFloat(ex.loyerMensuel)) : '[loyer mensuel]';
            return [
              { heading: 'CONTRAT DE GESTION LOCATIVE', type: 'title' },
              { heading: 'Parties contractantes', type: 'section' },
              { text: `Propriétaire (Mandant) : ${lead.nom}\nEmail : ${lead.email || '—'}  |  Tél : ${lead.telephone || '—'}\n\nMandataire : ${agencyName}\n${agencyProfile?.legalName || agencyName}${agencyProfile?.address ? '\n' + agencyProfile.address : ''}${agencyProfile?.registrationNumber ? '\nN° ' + agencyProfile.registrationNumber : ''}` },
              { heading: 'Bien concerné', type: 'section' },
              { text: `Adresse : ${ex.adresseBienGestion || '[adresse du bien]'}\nType : ${ex.typeBienGestion}\nLoyer mensuel charges comprises : ${loyer}` },
              { heading: 'Article 1 — Objet du contrat', type: 'section' },
              { text: `Le présent contrat a pour objet de confier au Mandataire la gestion locative complète du bien désigné ci-dessus, conformément aux dispositions de la loi Hoguet du 2 janvier 1970 et de son décret d\'application.` },
              { heading: 'Article 2 — Missions du mandataire', type: 'section' },
              { text: `• Recherche et sélection des locataires (vérification des dossiers, solvabilité)\n• Rédaction et signature des baux d\'habitation conformes à la loi Alur\n• Réalisation des états des lieux d\'entrée et de sortie\n• Perception des loyers et charges, quittancement mensuel\n• Gestion des travaux courants et suivi des sinistres\n• Représentation auprès des organismes (assurances, syndic, administrations)\n• Reporting mensuel : relevé de gérance et justificatifs` },
              { heading: 'Article 3 — Honoraires de gestion', type: 'section' },
              { text: `Honoraires de gestion courante : ${ex.tauxGestion}% des loyers encaissés hors charges\nHonoraires de remise en location : 1 mois de loyer hors charges\nÉtats des lieux (entrée/sortie) : conformément au barème en vigueur\n\nLes honoraires sont prélevés directement sur les loyers encaissés et décomptés sur le relevé mensuel.` },
              { heading: 'Article 4 — Durée et résiliation', type: 'section' },
              { text: `Le présent mandat est conclu pour une durée de ${ex.dureeContratGestion} mois renouvelable par tacite reconduction. Il peut être résilié par l\'une ou l\'autre des parties avec un préavis de 3 mois avant la date anniversaire, par lettre recommandée avec AR.\n\nFait à ${agencyProfile?.ville || agencyProfile?.address?.split(',')[0]?.trim() || 'Paris'}, le ${today}` },
              { type: 'signature' },
            ];
          }

          case 'compromis': {
            const prixVente = fmtAmt(ex.prixVenteCompromis || lead.budget || 0);
            const acompte = fmtAmt(ex.acompteCompromis || Math.round((ex.prixVenteCompromis || lead.budget || 0) * 0.1));
            const solde = fmtAmt((ex.prixVenteCompromis || lead.budget || 0) - (ex.acompteCompromis || Math.round((ex.prixVenteCompromis || lead.budget || 0) * 0.1)));
            return [
              { heading: 'COMPROMIS DE VENTE', type: 'title' },
              { heading: 'Parties', type: 'section' },
              { text: `Vendeur : ${ex.nomVendeur || '[Nom et prénom du vendeur]'}${ex.adresseVendeur ? '\nAdresse : ' + ex.adresseVendeur : ''}\n\nAcquéreur : ${lead.nom}\nEmail : ${lead.email || '—'}  |  Tél : ${lead.telephone || '—'}` },
              { heading: 'Bien vendu', type: 'section' },
              { text: `Le vendeur s\'engage à vendre à l\'acquéreur, qui accepte :\n\nAdresse : ${documentExtraSettings.adresseBien || '[adresse du bien]'}\nType : ${ex.typeBienMandat || lead.type_bien_recherche || lead.type_bien || '[type du bien]'}${ex.surfaceBien ? '\nSurface habitable : ' + ex.surfaceBien + ' m²' : ''}\n\nPrix de vente convenu : ${prixVente}` },
              { heading: 'Conditions financières', type: 'section' },
              { text: `Prix de vente : ${prixVente}\nAcompte (séquestre) à la signature : ${acompte}\nSolde à régler à l\'acte notarié définitif : ${solde}\n\nMode de financement : ☐ Comptant  ☐ Prêt bancaire (clause suspensive)` },
              { heading: 'Clauses suspensives', type: 'section' },
              { text: `La présente vente est conclue sous les conditions suspensives suivantes :\n• Obtention d\'un prêt bancaire d\'un montant minimum de ______ € au taux maximum de ______ %\n• Absence de servitude d\'urbanisme ou administrative incompatible avec l\'usage prévu\n• Accord de préemption de la commune ou de tout organisme disposant du droit de préemption\n\nDélai de réalisation des conditions suspensives : 45 jours à compter de la signature` },
              { heading: 'Délais', type: 'section' },
              { text: `Droit de rétractation de l\'acquéreur : 10 jours calendaires à compter du lendemain de la première présentation de la notification\nDate prévisionnelle de signature de l\'acte authentique : ______ / ______ / ______\n\nFait à ${agencyProfile?.ville || agencyProfile?.address?.split(',')[0]?.trim() || 'Paris'}, le ${today}` },
              { type: 'signature' },
            ];
          }

          case 'bon_visite': {
            return [
              { heading: 'BON DE VISITE', type: 'title' },
              { heading: 'Informations de la visite', type: 'section' },
              { text: `Visiteur : ${lead.nom}\nEmail : ${lead.email || '—'}  |  Tél : ${lead.telephone || '—'}\n\nBien visité : ${ex.adresseBienVisite || '[adresse du bien]'}\nDate de visite : ${ex.dateVisite ? new Date(ex.dateVisite).toLocaleDateString('fr-FR') : today}\nHeure : ${ex.heureVisite || '[heure]'}\n\nAgent organisateur : ${ex.agentNom || agencyName} — ${agencyName}` },
              { heading: 'Attestation de visite', type: 'section' },
              { text: `Je soussigné(e) ${lead.nom} atteste avoir visité le bien mentionné ci-dessus en présence d\'un représentant de l\'agence ${agencyName}.\n\nJe reconnais avoir pris connaissance :\n• Des caractéristiques principales du bien (surface, état général, équipements)\n• Du prix de présentation et des conditions de vente\n• Des informations disponibles sur les diagnostics obligatoires` },
              { heading: 'Obligations légales', type: 'section' },
              { text: `Le présent bon de visite confirme l\'intervention de l\'agence ${agencyName} dans le cadre de la présentation de ce bien. En cas d\'acquisition directe du bien présenté, sans passer par cette agence, le visiteur s\'expose à des poursuites pour contournement d\'agence.\n\n${ex.observationsVisite ? 'Observations :\n' + ex.observationsVisite : ''}` },
              { heading: 'Prochaines étapes', type: 'section' },
              { text: `• Retour du visiteur sous 48h\n• Proposition d\'offre (si intérêt confirmé)\n• Mise en relation avec le propriétaire vendeur\n• Préparation du compromis de vente (si accord)\n\nFait à ${agencyProfile?.ville || agencyProfile?.address?.split(',')[0]?.trim() || 'Paris'}, le ${today}` },
              { type: 'signature' },
            ];
          }

          case 'contrat': {
            const prixMensuel = fmtAmt(ex.prixMensuelContrat || 1500);
            const services = ex.servicesContrat.split('\n').filter(s => s.trim());
            return [
              { heading: 'CONTRAT DE PRESTATION DE SERVICES MARKETING DIGITAL', type: 'title' },
              { heading: 'Entre les soussignés', type: 'section' },
              { text: `Client : ${lead.nom}\nEmail : ${lead.email || '—'}  |  Tél : ${lead.telephone || '—'}${lead.type_service ? '\nSecteur : ' + lead.type_service : ''}${lead.secteur_activite ? ' — ' + lead.secteur_activite : ''}\n\nPrestataire : ${agencyName}\n${agencyProfile?.legalName || agencyName}${agencyProfile?.address ? '\n' + agencyProfile.address : ''}${agencyProfile?.registrationNumber ? '\nSIRET : ' + agencyProfile.registrationNumber : ''}` },
              { heading: 'Article 1 — Objet du contrat', type: 'section' },
              { text: `Le présent contrat a pour objet de définir les conditions dans lesquelles ${agencyName} (ci-après "le Prestataire") fournira au Client des services de marketing digital et de communication sur les réseaux sociaux.` },
              { heading: 'Article 2 — Prestations incluses', type: 'section' },
              { text: services.map(s => '• ' + s).join('\n') + `\n\nPlateformes couvertes : ${ex.plateformesContrat}` },
              { heading: 'Article 3 — Durée et conditions financières', type: 'section' },
              { text: `Durée du contrat : ${ex.dureeContratSMMA} mois à compter de la date de signature\nMontant mensuel : ${prixMensuel} HT/mois\n\nFacturation : mensuelle, en début de mois\nConditions de paiement : ${documentSettings.conditionsPaiementSMMA || 'À réception de facture, sous 30 jours'}\n\nEn cas de retard de paiement, des pénalités de 1,5% par mois seront appliquées conformément aux dispositions légales.` },
              { heading: 'Article 4 — Propriété intellectuelle', type: 'section' },
              { text: `Les contenus créés par le Prestataire dans le cadre de ce contrat restent sa propriété intellectuelle jusqu\'au complet paiement des honoraires correspondants. Le Client bénéficie d\'une licence d\'utilisation non exclusive sur lesdits contenus pour la durée du contrat.` },
              { heading: 'Article 5 — Résiliation', type: 'section' },
              { text: `En cas de souhait de résiliation anticipée, un préavis de 30 jours calendaires doit être adressé par email ou courrier recommandé avec AR. Les prestations déjà réalisées restent dues.\n\nFait à ${agencyProfile?.ville || agencyProfile?.address?.split(',')[0]?.trim() || 'Paris'}, le ${today}` },
              { type: 'signature' },
            ];
          }

          case 'rapport': {
            const periode = ex.periodeDateDebut && ex.periodeDateFin
              ? `Du ${new Date(ex.periodeDateDebut).toLocaleDateString('fr-FR')} au ${new Date(ex.periodeDateFin).toLocaleDateString('fr-FR')}`
              : `Mois de ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
            const recommandations = ex.recommandationsRapport.split('\n').filter(r => r.trim());
            return [
              { heading: 'RAPPORT DE PERFORMANCE MARKETING DIGITAL', type: 'title' },
              { heading: 'Informations générales', type: 'section' },
              { text: `Client : ${lead.nom}  |  ${lead.email || '—'}\nAgence : ${agencyName}\nPériode d\'analyse : ${periode}` },
              { heading: 'Indicateurs clés de performance (KPIs)', type: 'section' },
              { text: `TAUX D'ENGAGEMENT GLOBAL : ${ex.kpiConversion ? ex.kpiConversion + '%' : '—'}\nLEADS GÉNÉRÉS : ${ex.kpiLeads || '—'}\nCHIFFRE D\'AFFAIRES ESTIMÉ : ${ex.kpiCA ? fmtAmt(parseFloat(ex.kpiCA)) : '—'}` },
              { heading: 'Performances par plateforme', type: 'section' },
              { text: [
                '─ Instagram ─',
                `Abonnés : ${ex.kpiInstagramAbonnes || '—'}  |  Engagement : ${ex.kpiInstagramEngagement ? ex.kpiInstagramEngagement + '%' : '—'}  |  Portée : ${ex.kpiInstagramPortee || '—'} personnes`,
                '',
                '─ Facebook ─',
                `Abonnés : ${ex.kpiFacebookAbonnes || '—'}  |  Engagement : ${ex.kpiFacebookEngagement ? ex.kpiFacebookEngagement + '%' : '—'}  |  Portée : ${ex.kpiFacebookPortee || '—'} personnes`,
                '',
                '─ LinkedIn ─',
                `Abonnés : ${ex.kpiLinkedInAbonnes || '—'}  |  Engagement : ${ex.kpiLinkedInEngagement ? ex.kpiLinkedInEngagement + '%' : '—'}`,
              ].join('\n') },
              { heading: 'Recommandations stratégiques', type: 'section' },
              { text: recommandations.map(r => '• ' + r).join('\n') },
              { heading: 'Prochaines actions', type: 'section' },
              { text: `• Mise en place des recommandations dès la semaine prochaine\n• Révision du budget publicitaire si besoin\n• Prochain point de performance : dans 30 jours\n\nRapport établi par ${agencyName}, le ${today}` },
            ];
          }

          default:
            return null;
        }
      };

      // Préparer les données du document
      const bodyContent = buildBodyContent();
      let documentData = {
        type: docType,
        number: documentNumber, // 🎯 Numéro légal (string direct)
        settings: documentSettings,
        extraSettings: documentExtraSettings,
        bodyContent,
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
        // SMMA : prixHT saisi par l'utilisateur (pas de logique commission)
        // IMMO : commission % ou fixe + honoraires + frais
        let commissionAmount;
        let baseAmount;
        if (agencyType === 'smma') {
          baseAmount     = documentSettings.prixHT || 0;
          commissionAmount = baseAmount; // pour SMMA : une seule ligne = prixHT
        } else {
          commissionAmount = documentSettings.commissionType === 'percentage'
            ? documentSettings.bienPrice * (documentSettings.commissionValue / 100)
            : documentSettings.commissionValue;
          baseAmount = commissionAmount + documentSettings.honoraires + documentSettings.frais;
        }
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
              description: agencyType === 'immobilier' ? 'Honoraires de négociation immobilière' : documentSettings.designationPrestation || 'Services de marketing digital',
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

      // 🎯 GÉNÉRER LE HTML DU DOCUMENT (STRIPE-LIKE)
      const documentHtml = generateDocumentHtml({
        document: documentData,
        agencyProfile: agencyProfile,
        lead: lead,
        docType: { ...docType, agencyType }  // ← transmet le type d'agence au template HTML
      });

      console.log("🎯 HTML généré et prêt à être persisté:", documentHtml.substring(0, 200) + "...");

      // 🎯 INSÉRER DANS LA TABLE documents (ARCHITECTURE PERSISTÉE)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 🎯 UTILISER L'AGENCY ID DÉJÀ CHARGÉ dans agencyProfile (avec fallbacks)
          // Ne pas refaire une requête DB — si agency_id est null en DB, on utilise le prop agencyId
          // puis user.id en dernier recours. La re-requête silencieuse avec return causait
          // la disparition du preview sans message d'erreur visible.
          const resolvedAgencyId = agencyProfile?.agency_id || agencyId || user.id;

          // 🎯 CALCULER LES MONTANTS — respecte SMMA vs IMMO
          // Pour SMMA : baseAmount = prixHT saisi par l'utilisateur (pas de logique commission)
          // Pour IMMO : baseAmount = commission + honoraires + frais
          let insertBaseAmount, insertTvaAmount, insertTotalTTC;
          if (agencyType === 'smma') {
            insertBaseAmount = documentSettings.prixHT || 0;
            insertTvaAmount  = insertBaseAmount * (documentSettings.tva / 100);
            insertTotalTTC   = insertBaseAmount + insertTvaAmount;
          } else {
            const insertCommission = documentSettings.commissionType === 'percentage'
              ? (documentSettings.commissionValue / 100) * documentSettings.bienPrice
              : documentSettings.commissionValue;
            insertBaseAmount = insertCommission + documentSettings.honoraires + documentSettings.frais;
            insertTvaAmount  = insertBaseAmount * (documentSettings.tva / 100);
            insertTotalTTC   = insertBaseAmount + insertTvaAmount;
          }

          // 🎯 INSÉRER AVEC HTML PERSISTÉ (COMME STRIPE)
          // Note: si la table 'documents' a une contrainte CHECK sur 'type',
          // les nouveaux types (bon_visite, compromis, contrat_gestion…) peuvent échouer.
          // Le fallback utilise 'autre' comme type pour contourner la contrainte.
          const insertPayload = {
            agency_id: resolvedAgencyId,
            lead_id: lead.id,
            type: docType.id,
            reference: documentData.number,
            titre: `${docType.label} - ${lead.nom}`,
            statut: 'généré',  // ✅ Français — cohérent avec DocumentsPage.jsx
            preview_html: documentHtml,  // 🎯 HTML PERSISTÉ (STRIPE-LIKE)
            total_ttc: insertTotalTTC,
            total_ht: insertBaseAmount,
            tva_amount: insertTvaAmount,
            devise: agencyProfile.devise || 'EUR',
            client_nom: lead.nom,
            client_email: lead.email,
            client_telephone: lead.telephone || lead.phone || null,
            // 🎯 content_json — nécessaire pour la conversion devis→facture
            content_json: documentData.financialData ? {
              type_document: docType.id,
              items: documentData.financialData.items,
              totals: documentData.financialData.totals,
              devise: agencyProfile.devise || 'EUR',
              agency_type: agencyType
            } : null,
            created_at: new Date().toISOString()
          };

          let { data: insertedData, error: insertError } = await supabase
            .from('documents')
            .insert(insertPayload)
            .select();

          // 23514 = violation de contrainte CHECK (ex: type inconnu)
          // Réessayer sans le champ 'type' problématique
          if (insertError && insertError.code === '23514') {
            console.warn('⚠️ Contrainte CHECK sur type, réessai sans restriction de type');
            const { data: retryData, error: retryError } = await supabase
              .from('documents')
              .insert({ ...insertPayload, type: 'autre' })
              .select();
            insertedData = retryData;
            insertError = retryError;
          }

          if (insertError) {
            console.error('❌ Erreur insertion document:', insertError);
            console.error('❌ Détails erreur:', insertError.details);
            console.error('❌ Code erreur:', insertError.code);
          } else {
            console.log('✅ Document inséré dans la table documents');
            console.log('✅ Données insérées:', insertedData);
            
            // 🎯 AJOUTER DANS CRM_EVENTS
            try {
              await supabase.from('crm_events').insert({
                lead_id: lead.id,
                agency_id: resolvedAgencyId,
                type: 'document_generated',
                title: `📄 ${docType.label} généré`,
                description: `${docType.label} ${documentData.number} — ${insertTotalTTC || 0} ${agencyProfile?.devise || 'EUR'}`,
                metadata: { document_number: documentData.number, total_ttc: insertTotalTTC },
                created_at: new Date().toISOString()
              });
            } catch (_) { /* non-bloquant */ }
          }
        }
      } catch (error) {
        console.error('❌ Erreur historique document:', error);
        console.error('❌ Détails erreur générale:', error);
      }
      
      // 📊 Avancer le pipeline selon le type de document généré
      await updateLeadStatus(docType.id);

      // 🎯 PRÉPARER L'AFFICHAGE DEPUIS LA BASE (PAS D'ÉTAT TEMPORAIRE)
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
        { label: 'Budget', value: fmtA(lead.budget || 0) }
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
          content = `COMPROMIS DE VENTE\n\nPARTIES CONCERNÉES\nVendeur: [Nom et adresse du vendeur]\nAcheteur: ${lead.nom}\n${lead.email ? 'Email: ' + lead.email : ''}\n${lead.telephone ? 'Téléphone: ' + lead.telephone : ''}\n\nBIEN CONCERNÉ\nAdresse: [adresse complète du bien]\nPrix de vente: ${fmtA(lead.budget || 0)}\n\nCLAUSES SUSPENSIVES\n• Obtention d'un prêt bancaire (si applicable)\n• Accord de la copropriété (si applicable)\n• Autorisation administrative (si applicable)\n\nCONDITIONS FINANCIÈRES\nAccomppte: ${fmtA((lead.budget || 0) * 0.10)} (10% du prix de vente)\nSolde: ${fmtA((lead.budget || 0) * 0.90)} à la levée des clauses suspensives\n\nDÉLAIS\nDélai de rétractation: 10 jours à compter de la signature\nDate prévisionnelle de signature définitive: [à déterminer]`;
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
        case 'contrat_gestion':
          content = `CONTRAT DE GESTION LOCATIVE\n\nPARTIES\nPropriétaire: ${lead.nom}\n${lead.email ? 'Email: ' + lead.email : ''}\n${lead.telephone ? 'Téléphone: ' + lead.telephone : ''}\nMandataire: ${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.registrationNumber || ''}\n\nBIEN CONCERNÉ\nAdresse: [adresse complète du bien]\nType de bien: ${lead.type_bien || 'Appartement'}\nValeur estimée: ${fmtA(lead.budget || 0)}\n\nOBJET DU CONTRAT\nLe présent contrat a pour objet de confier au Mandataire la gestion locative et/ou la mise en gestion du bien désigné ci-dessus.\n\nMISSIONS DU MANDATAIRE\n• Recherche et sélection des locataires\n• Rédaction et signature des baux\n• Perception des loyers et charges\n• Gestion des travaux et entretiens courants\n• Suivi comptable et reporting mensuel\n• Représentation auprès des organismes tiers\n\nHONORAIRES DE GESTION\nHonoraires de gestion: 8% des loyers hors charges perçus\nHonoraires de remise en location: 1 mois de loyer HC\n\nDURÉE DU MANDAT\nLe présent mandat est conclu pour une durée d'un an renouvelable par tacite reconduction.\n\nRÉSILIATION\nPréavis de 3 mois avant la date anniversaire par lettre recommandée avec AR.`;
          break;
        case 'contrat':
          content = `CONTRAT DE PRESTATION DE SERVICES\n\nPARTIES\nClient: ${lead.nom}\nPrestataire: ${profileToUse?.name || 'Agence'}\n${profileToUse?.legalName || ''}\n${profileToUse?.registrationNumber || ''}\n\nOBJET DU CONTRAT\nPrestations de marketing digital et communication\n\nDURÉE\nLe présent contrat est conclu pour une durée de 6 mois à compter de la date de signature.\n\nPRESTATIONS INCLUSES\n• Stratégie marketing personnalisée\n• Gestion des réseaux sociaux (3 plateformes)\n• Création de contenu mensuel (15 publications)\n• Campagnes publicitaires mensuelles\n• Analyse et reporting mensuel\n• Optimisation continue\n\nMONTANT\n${fmtA((lead.budget || 0) * 0.05)} par mois\n\nCONDITIONS DE RÉSILIATION\nPréavis de 30 jours par courriel recommandé`;
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
    if (!lead?.id) return;
    // Mapping type de document → statut pipeline cible (uniquement statuts connus du pipeline)
    // On utilise le RPC advance_lead_statut (SECURITY DEFINER) pour contourner RLS
    // et ne jamais rétrograder un lead.
    const TARGET_MAP = {
      devis:          { target: 'Offre en cours', force: false },
      facture:        { target: 'Gagné',          force: true  }, // force : même depuis Négociation
      mandat:         { target: 'Offre en cours', force: false },
      contrat_gestion:{ target: 'Offre en cours', force: false },
      bon_visite:     { target: 'RDV fixé',       force: false },
      contrat:        { target: 'Offre en cours', force: false },
      rapport:        { target: 'Offre en cours', force: false },
    };
    const mapping = TARGET_MAP[documentType];
    if (!mapping) return; // type inconnu → on ne touche pas au statut
    try {
      const { error } = await supabase.rpc('advance_lead_statut', {
        p_lead_id: lead.id,
        p_target:  mapping.target,
        p_force:   mapping.force,
      });
      if (error) console.warn('[DocumentGenerator] RPC advance erreur:', error.message);
    } catch (err) {
      console.warn('[DocumentGenerator] RPC advance exception:', err?.message);
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

      {/* Alerte visible si profil incomplet */}
      {!profileLoading && !canGenerate && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Informations manquantes</p>
            <p className="text-xs text-amber-600 mt-0.5">{validationMessage}</p>
            <a
              href="/settings?tab=legal"
              className="inline-block mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900"
            >
              Compléter les paramètres légaux →
            </a>
          </div>
        </div>
      )}

      {/* Chargement du profil */}
      {profileLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
          Chargement du profil…
        </div>
      )}

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
              {/* ════════════════════════════════════════════
                  FORMULAIRES SELON TYPE DE DOCUMENT
                  ════════════════════════════════════════════ */}

              {/* ── DEVIS / FACTURE IMMO ── */}
              {(pendingDocType?.id === 'devis' || pendingDocType?.id === 'facture') && agencyType === 'immobilier' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix du bien ({sym}) *</label>
                      <input type="number" value={documentSettings.bienPrice}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, bienPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 250000" min="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type de commission *</label>
                      <div className="flex gap-2">
                        <button onClick={() => setDocumentSettings(prev => ({ ...prev, commissionType: 'percentage' }))}
                          className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors text-sm ${documentSettings.commissionType === 'percentage' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-700'}`}>%</button>
                        <button onClick={() => setDocumentSettings(prev => ({ ...prev, commissionType: 'fixed' }))}
                          className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors text-sm ${documentSettings.commissionType === 'fixed' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-700'}`}>{sym} fixe</button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{documentSettings.commissionType === 'percentage' ? 'Commission (%)' : 'Commission ({sym})'}</label>
                      <input type="number" value={documentSettings.commissionValue}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, commissionValue: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" step={documentSettings.commissionType === 'percentage' ? '0.1' : '100'} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Honoraires sup. ({sym})</label>
                      <input type="number" value={documentSettings.honoraires}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, honoraires: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">TVA (%)</label>
                      <select value={documentSettings.tva} onChange={(e) => setDocumentSettings(prev => ({ ...prev, tva: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="0">0%</option><option value="5.5">5.5%</option><option value="10">10%</option><option value="20">20%</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conditions de paiement</label>
                    <textarea value={documentSettings.conditionsPaiement}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, conditionsPaiement: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" rows={2} />
                  </div>
                </>
              )}

              {/* ── DEVIS / FACTURE SMMA ── */}
              {(pendingDocType?.id === 'devis' || pendingDocType?.id === 'facture') && agencyType === 'smma' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Désignation de la prestation *</label>
                    <input type="text" value={documentSettings.designationPrestation}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, designationPrestation: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Stratégie marketing digitale complète" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix HT ({sym}) *</label>
                      <input type="number" value={documentSettings.prixHT}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, prixHT: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">TVA (%)</label>
                      <select value={documentSettings.tva} onChange={(e) => setDocumentSettings(prev => ({ ...prev, tva: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="0">0%</option><option value="5.5">5.5%</option><option value="10">10%</option><option value="20">20%</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Périodicité</label>
                      <select value={documentSettings.periodicite} onChange={(e) => setDocumentSettings(prev => ({ ...prev, periodicite: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="one-shot">One-shot</option><option value="mensuel">Mensuel</option><option value="trimestriel">Trimestriel</option><option value="annuel">Annuel</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conditions de paiement</label>
                    <textarea value={documentSettings.conditionsPaiementSMMA}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, conditionsPaiementSMMA: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" rows={2} />
                  </div>
                </>
              )}

              {/* ── MANDAT DE VENTE ── */}
              {pendingDocType?.id === 'mandat' && (
                <>
                  <div className="bg-blue-50 rounded-lg px-4 py-2 text-xs text-blue-700 font-medium">🏠 Mandat exclusif de vente</div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adresse du bien *</label>
                    <input type="text" value={documentExtraSettings.adresseBien}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, adresseBien: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 12 rue des Lilas, 75010 Paris" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type de bien</label>
                      <input type="text" value={documentExtraSettings.typeBienMandat}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, typeBienMandat: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Appartement / Maison" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Surface (m²)</label>
                      <input type="text" value={documentExtraSettings.surfaceBien}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, surfaceBien: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 85" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix de vente ({sym}) *</label>
                      <input type="number" value={documentExtraSettings.prixVenteMandat}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, prixVenteMandat: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Commission agence (%)</label>
                      <input type="number" value={documentExtraSettings.tauxCommissionMandat}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, tauxCommissionMandat: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" step="0.1" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Durée du mandat (mois)</label>
                      <input type="number" value={documentExtraSettings.dureeMandat}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, dureeMandat: parseInt(e.target.value) || 3 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="1" max="12" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="exclusif" checked={documentExtraSettings.mandatExclusif}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, mandatExclusif: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded" />
                    <label htmlFor="exclusif" className="text-sm text-slate-700">Mandat exclusif (le propriétaire ne peut pas confier à une autre agence)</label>
                  </div>
                </>
              )}

              {/* ── CONTRAT DE GESTION LOCATIVE ── */}
              {pendingDocType?.id === 'contrat_gestion' && (
                <>
                  <div className="bg-green-50 rounded-lg px-4 py-2 text-xs text-green-700 font-medium">🏘️ Gestion locative</div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adresse du bien *</label>
                    <input type="text" value={documentExtraSettings.adresseBienGestion}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, adresseBienGestion: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 5 avenue Victor Hugo, 69006 Lyon" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type de bien</label>
                      <input type="text" value={documentExtraSettings.typeBienGestion}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, typeBienGestion: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Appartement / Maison" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Loyer mensuel charges comprises ({sym})</label>
                      <input type="number" value={documentExtraSettings.loyerMensuel}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, loyerMensuel: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 850" min="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Honoraires de gestion (%)</label>
                      <input type="number" value={documentExtraSettings.tauxGestion}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, tauxGestion: parseFloat(e.target.value) || 8 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" step="0.5" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Durée du contrat (mois)</label>
                      <input type="number" value={documentExtraSettings.dureeContratGestion}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, dureeContratGestion: parseInt(e.target.value) || 12 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="1" />
                    </div>
                  </div>
                </>
              )}

              {/* ── COMPROMIS DE VENTE ── */}
              {pendingDocType?.id === 'compromis' && (
                <>
                  <div className="bg-purple-50 rounded-lg px-4 py-2 text-xs text-purple-700 font-medium">🤝 Compromis de vente</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom du vendeur *</label>
                      <input type="text" value={documentExtraSettings.nomVendeur}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, nomVendeur: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Nom Prénom du vendeur" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Adresse du vendeur</label>
                      <input type="text" value={documentExtraSettings.adresseVendeur}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, adresseVendeur: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Adresse complète" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adresse du bien *</label>
                    <input type="text" value={documentExtraSettings.adresseBien}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, adresseBien: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Adresse complète du bien" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix de vente ({sym}) *</label>
                      <input type="number" value={documentExtraSettings.prixVenteCompromis}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, prixVenteCompromis: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Acompte / séquestre ({sym})</label>
                      <input type="number" value={documentExtraSettings.acompteCompromis}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, acompteCompromis: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" />
                    </div>
                  </div>
                </>
              )}

              {/* ── BON DE VISITE ── */}
              {pendingDocType?.id === 'bon_visite' && (
                <>
                  <div className="bg-orange-50 rounded-lg px-4 py-2 text-xs text-orange-700 font-medium">🏠 Bon de visite</div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adresse du bien visité *</label>
                    <input type="text" value={documentExtraSettings.adresseBienVisite}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, adresseBienVisite: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Adresse complète du bien" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date de visite</label>
                      <input type="date" value={documentExtraSettings.dateVisite}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, dateVisite: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Heure</label>
                      <input type="time" value={documentExtraSettings.heureVisite}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, heureVisite: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Agent présent</label>
                      <input type="text" value={documentExtraSettings.agentNom}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, agentNom: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Nom de l'agent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observations / remarques</label>
                    <textarea value={documentExtraSettings.observationsVisite}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, observationsVisite: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" rows={3}
                      placeholder="État général du bien, points d'attention, retours du visiteur..." />
                  </div>
                </>
              )}

              {/* ── CONTRAT DE PRESTATION SMMA ── */}
              {pendingDocType?.id === 'contrat' && agencyType === 'smma' && (
                <>
                  <div className="bg-indigo-50 rounded-lg px-4 py-2 text-xs text-indigo-700 font-medium">📝 Contrat de prestation marketing</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix mensuel HT ({sym}) *</label>
                      <input type="number" value={documentExtraSettings.prixMensuelContrat}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, prixMensuelContrat: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Durée du contrat (mois) *</label>
                      <input type="number" value={documentExtraSettings.dureeContratSMMA}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, dureeContratSMMA: parseInt(e.target.value) || 6 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Plateformes gérées</label>
                    <input type="text" value={documentExtraSettings.plateformesContrat}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, plateformesContrat: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Instagram, Facebook, LinkedIn, TikTok" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prestations incluses (une par ligne) *</label>
                    <textarea value={documentExtraSettings.servicesContrat}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, servicesContrat: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm" rows={6}
                      placeholder="Stratégie marketing digitale&#10;Gestion réseaux sociaux&#10;Création de contenu (15 publications)&#10;..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conditions de paiement</label>
                    <input type="text" value={documentSettings.conditionsPaiementSMMA}
                      onChange={(e) => setDocumentSettings(prev => ({ ...prev, conditionsPaiementSMMA: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="À réception de facture, sous 30 jours" />
                  </div>
                </>
              )}

              {/* ── RAPPORT DE PERFORMANCE SMMA ── */}
              {pendingDocType?.id === 'rapport' && agencyType === 'smma' && (
                <>
                  <div className="bg-rose-50 rounded-lg px-4 py-2 text-xs text-rose-700 font-medium">📊 Rapport de performance</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Période — Début</label>
                      <input type="date" value={documentExtraSettings.periodeDateDebut}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, periodeDateDebut: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Période — Fin</label>
                      <input type="date" value={documentExtraSettings.periodeDateFin}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, periodeDateFin: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">📸 Instagram</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="block text-xs text-slate-500 mb-1">Abonnés</label>
                        <input type="text" value={documentExtraSettings.kpiInstagramAbonnes}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiInstagramAbonnes: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 4 280" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Engagement (%)</label>
                        <input type="text" value={documentExtraSettings.kpiInstagramEngagement}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiInstagramEngagement: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 3.2" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Portée</label>
                        <input type="text" value={documentExtraSettings.kpiInstagramPortee}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiInstagramPortee: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 18 500" /></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">📘 Facebook</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="block text-xs text-slate-500 mb-1">Abonnés</label>
                        <input type="text" value={documentExtraSettings.kpiFacebookAbonnes}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiFacebookAbonnes: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 2 100" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Engagement (%)</label>
                        <input type="text" value={documentExtraSettings.kpiFacebookEngagement}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiFacebookEngagement: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 1.8" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Portée</label>
                        <input type="text" value={documentExtraSettings.kpiFacebookPortee}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiFacebookPortee: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 9 200" /></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">💼 LinkedIn</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-slate-500 mb-1">Abonnés</label>
                        <input type="text" value={documentExtraSettings.kpiLinkedInAbonnes}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiLinkedInAbonnes: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 850" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Engagement (%)</label>
                        <input type="text" value={documentExtraSettings.kpiLinkedInEngagement}
                          onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiLinkedInEngagement: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500" placeholder="Ex: 4.5" /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Leads générés</label>
                      <input type="text" value={documentExtraSettings.kpiLeads}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiLeads: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 24" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Taux de conversion (%)</label>
                      <input type="text" value={documentExtraSettings.kpiConversion}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiConversion: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 2.4" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">CA estimé ({sym})</label>
                      <input type="text" value={documentExtraSettings.kpiCA}
                        onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, kpiCA: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ex: 12000" /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Recommandations stratégiques (une par ligne)</label>
                    <textarea value={documentExtraSettings.recommandationsRapport}
                      onChange={(e) => setDocumentExtraSettings(prev => ({ ...prev, recommandationsRapport: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-y text-sm" rows={4}
                      placeholder="Optimisation du contenu existant&#10;Nouvelles campagnes ciblées&#10;Analyse concurrentielle..." />
                  </div>
                </>
              )}

              {/* ═══ RÉCAPITULATIF FINANCIER (devis/facture seulement) ═══ */}
              {(pendingDocType?.id === 'devis' || pendingDocType?.id === 'facture') && (
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
                          {fmtA(calculateCommission())}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Honoraires:</span>
                        <span className="font-medium text-slate-900">{fmtA(documentSettings.honoraires)}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Frais annexes:</span>
                        <span className="font-medium text-slate-900">{fmtA(documentSettings.frais)}</span>
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
                        {fmtA(calculateTotalHT())}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">TVA ({documentSettings.tva}%):</span>
                      <span className="font-medium text-slate-900">
                        {fmtA(calculateTVA())}
                      </span>
                    </div>

                    <div className="flex justify-between text-lg font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
                      <span>Total TTC:</span>
                      <span>
                        {fmtA(calculateTotalTTC())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              )}

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
                        <span className="client-label">{agencyType === 'smma' ? 'Service' : 'Projet'}:</span>
                        <span className="client-value">
                          {agencyType === 'smma'
                            ? (docData.lead?.type_service || docData.lead?.secteur_activite || 'Non spécifié')
                            : (docData.lead?.type_bien_recherche || docData.lead?.type_bien || 'Non spécifié')}
                        </span>
                      </div>
                      {(docData.lead?.budget || docData.lead?.budget_marketing) && (
                        <div className="client-item">
                          <span className="client-label">Budget:</span>
                          <span className="client-value">
                            {agencyType === 'smma'
                              ? (docData.lead?.budget_marketing || '—')
                              : formatAmount(docData.lead.budget, docData.document?.financialData?.devise || 'EUR')}
                          </span>
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
                              {formatAmount(item.amount, docData.document?.financialData?.devise || 'EUR')}
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
                                {formatAmount(total.amount, docData.document?.financialData?.devise || 'EUR')}
                              </td>
                            </tr>
                          );
                        })}
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Corps structuré du document (mandat, contrat, rapport…) */}
                {docData.document?.bodyContent && docData.document.bodyContent.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    {docData.document.bodyContent.map((block, idx) => {
                      if (block.type === 'title') {
                        return <div key={idx} style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a5f', textAlign: 'center', margin: '0 0 20px 0', paddingBottom: '10px', borderBottom: '2px solid #3b82f6', letterSpacing: '0.04em' }}>{block.heading}</div>;
                      } else if (block.type === 'section') {
                        return <div key={idx} style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '18px 0 4px 0', paddingBottom: '4px', borderBottom: '1px solid #dbeafe' }}>{block.heading}</div>;
                      } else if (block.type === 'signature') {
                        const agencyCity = docData.agencyProfile?.ville || docData.agencyProfile?.address?.split(',')[0]?.trim() || '';
                        const sigUrl = docData.agencyProfile?.signature_url;
                        return (
                          <div key={idx} className="signature-section">
                            <div className="signature-block">
                              <div className="signature-title">SIGNATURE AGENCE</div>
                              {sigUrl
                                ? <img src={sigUrl} alt="Signature agence" style={{ height: '56px', objectFit: 'contain', margin: '6px 0' }} />
                                : <div className="signature-line"></div>
                              }
                              <div className="signature-label">{docData.agencyProfile?.name || 'Agence'}</div>
                              <div className="signature-date">Fait à {agencyCity || '__________'}, le {new Date().toLocaleDateString('fr-FR')}</div>
                            </div>
                            <div className="signature-block">
                              <div className="signature-title">SIGNATURE CLIENT</div>
                              <div className="signature-line"></div>
                              <div className="signature-label">{docData.lead?.nom || 'Client'}</div>
                              <div className="signature-date">Fait à {agencyCity || '__________'}, le ___________</div>
                            </div>
                          </div>
                        );
                      } else if (block.text) {
                        return <div key={idx} style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.7', margin: '4px 0' }}>{block.text}</div>;
                      }
                      return null;
                    })}
                  </div>
                )}

                {/* Métadonnées (montant en lettres — devis/facture) */}
                {docData.document?.metadata?.amountInWords && (
                  <div className="metadata-content" style={{ marginTop: '10px', fontStyle: 'italic', textAlign: 'center', fontSize: '14px' }}>
                    <strong>{docData.document.metadata.amountInWords}</strong>
                  </div>
                )}

                {/* Signature par défaut si pas de bodyContent (devis/facture) */}
                {(!docData.document?.bodyContent || docData.document.bodyContent.length === 0) && (
                  <>
                    {(() => {
                      const agencyCity = docData.agencyProfile?.ville || docData.agencyProfile?.address?.split(',')[0]?.trim() || '';
                      const sigUrl = docData.agencyProfile?.signature_url;
                      return (
                        <div className="signature-section">
                          <div className="signature-block">
                            <div className="signature-title">SIGNATURE AGENCE</div>
                            {sigUrl
                              ? <img src={sigUrl} alt="Signature agence" style={{ height: '56px', objectFit: 'contain', margin: '6px 0' }} />
                              : <div className="signature-line"></div>
                            }
                            <div className="signature-label">{docData.agencyProfile?.name || 'Agence'}</div>
                            <div className="signature-date">Fait à {agencyCity || '__________'}, le {new Date().toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div className="signature-block">
                            <div className="signature-title">SIGNATURE CLIENT</div>
                            <div className="signature-line"></div>
                            <div className="signature-label">{docData.lead?.nom || 'Client'}</div>
                            <div className="signature-date">Fait à {agencyCity || '__________'}, le ___________</div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
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
                  // 🎯 Nom de fichier dynamique : Type_Client_Ref (ex: Mandat_Jean_Dupont_MAN-2026-001)
                  const docLabel = (docData?.document?.type?.label || 'Document').replace(/\s+/g, '_');
                  const clientNom = (docData?.lead?.nom || 'Client').replace(/\s+/g, '_');
                  const docRef = docData?.document?.number || '';
                  const printTitle = [docLabel, clientNom, docRef].filter(Boolean).join('_');
                  const prevTitle = document.title;
                  document.title = printTitle;
                  // Restaurer le titre après impression (événement afterprint)
                  const restoreTitle = () => {
                    document.title = prevTitle;
                    window.removeEventListener('afterprint', restoreTitle);
                  };
                  window.addEventListener('afterprint', restoreTitle);
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
