/**
 * ARCHITECTE SaaS - Exemples d'utilisation de DocumentService
 * 
 * Cas d'usage réels pour tous les générateurs UI
 */

import DocumentService from './documentService';

/**
 * EXEMPLE 1: IMMOBILIER - Devis avec lead
 */
export const exempleImmobilierDevis = async (agencyProfile, lead) => {
  try {
    console.log('🏠 IMMOBILIER - Création devis avec lead');
    
    const result = await DocumentService.createDocument({
      type: 'devis',
      agency_id: agencyProfile.agency_id,
      lead_id: lead.id,
      agencyProfile: agencyProfile,
      leadData: lead,
      customData: {
        bien_type: lead.type_bien || 'appartement',
        surface: lead.surface || 0,
        adresse: lead.adresse || '',
        prix_vente: lead.budget || 0,
        duree_mandat: 3,
        exclusivite: true
      },
      calculations: {
        total_ht: (lead.budget || 0) * 0.05, // 5% d'honoraires
        tva: (lead.budget || 0) * 0.05 * 0.20, // TVA sur honoraires
        total_ttc: (lead.budget || 0) * 0.05 * 1.20 // TTC
      }
    });
    
    if (result.success) {
      console.log('✅ Devis immobilier créé:', result.metadata.reference);
      console.log('  Client:', result.document.client_nom);
      console.log('  Montant:', result.document.total_ttc, result.document.devise);
    } else {
      console.error('❌ Erreur création devis:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur exemple devis immobilier:', error);
    throw error;
  }
};

/**
 * EXEMPLE 2: SMMA - Facture sans lead (partenaire)
 */
export const exempleSmmaFacture = async (agencyProfile, clientData) => {
  try {
    console.log('📱 SMMA - Création facture sans lead');
    
    const result = await DocumentService.createDocument({
      type: 'facture',
      agency_id: agencyProfile.agency_id,
      lead_id: null, // ✅ lead_id optionnel
      agencyProfile: agencyProfile,
      leadData: null, // ✅ leadData optionnel
      customData: {
        client_nom: clientData.nom,
        client_email: clientData.email,
        client_telephone: clientData.telephone,
        services_inclus: 'Community Management, Publicité Facebook/Instagram',
        periode_facturation: 'Octobre 2024',
        budget_mensuel: 1500,
        date_facturation: new Date().toISOString().split('T')[0],
        conditions_paiement: '30 jours',
        mode_paiement: 'Virement bancaire'
      },
      calculations: {
        total_ht: 1500,
        tva: 1500 * 0.20,
        total_ttc: 1500 * 1.20
      }
    });
    
    if (result.success) {
      console.log('✅ Facture SMMA créée:', result.metadata.reference);
      console.log('  Client:', result.document.client_nom);
      console.log('  Période:', result.document.date_facturation);
      console.log('  Échéance:', result.document.date_echeance);
    } else {
      console.error('❌ Erreur création facture:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur exemple facture SMMA:', error);
    throw error;
  }
};

/**
 * EXEMPLE 3: IMMOBILIER - Mandat avec options
 */
export const exempleImmobilierMandat = async (agencyProfile, lead, options = {}) => {
  try {
    console.log('🏠 IMMOBILIER - Création mandat avec options');
    
    const result = await DocumentService.createDocument({
      type: 'mandat',
      agency_id: agencyProfile.agency_id,
      lead_id: lead.id,
      agencyProfile: agencyProfile,
      leadData: lead,
      customData: {
        bien_type: lead.type_bien || 'maison',
        surface: lead.surface || 0,
        adresse: lead.adresse || '',
        prix_vente: lead.budget || 0,
        duree_mandat: options.duree_mandat || 6,
        exclusivite: options.exclusivite !== false,
        commission: options.commission || (lead.budget || 0) * 0.05
      },
      calculations: {
        commission: options.commission || (lead.budget || 0) * 0.05,
        total_ht: options.commission || (lead.budget || 0) * 0.05,
        tva: 0, // Les mandats ne sont généralement pas soumis à TVA
        total_ttc: options.commission || (lead.budget || 0) * 0.05
      },
      options: {
        generateReference: true,
        createAudit: true
      }
    });
    
    if (result.success) {
      console.log('✅ Mandat immobilier créé:', result.metadata.reference);
      console.log('  Type:', result.document.content_json.type_specific_info.exclusivite ? 'Exclusif' : 'Simple');
      console.log('  Durée:', result.document.content_json.type_specific_info.duree_mandat, 'mois');
    } else {
      console.error('❌ Erreur création mandat:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur exemple mandat immobilier:', error);
    throw error;
  }
};

/**
 * EXEMPLE 4: SMMA - Rapport de performance
 */
export const exempleSmmaRapport = async (agencyProfile, rapportData) => {
  try {
    console.log('📱 SMMA - Création rapport performance');
    
    const result = await DocumentService.createDocument({
      type: 'rapport',
      agency_id: agencyProfile.agency_id,
      lead_id: rapportData.lead_id || null,
      agencyProfile: agencyProfile,
      leadData: rapportData.lead || null,
      customData: {
        client_nom: rapportData.client_nom,
        periode_rapport: rapportData.periode || '2024-10',
        services_inclus: 'Instagram Management, Publicité Facebook',
        budget_mensuel: rapportData.budget_mensuel || 2000,
        kpi_principaux: {
          objectif_leads: 100,
          objectif_conversions: 20,
          valeur_conversion: 50
        },
        resultats_obtenus: {
          leads_generes: rapportData.leads_generes || 125,
          conversions: rapportData.conversions || 18,
          taux_engagement: rapportData.taux_engagement || 4.5
        }
      },
      calculations: {
        performance_score: Math.min(((rapportData.leads_generes || 125) / 100) * 100, 100),
        roi_estime: ((rapportData.conversions || 18) * 50) - (rapportData.budget_mensuel || 2000),
        total_ht: 0, // Les rapports ne sont généralement pas facturés
        tva: 0,
        total_ttc: 0
      }
    });
    
    if (result.success) {
      console.log('✅ Rapport SMMA créé:', result.metadata.reference);
      console.log('  Performance:', result.document.content_json.calculations.performance_score.toFixed(1), '%');
      console.log('  ROI:', result.document.content_json.calculations.roi_estime, '€');
    } else {
      console.error('❌ Erreur création rapport:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur exemple rapport SMMA:', error);
    throw error;
  }
};

/**
 * EXEMPLE 5: Conversion Devis → Facture (utilise DocumentService)
 */
export const exempleConversionDevisFacture = async (devis, agencyProfile) => {
  try {
    console.log('🔄 Conversion Devis → Facture via DocumentService');
    
    // Récupérer les données du devis
    const devisData = devis.content_json;
    
    const result = await DocumentService.createDocument({
      type: 'facture',
      agency_id: agencyProfile.agency_id,
      lead_id: devis.lead_id,
      agencyProfile: agencyProfile,
      leadData: null, // On utilise les données du devis
      customData: {
        client_nom: devis.client_nom,
        client_email: devis.client_email,
        client_telephone: devis.client_telephone,
        date_facturation: new Date().toISOString().split('T')[0],
        conditions_paiement: '30 jours',
        mode_paiement: 'Virement bancaire',
        reference_devis: devis.reference,
        conversion_info: {
          devis_id: devis.id,
          devis_reference: devis.reference,
          conversion_date: new Date().toISOString()
        }
      },
      calculations: {
        total_ht: devis.total_ht,
        tva: devis.tva_amount,
        total_ttc: devis.total_ttc
      },
      options: {
        createAudit: true,
        linkToParent: devis.id // Option pour lier au document parent
      }
    });
    
    if (result.success) {
      console.log('✅ Facture créée depuis devis:', result.metadata.reference);
      console.log('  Devis original:', devis.reference);
      console.log('  Montant:', result.document.total_ttc, result.document.devise);
    } else {
      console.error('❌ Erreur conversion:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur exemple conversion:', error);
    throw error;
  }
};

/**
 * EXEMPLE 6: Création en lot (multiple documents)
 */
export const exempleCreationLot = async (agencyProfile, documents) => {
  try {
    console.log(`📦 Création en lot: ${documents.length} documents`);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < documents.length; i++) {
      const docConfig = documents[i];
      
      try {
        console.log(`  Document ${i + 1}/${documents.length}: ${docConfig.type}`);
        
        const result = await DocumentService.createDocument({
          type: docConfig.type,
          agency_id: agencyProfile.agency_id,
          lead_id: docConfig.lead_id || null,
          agencyProfile: agencyProfile,
          leadData: docConfig.leadData || null,
          customData: docConfig.customData || {},
          calculations: docConfig.calculations || {}
        });
        
        if (result.success) {
          results.push(result);
          console.log(`    ✅ ${result.metadata.reference}`);
        } else {
          errors.push({ index: i, error: result.error });
          console.log(`    ❌ ${result.error}`);
        }
        
      } catch (error) {
        errors.push({ index: i, error: error.message });
        console.log(`    ❌ ${error.message}`);
      }
    }
    
    console.log(`📊 Résultats lot:`);
    console.log(`  Succès: ${results.length}/${documents.length}`);
    console.log(`  Erreurs: ${errors.length}/${documents.length}`);
    
    return {
      success: results.length > 0,
      results,
      errors,
      total: documents.length
    };
    
  } catch (error) {
    console.error('❌ Erreur création lot:', error);
    throw error;
  }
};

/**
 * EXEMPLE 7: Recherche et gestion de documents
 */
export const exempleGestionDocuments = async (agencyId) => {
  try {
    console.log('🔍 Gestion des documents');
    
    // 1. Liste de tous les documents
    const allDocuments = await DocumentService.getDocumentsByAgency(agencyId);
    console.log(`📋 Total documents: ${allDocuments.length}`);
    
    // 2. Filtre par type
    const devisList = await DocumentService.getDocumentsByAgency(agencyId, {
      type: 'devis',
      limit: 10
    });
    console.log(`📄 Devis: ${devisList.length}`);
    
    // 3. Recherche
    const searchResults = await DocumentService.searchDocuments(agencyId, 'Martin');
    console.log(`🔍 Résultats recherche 'Martin': ${searchResults.length}`);
    
    // 4. Récupération d'un document spécifique
    if (allDocuments.length > 0) {
      const firstDoc = await DocumentService.getDocument(allDocuments[0].id);
      console.log(`📄 Document récupéré: ${firstDoc.reference}`);
      
      // 5. Mise à jour
      const updatedDoc = await DocumentService.updateDocument(firstDoc.id, {
        statut: 'validé'
      });
      console.log(`✅ Document mis à jour: ${updatedDoc.statut}`);
    }
    
    return {
      total: allDocuments.length,
      devis: devisList.length,
      search: searchResults.length
    };
    
  } catch (error) {
    console.error('❌ Erreur gestion documents:', error);
    throw error;
  }
};

/**
 * EXEMPLE 8: Validation et gestion d'erreurs
 */
export const exempleValidationErreurs = async () => {
  try {
    console.log('🧪 Test validation et erreurs');
    
    const agencyProfile = {
      agency_id: 'test-agency',
      type_agence: 'immobilier',
      nom_agence: 'Test Agency'
    };
    
    // Test 1: Paramètres manquants
    try {
      await DocumentService.createDocument({
        type: 'devis'
        // agency_id manquant
      });
    } catch (error) {
      console.log('✅ Erreur capturée (agency_id manquant):', error.message);
    }
    
    // Test 2: Type invalide
    try {
      await DocumentService.createDocument({
        type: 'document_inexistant',
        agency_id: 'test',
        agencyProfile: agencyProfile
      });
    } catch (error) {
      console.log('✅ Erreur capturée (type invalide):', error.message);
    }
    
    // Test 3: Profil agence invalide
    try {
      await DocumentService.createDocument({
        type: 'devis',
        agency_id: 'test',
        agencyProfile: {} // type_agence manquant
      });
    } catch (error) {
      console.log('✅ Erreur capturée (profil invalide):', error.message);
    }
    
    console.log('✅ Tests de validation terminés');
    
  } catch (error) {
    console.error('❌ Erreur tests validation:', error);
    throw error;
  }
};

/**
 * FONCTION DE TEST COMPLÈTE
 */
export const runAllDocumentServiceExamples = async () => {
  console.log('🚀 Démarrage des exemples DocumentService');
  
  // Données de test
  const agencyProfile = {
    agency_id: 'test-agency-123',
    type_agence: 'immobilier',
    nom_agence: 'Test Immobilière',
    adresse_legale: '123 Rue Test, 75000 Paris',
    telephone: '01 23 45 67 89',
    email: 'contact@test.fr',
    devise: 'EUR'
  };
  
  const lead = {
    id: 'lead-123',
    nom: 'Martin Dupont',
    email: 'martin.dupont@email.com',
    telephone: '06 12 34 56 78',
    type_bien: 'appartement',
    surface: 85,
    budget: 450000,
    adresse: '45 Rue de la Paix, 75002 Paris'
  };
  
  try {
    // Test 1: Devis immobilier
    console.log('\n📋 Test 1: Devis immobilier avec lead');
    await exempleImmobilierDevis(agencyProfile, lead);
    
    // Test 2: Facture SMMA sans lead
    console.log('\n📋 Test 2: Facture SMMA sans lead');
    await exempleSmmaFacture(agencyProfile, {
      nom: 'SARL TechInnov',
      email: 'contact@techinnov.fr',
      telephone: '04 72 89 01 23'
    });
    
    // Test 3: Mandat immobilier
    console.log('\n📋 Test 3: Mandat immobilier');
    await exempleImmobilierMandat(agencyProfile, lead, {
      duree_mandat: 6,
      exclusivite: true
    });
    
    // Test 4: Rapport SMMA
    console.log('\n📋 Test 4: Rapport SMMA');
    await exempleSmmaRapport(agencyProfile, {
      client_nom: 'Restaurant Le Gourmet',
      periode: '2024-10',
      budget_mensuel: 2000,
      leads_generes: 125,
      conversions: 18
    });
    
    // Test 5: Validation erreurs
    console.log('\n📋 Test 5: Validation et gestion d\'erreurs');
    await exempleValidationErreurs();
    
    console.log('\n✅ Tous les exemples DocumentService terminés avec succès!');
    
  } catch (error) {
    console.error('\n❌ Erreur dans les exemples:', error);
  }
};

export default {
  exempleImmobilierDevis,
  exempleSmmaFacture,
  exempleImmobilierMandat,
  exempleSmmaRapport,
  exempleConversionDevisFacture,
  exempleCreationLot,
  exempleGestionDocuments,
  exempleValidationErreurs,
  runAllDocumentServiceExamples
};
