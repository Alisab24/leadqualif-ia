/**
 * INGÉNIEUR SaaS - Exemples d'utilisation de convertDevisToFacture()
 * 
 * Cas d'usage réels avec logique Stripe-like
 */

import DevisToFactureService from './devisToFactureService';

/**
 * EXEMPLE 1: Conversion simple
 */
export const exempleConversionSimple = async (devisId) => {
  try {
    console.log('🔄 Conversion simple devis→facture');
    
    const result = await DevisToFactureService.convertDevisToFacture(devisId, {
      dateFacturation: new Date(),
      notes: 'Conversion automatique depuis devis validé'
    });
    
    if (result.success) {
      console.log('✅ Conversion réussie:');
      console.log(`  Devis: ${result.metadata.devisReference}`);
      console.log(`  Facture: ${result.metadata.factureReference}`);
      console.log(`  Montant: ${result.metadata.montantTTC} ${result.metadata.devise}`);
    } else {
      console.error('❌ Échec conversion:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur exemple conversion:', error);
    throw error;
  }
};

/**
 * EXEMPLE 2: Conversion avec options avancées
 */
export const exempleConversionAvancee = async (devisId) => {
  try {
    console.log('🔄 Conversion avancée devis→facture');
    
    // Date de facturation personnalisée
    const dateFacturation = new Date();
    dateFacturation.setDate(dateFacturation.getDate() + 7); // Facture dans 7 jours
    
    const result = await DevisToFactureService.convertDevisToFacture(devisId, {
      dateFacturation: dateFacturation,
      notes: 'Facturation avec conditions spéciales - Paiement 45 jours',
      customData: {
        conditions_paiement: '45 jours',
        mode_paiement: 'Chèque bancaire',
        penalites_retard: '3% par mois de retard',
        references_contrat: 'Contrat de prestations n°CONT-2024-001'
      }
    });
    
    if (result.success) {
      console.log('✅ Conversion avancée réussie:');
      console.log(`  Date facturation: ${dateFacturation.toLocaleDateString('fr-FR')}`);
      console.log(`  Échéance: ${result.facture.date_echeance}`);
      console.log(`  Conditions: ${result.facture.conditions_paiement}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur conversion avancée:', error);
    throw error;
  }
};

/**
 * EXEMPLE 3: Vérification d'intégrité post-conversion
 */
export const exempleVerificationIntegrite = async (devisId, factureId) => {
  try {
    console.log('🔍 Vérification intégrité conversion');
    
    const integrity = await DevisToFactureService.verifyConversionIntegrity(devisId, factureId);
    
    console.log('📊 Résultats vérification:');
    console.log(`  Validité: ${integrity.valid ? '✅' : '❌'}`);
    
    if (!integrity.valid) {
      console.log('  Erreurs:');
      integrity.errors.forEach(error => console.log(`    - ${error}`));
    }
    
    console.log('  Checks:');
    Object.entries(integrity.checks).forEach(([check, result]) => {
      console.log(`    ${check}: ${result ? '✅' : '❌'}`);
    });
    
    return integrity;
    
  } catch (error) {
    console.error('❌ Erreur vérification:', error);
    throw error;
  }
};

/**
 * EXEMPLE 4: Historique des conversions
 */
export const exempleHistoriqueConversions = async (devisId) => {
  try {
    console.log('📋 Historique des conversions');
    
    const history = await DevisToFactureService.getConversionHistory(devisId);
    
    console.log(`📊 ${history.length} conversion(s) trouvée(s):`);
    
    history.forEach((facture, index) => {
      console.log(`  ${index + 1}. ${facture.reference}`);
      console.log(`     Date: ${new Date(facture.created_at).toLocaleDateString('fr-FR')}`);
      console.log(`     Montant: ${facture.total_ttc} ${facture.devise}`);
      console.log(`     Statut: ${facture.statut}`);
    });
    
    return history;
    
  } catch (error) {
    console.error('❌ Erreur historique:', error);
    return [];
  }
};

/**
 * EXEMPLE 5: Statistiques de conversion
 */
export const exempleStatsConversions = async (agencyId) => {
  try {
    console.log('📈 Statistiques de conversion');
    
    // Dernier mois
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    const stats = await DevisToFactureService.getConversionStats(agencyId, startDate, endDate);
    
    console.log('📊 Statistiques du dernier mois:');
    console.log(`  Total conversions: ${stats.total_conversions}`);
    console.log(`  Montant total HT: ${stats.total_montant_ht.toLocaleString('fr-FR')} €`);
    console.log(`  Montant total TTC: ${stats.total_montant_ttc.toLocaleString('fr-FR')} €`);
    console.log(`  Montant moyen: ${Math.round(stats.average_montant).toLocaleString('fr-FR')} €`);
    
    console.log('  Conversions par mois:');
    stats.conversions_by_month.forEach(month => {
      console.log(`    ${month.month}: ${month.count} factures (${month.total_ttc.toLocaleString('fr-FR')} €)`);
    });
    
    console.log('  Conversions récentes:');
    stats.recent_conversions.slice(0, 5).forEach(conv => {
      console.log(`    ${conv.reference} - ${conv.total_ttc} € (${new Date(conv.created_at).toLocaleDateString('fr-FR')})`);
    });
    
    return stats;
    
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    return null;
  }
};

/**
 * EXEMPLE 6: Workflow complet avec validation
 */
export const exempleWorkflowComplet = async (devisId) => {
  try {
    console.log('🔄 Workflow complet conversion');
    
    // Étape 1: Conversion
    console.log('Étape 1: Conversion...');
    const conversion = await DevisToFactureService.convertDevisToFacture(devisId, {
      notes: 'Conversion workflow complet - Étape 1'
    });
    
    if (!conversion.success) {
      throw new Error(`Échec conversion: ${conversion.error}`);
    }
    
    // Étape 2: Vérification
    console.log('Étape 2: Vérification...');
    const integrity = await DevisToFactureService.verifyConversionIntegrity(
      devisId, 
      conversion.facture.id
    );
    
    if (!integrity.valid) {
      console.warn('⚠️ Problème d\'intégrité détecté');
      integrity.errors.forEach(error => console.warn(`  - ${error}`));
    }
    
    // Étape 3: Historique
    console.log('Étape 3: Historique...');
    const history = await DevisToFactureService.getConversionHistory(devisId);
    
    // Étape 4: Résultat
    console.log('✅ Workflow terminé:');
    console.log(`  Devis: ${conversion.metadata.devisReference}`);
    console.log(`  Facture: ${conversion.metadata.factureReference}`);
    console.log(`  Intégrité: ${integrity.valid ? '✅' : '❌'}`);
    console.log(`  Historique: ${history.length} conversion(s)`);
    
    return {
      conversion,
      integrity,
      history,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Erreur workflow complet:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * EXEMPLE 7: Gestion d'erreurs et rollback
 */
export const exempleGestionErreurs = async (devisId) => {
  try {
    console.log('🧪 Test gestion d\'erreurs');
    
    // Tentative de conversion avec un devis inexistant
    const fakeDevisId = '00000000-0000-0000-0000-000000000000';
    
    const result = await DevisToFactureService.convertDevisToFacture(fakeDevisId);
    
    if (!result.success) {
      console.log('✅ Erreur gérée correctement:');
      console.log(`  Message: ${result.error}`);
      console.log(`  Transaction ID: ${result.transactionId}`);
      
      // Le rollback automatique a été effectué
      console.log('  Rollback automatique effectué');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur non gérée:', error);
    throw error;
  }
};

/**
 * EXEMPLE 8: Conversion en lot (multiple devis)
 */
export const exempleConversionLot = async (devisIds) => {
  try {
    console.log(`🔄 Conversion en lot: ${devisIds.length} devis`);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < devisIds.length; i++) {
      const devisId = devisIds[i];
      
      try {
        console.log(`  Conversion ${i + 1}/${devisIds.length}: ${devisId}`);
        
        const result = await DevisToFactureService.convertDevisToFacture(devisId);
        
        if (result.success) {
          results.push(result);
          console.log(`    ✅ ${result.metadata.factureReference}`);
        } else {
          errors.push({ devisId, error: result.error });
          console.log(`    ❌ ${result.error}`);
        }
        
      } catch (error) {
        errors.push({ devisId, error: error.message });
        console.log(`    ❌ ${error.message}`);
      }
    }
    
    console.log(`📊 Résultats lot:`);
    console.log(`  Succès: ${results.length}/${devisIds.length}`);
    console.log(`  Erreurs: ${errors.length}/${devisIds.length}`);
    
    return {
      success: results.length > 0,
      results,
      errors,
      total: devisIds.length
    };
    
  } catch (error) {
    console.error('❌ Erreur conversion lot:', error);
    throw error;
  }
};

/**
 * FONCTION DE TEST COMPLÈTE
 */
export const runAllConversionExamples = async () => {
  console.log('🚀 Démarrage des exemples de conversion devis→facture');
  
  // Note: Ces exemples nécessitent des IDs de devis réels
  const testDevisId = 'test-devis-id'; // À remplacer avec un ID réel
  
  try {
    // Test 1: Conversion simple
    console.log('\n📋 Test 1: Conversion simple');
    // await exempleConversionSimple(testDevisId);
    console.log('⚠️ Test 1: Nécessite un ID de devis réel');
    
    // Test 2: Conversion avancée
    console.log('\n📋 Test 2: Conversion avancée');
    // await exempleConversionAvancee(testDevisId);
    console.log('⚠️ Test 2: Nécessite un ID de devis réel');
    
    // Test 3: Vérification intégrité
    console.log('\n📋 Test 3: Vérification intégrité');
    // await exempleVerificationIntegrite(testDevisId, 'test-facture-id');
    console.log('⚠️ Test 3: Nécessite des IDs réels');
    
    // Test 4: Historique
    console.log('\n📋 Test 4: Historique conversions');
    // await exempleHistoriqueConversions(testDevisId);
    console.log('⚠️ Test 4: Nécessite un ID de devis réel');
    
    // Test 5: Stats
    console.log('\n📋 Test 5: Statistiques');
    // await exempleStatsConversions('test-agency-id');
    console.log('⚠️ Test 5: Nécessite un ID d\'agence réel');
    
    // Test 6: Gestion erreurs
    console.log('\n📋 Test 6: Gestion erreurs');
    await exempleGestionErreurs();
    
    console.log('\n✅ Tests terminés (certains nécessitent des IDs réels)');
    
  } catch (error) {
    console.error('\n❌ Erreur dans les exemples:', error);
  }
};

export default {
  exempleConversionSimple,
  exempleConversionAvancee,
  exempleVerificationIntegrite,
  exempleHistoriqueConversions,
  exempleStatsConversions,
  exempleWorkflowComplet,
  exempleGestionErreurs,
  exempleConversionLot,
  runAllConversionExamples
};
