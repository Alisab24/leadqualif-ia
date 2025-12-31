// Test de connexion Supabase
import { leadsService } from '../src/lib/supabase.js';

async function testSupabaseConnection() {
  console.log('Test de connexion à Supabase...');
  
  try {
    // Test de lecture des leads
    const result = await leadsService.getAllLeads();
    
    if (result.success) {
      console.log('✅ Connexion Supabase réussie');
      console.log(`📊 ${result.data.length} leads trouvés`);
      
      // Afficher les 3 premiers leads
      if (result.data.length > 0) {
        console.log('🔍 Derniers leads :');
        result.data.slice(0, 3).forEach((lead, index) => {
          console.log(`${index + 1}. ${lead.nom} - Score: ${lead.score_qualification}/10`);
        });
      }
    } else {
      console.error('❌ Erreur de connexion:', result.error);
    }
  } catch (error) {
    console.error('❌ Erreur critique:', error.message);
  }
}

// Exécuter le test
testSupabaseConnection();
