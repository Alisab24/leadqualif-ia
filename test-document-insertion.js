// SCRIPT DE TEST D'INSERTION DE DOCUMENT
// À exécuter dans la console du navigateur après connexion

import { supabase } from './src/supabaseClient.js';

async function testDocumentInsertion() {
  console.log('🧪 TEST D\'INSERTION DE DOCUMENT');
  console.log('================================');

  try {
    // 1. Récupérer l'utilisateur connecté
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Utilisateur non connecté:', userError);
      return;
    }
    console.log('✅ Utilisateur connecté:', user.id);

    // 2. Récupérer le profil et agency_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile?.agency_id) {
      console.error('❌ Profil/Agency non trouvé:', profileError);
      return;
    }
    console.log('✅ Agency ID:', profile.agency_id);

    // 3. Récupérer un lead existant pour le test
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, nom, email')
      .eq('agency_id', profile.agency_id)
      .limit(1);
    
    if (leadsError || !leads || leads.length === 0) {
      console.error('❌ Aucun lead trouvé:', leadsError);
      return;
    }
    const testLead = leads[0];
    console.log('✅ Lead de test:', testLead.nom);

    // 4. Créer un document de test
    const testDocument = {
      lead_id: testLead.id,
      agency_id: profile.agency_id,
      type: 'TEST_INSERTION',
      title: `Document de test - ${testLead.nom}`,
      content: {
        template: 'TEST_INSERTION',
        category: 'TEST',
        generatedAt: new Date().toISOString(),
        testData: true
      },
      metadata: {
        clientName: testLead.nom,
        clientEmail: testLead.email,
        test: true,
        timestamp: new Date().toISOString()
      },
      version: 1,
      status: 'Généré',
      created_by: user.id,
      updated_by: user.id
    };

    console.log('📝 Insertion du document de test...');
    const { data: insertedDoc, error: insertError } = await supabase
      .from('documents')
      .insert(testDocument)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur insertion:', insertError);
      console.error('Détails:', insertError.details);
      console.error('Hint:', insertError.hint);
      return;
    }

    console.log('✅ Document inséré avec succès!');
    console.log('ID:', insertedDoc.id);
    console.log('Type:', insertedDoc.type);
    console.log('Status:', insertedDoc.status);
    console.log('Created:', insertedDoc.created_at);

    // 5. Vérifier que le document est bien là
    const { data: verifyDoc, error: verifyError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', insertedDoc.id)
      .single();

    if (verifyError) {
      console.error('❌ Erreur vérification:', verifyError);
    } else {
      console.log('✅ Document vérifié dans la base');
    }

    // 6. Créer l'événement CRM associé
    const crmEvent = {
      lead_id: testLead.id,
      agency_id: profile.agency_id,
      type: 'document_generated',
      title: `Document généré: ${testDocument.type}`,
      description: `Document "${testDocument.title}" généré automatiquement`,
      metadata: {
        document_id: insertedDoc.id,
        document_type: testDocument.type,
        document_version: testDocument.version,
        document_status: testDocument.status
      },
      created_by: user.id
    };

    console.log('📋 Création événement CRM...');
    const { data: insertedEvent, error: eventError } = await supabase
      .from('crm_events')
      .insert(crmEvent)
      .select()
      .single();

    if (eventError) {
      console.error('❌ Erreur événement CRM:', eventError);
    } else {
      console.log('✅ Événement CRM créé:', insertedEvent.id);
    }

    // 7. Nettoyage optionnel (commenter pour garder les données de test)
    console.log('🧹 Nettoyage...');
    await supabase.from('documents').delete().eq('id', insertedDoc.id);
    await supabase.from('crm_events').delete().eq('id', insertedEvent.id);
    console.log('✅ Données de test supprimées');

    console.log('🎉 Test terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour vérifier l'état actuel
async function checkCurrentState() {
  console.log('📊 ÉTAT ACTUEL');
  console.log('================');

  try {
    // Vérifier les tables
    const { data: tables } = await supabase
      .from('documents')
      .select('id')
      .limit(1);
    
    console.log('✅ Table documents accessible');

    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📄 ${count} documents dans la base`);

    const { count: eventCount } = await supabase
      .from('crm_events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📋 ${eventCount} événements CRM dans la base`);

  } catch (error) {
    console.error('❌ Erreur vérification:', error);
  }
}

// Exporter les fonctions pour utilisation dans la console
window.testDocumentInsertion = testDocumentInsertion;
window.checkCurrentState = checkCurrentState;

console.log('🚀 Fonctions de test disponibles:');
console.log('- testDocumentInsertion() : Test complet d\'insertion');
console.log('- checkCurrentState() : Vérifier l\'état actuel');
