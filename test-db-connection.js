// SCRIPT DE TEST POUR VÉRIFIER LA CONNEXION À LA BASE DE DONNÉES
import { supabase } from './src/supabaseClient.js';

async function testDatabaseConnection() {
  console.log('🔍 TEST DE CONNEXION À LA BASE DE DONNÉES');
  console.log('=====================================');

  try {
    // 1. Vérifier si la table documents existe
    console.log('\n📋 1. VÉRIFICATION TABLE DOCUMENTS');
    const { data: tables, error: tablesError } = await supabase
      .from('documents')
      .select('id')
      .limit(1);
    
    if (tablesError) {
      console.error('❌ Erreur table documents:', tablesError);
      return;
    }
    console.log('✅ Table documents accessible');

    // 2. Vérifier les documents existants
    console.log('\n📄 2. VÉRIFICATION DOCUMENTS EXISTANTS');
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .limit(10);
    
    if (docsError) {
      console.error('❌ Erreur lecture documents:', docsError);
      return;
    }
    
    console.log(`✅ ${documents.length} document(s) trouvé(s)`);
    if (documents.length > 0) {
      console.log('📋 Détails des documents:');
      documents.forEach((doc, index) => {
        console.log(`  ${index + 1}. ID: ${doc.id}`);
        console.log(`     Type: ${doc.type}`);
        console.log(`     Lead: ${doc.lead_id}`);
        console.log(`     Agency: ${doc.agency_id}`);
        console.log(`     Status: ${doc.status}`);
        console.log(`     Version: ${doc.version}`);
        console.log(`     Created: ${doc.created_at}`);
        console.log('');
      });
    }

    // 3. Vérifier les permissions RLS
    console.log('\n🔐 3. VÉRIFICATION PERMISSIONS RLS');
    const { data: user } = await supabase.auth.getUser();
    if (user?.user) {
      console.log(`✅ Utilisateur connecté: ${user.user.id}`);
      
      // Vérifier le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', user.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ Erreur profil:', profileError);
      } else {
        console.log(`✅ Agency ID: ${profile.agency_id}`);
        
        // Vérifier les documents de cette agence
        const { data: agencyDocs, error: agencyDocsError } = await supabase
          .from('documents')
          .select('*')
          .eq('agency_id', profile.agency_id);
        
        if (agencyDocsError) {
          console.error('❌ Erreur documents agence:', agencyDocsError);
        } else {
          console.log(`✅ ${agencyDocs.length} document(s) pour cette agence`);
        }
      }
    } else {
      console.log('❌ Aucun utilisateur connecté');
    }

    // 4. Test d'insertion
    console.log('\n➕ 4. TEST D\'INSERTION');
    const testDoc = {
      lead_id: '00000000-0000-0000-0000-000000000000', // UUID de test
      agency_id: '00000000-0000-0000-0000-000000000000', // UUID de test
      type: 'TEST',
      title: 'Document de test',
      content: { test: true },
      metadata: {},
      version: 1,
      status: 'Généré'
    };
    
    const { data: insertedDoc, error: insertError } = await supabase
      .from('documents')
      .insert(testDoc)
      .select();
    
    if (insertError) {
      console.error('❌ Erreur insertion:', insertError);
    } else {
      console.log('✅ Insertion réussie:', insertedDoc[0].id);
      
      // Nettoyer le test
      await supabase
        .from('documents')
        .delete()
        .eq('id', insertedDoc[0].id);
      console.log('✅ Document de test supprimé');
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le test
testDatabaseConnection();
