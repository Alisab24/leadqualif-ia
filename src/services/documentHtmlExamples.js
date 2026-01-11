/**
 * INGÉNIEUR SaaS - Exemples d'utilisation de generateDocumentHtml()
 * 
 * Cas d'usage réels pour IMMOBILIER et SMMA
 */

import DocumentHtmlService from './documentHtmlService';

/**
 * EXEMPLE 1: IMMOBILIER - Devis avec lead
 */
export const exempleImmobilierDevis = async () => {
  const agencyProfile = {
    type_agence: 'immobilier',
    nom_agence: 'ImmoPro Agence',
    adresse_legale: '123 Avenue des Champs-Élysées, 75008 Paris',
    telephone: '01 42 86 83 42',
    email: 'contact@immopro.fr',
    numero_siret: '12345678901234',
    devise: 'EUR',
    mentions_legales: 'Agence immatriculée au RCS Paris, Assurance RC n°12345'
  };

  const leadData = {
    id: 'lead_123',
    nom: 'Martin Dupont',
    email: 'martin.dupont@email.com',
    telephone: '06 12 34 56 78',
    adresse: '45 Rue de la Paix, 75002 Paris',
    type_bien: 'appartement',
    surface: 85,
    budget: 450000
  };

  const customData = {
    bien_type: 'appartement',
    surface: 85,
    adresse: '45 Rue de la Paix, 75002 Paris',
    prix_vente: 450000,
    duree_mandat: 3,
    exclusivite: true
  };

  const calculations = {
    honoraires: 450000 * 0.05, // 5%
    tva: (450000 * 0.05) * 0.20, // TVA sur honoraires
    total_ttc: (450000 * 0.05) + ((450000 * 0.05) * 0.20)
  };

  try {
    const result = await DocumentHtmlService.generateDocumentHtml({
      agencyProfile,
      documentType: 'devis',
      leadData,
      customData,
      calculations
    });

    console.log('✅ Devis immobilier généré:', result.metadata);
    return result.html;
    
  } catch (error) {
    console.error('❌ Erreur génération devis immobilier:', error);
    throw error;
  }
};

/**
 * EXEMPLE 2: SMMA - Facture sans lead (cas autorisé)
 */
export const exempleSmmaFacture = async () => {
  const agencyProfile = {
    type_agence: 'smma',
    nom_agence: 'DigitalBoost Agency',
    adresse_legale: '789 Rue du Commerce, 69002 Lyon',
    telephone: '04 78 95 12 34',
    email: 'hello@digitalboost.fr',
    numero_siret: '98765432109876',
    devise: 'EUR',
    mentions_legales: 'Prestataire de services digitaux, TVA FR123456789'
  };

  // PAS de leadData pour SMMA (cas autorisé)
  const customData = {
    client_nom: 'SARL TechInnov',
    client_email: 'contact@techinnov.fr',
    client_telephone: '04 72 89 01 23',
    client_adresse: '321 Avenue de la Technologie, 69000 Lyon',
    services_inclus: 'Community Management, Publicité Facebook/Instagram, Reporting mensuel',
    periode_facturation: 'Octobre 2024',
    budget_mensuel: 1500
  };

  const calculations = {
    total_ht: 1500,
    tva: 1500 * 0.20,
    total_ttc: 1500 + (1500 * 0.20)
  };

  try {
    const result = await DocumentHtmlService.generateDocumentHtml({
      agencyProfile,
      documentType: 'facture',
      leadData: null, // SMMA peut fonctionner sans lead
      customData,
      calculations
    });

    console.log('✅ Facture SMMA générée:', result.metadata);
    return result.html;
    
  } catch (error) {
    console.error('❌ Erreur génération facture SMMA:', error);
    throw error;
  }
};

/**
 * EXEMPLE 3: IMMOBILIER - Mandat avec calculs complexes
 */
export const exempleImmobilierMandat = async () => {
  const agencyProfile = {
    type_agence: 'immobilier',
    nom_agence: 'Premium Immobilier',
    devise: 'EUR'
  };

  const leadData = {
    id: 'lead_456',
    nom: 'Sophie Martin',
    email: 'sophie.martin@email.com',
    type_bien: 'maison',
    surface: 120,
    budget: 750000
  };

  const customData = {
    bien_type: 'maison',
    surface: 120,
    adresse: '15 Rue des Jardins, 92100 Boulogne',
    prix_vente: 750000,
    duree_mandat: 6,
    exclusivite: true
  };

  // Calculs spécifiques au mandat
  const calculations = {
    commission: 750000 * 0.05, // 5% pour exclusif
    commission_taux: 0.05,
    frais_annexes: 500,
    total_mandat: (750000 * 0.05) + 500
  };

  try {
    const result = await DocumentHtmlService.generateDocumentHtml({
      agencyProfile,
      documentType: 'mandat',
      leadData,
      customData,
      calculations
    });

    console.log('✅ Mandat immobilier généré:', result.metadata);
    return result.html;
    
  } catch (error) {
    console.error('❌ Erreur génération mandat immobilier:', error);
    throw error;
  }
};

/**
 * EXEMPLE 4: SMMA - Rapport de performance
 */
export const exempleSmmaRapport = async () => {
  const agencyProfile = {
    type_agence: 'smma',
    nom_agence: 'SocialMedia Pro',
    devise: 'EUR'
  };

  const customData = {
    client_nom: 'Restaurant Le Gourmet',
    periode_analyse: '2024-10',
    services_inclus: 'Instagram Management, Publicité Facebook, Reporting',
    budget_mensuel: 2000,
    duree_contrat: 12,
    kpi_principaux: {
      objectif_leads: 100,
      objectif_conversions: 20,
      valeur_conversion: 50
    },
    resultats_obtenus: {
      leads_generes: 125,
      conversions: 18,
      taux_engagement: 4.5,
      portee_totale: 50000
    }
  };

  // Calculs de performance
  const calculations = {
    performance_score: Math.min((125 / 100) * 100, 100), // 125% mais plafonné à 100
    taux_conversion_realise: (18 / 125) * 100, // 14.4%
    roi_estime: (18 * 50) - 2000, // -1100€ (perte ce mois-ci)
    performance_leads: 125 / 100, // 125% de l'objectif
    performance_conversions: 18 / 20 // 90% de l'objectif
  };

  try {
    const result = await DocumentHtmlService.generateDocumentHtml({
      agencyProfile,
      documentType: 'rapport',
      leadData: null, // Pas de lead pour les rapports
      customData,
      calculations
    });

    console.log('✅ Rapport SMMA généré:', result.metadata);
    return result.html;
    
  } catch (error) {
    console.error('❌ Erreur génération rapport SMMA:', error);
    throw error;
  }
};

/**
 * EXEMPLE 5: Test de robustesse - Template manquant
 */
export const exempleTemplateManquant = async () => {
  const agencyProfile = {
    type_agence: 'immobilier',
    nom_agence: 'Test Agency'
  };

  const customData = {
    client_nom: 'Test Client'
  };

  try {
    // Ce template n'existe probablement pas en base
    const result = await DocumentHtmlService.generateDocumentHtml({
      agencyProfile,
      documentType: 'document_inexistant',
      leadData: null,
      customData
    });

    console.log('✅ Fallback utilisé:', result.metadata.isFallback);
    return result.html;
    
  } catch (error) {
    console.error('❌ Erreur même avec fallback:', error);
    throw error;
  }
};

/**
 * EXEMPLE 6: Test de performance
 */
export const exemplePerformanceTest = async () => {
  const agencyProfile = {
    type_agence: 'smma',
    nom_agence: 'Performance Test Agency',
    devise: 'EUR'
  };

  const customData = {
    client_nom: 'Performance Client',
    services_inclus: 'Test de performance',
    budget_mensuel: 1000
  };

  const startTime = Date.now();
  
  try {
    const result = await DocumentHtmlService.generateDocumentHtml({
      agencyProfile,
      documentType: 'devis',
      leadData: null,
      customData
    });

    // Log des performances
    DocumentHtmlService.logPerformance(startTime, result.metadata);
    
    console.log('📊 Performance test terminé');
    return result;
    
  } catch (error) {
    console.error('❌ Erreur performance test:', error);
    throw error;
  }
};

/**
 * FONCTION DE TEST COMPLÈTE
 */
export const runAllExamples = async () => {
  console.log('🚀 Démarrage des exemples de generateDocumentHtml()');
  
  try {
    // Test 1: IMMOBILIER avec lead
    console.log('\n📋 Test 1: IMMOBILIER - Devis avec lead');
    await exempleImmobilierDevis();
    
    // Test 2: SMMA sans lead
    console.log('\n🧾 Test 2: SMMA - Facture sans lead');
    await exempleSmmaFacture();
    
    // Test 3: IMMOBILIER mandat
    console.log('\n📄 Test 3: IMMOBILIER - Mandat');
    await exempleImmobilierMandat();
    
    // Test 4: SMMA rapport
    console.log('\n📊 Test 4: SMMA - Rapport');
    await exempleSmmaRapport();
    
    // Test 5: Robustesse
    console.log('\n🛡️ Test 5: Robustesse - Template manquant');
    await exempleTemplateManquant();
    
    // Test 6: Performance
    console.log('\n⚡ Test 6: Performance');
    await exemplePerformanceTest();
    
    console.log('\n✅ Tous les exemples terminés avec succès!');
    
  } catch (error) {
    console.error('\n❌ Erreur dans les exemples:', error);
  }
};

export default {
  exempleImmobilierDevis,
  exempleSmmaFacture,
  exempleImmobilierMandat,
  exempleSmmaRapport,
  exempleTemplateManquant,
  exemplePerformanceTest,
  runAllExamples
};
