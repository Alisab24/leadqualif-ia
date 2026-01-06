import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DatabaseDebug() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { 
      time: new Date().toLocaleTimeString(), 
      message, 
      type,
      id: Date.now() 
    }]);
  };

  const testConnection = async () => {
    setLoading(true);
    setLogs([]);
    
    try {
      addLog('🔍 Début du test de connexion...', 'info');
      
      // 1. Vérifier l'utilisateur connecté
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        addLog(`❌ Erreur utilisateur: ${userError.message}`, 'error');
        return;
      }
      addLog(`✅ Utilisateur: ${user?.id || 'Non connecté'}`, 'success');
      
      if (!user) {
        addLog('❌ Aucun utilisateur connecté', 'error');
        return;
      }

      // 2. Vérifier le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError) {
        addLog(`❌ Erreur profil: ${profileError.message}`, 'error');
        return;
      }
      addLog(`✅ Agency ID: ${profile.agency_id}`, 'success');

      // 3. Vérifier si la table documents existe
      addLog('📋 Test table documents...', 'info');
      const { data: testTable, error: tableError } = await supabase
        .from('documents')
        .select('id')
        .limit(1);
      
      if (tableError) {
        addLog(`❌ Erreur table documents: ${tableError.message}`, 'error');
        return;
      }
      addLog('✅ Table documents accessible', 'success');

      // 4. Compter tous les documents
      const { count, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        addLog(`❌ Erreur comptage: ${countError.message}`, 'error');
        return;
      }
      addLog(`📄 Total documents: ${count}`, 'info');

      // 5. Documents de cette agence
      const { data: agencyDocs, error: agencyDocsError } = await supabase
        .from('documents')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .limit(5);
      
      if (agencyDocsError) {
        addLog(`❌ Erreur documents agence: ${agencyDocsError.message}`, 'error');
        return;
      }
      
      addLog(`📂 Documents de cette agence: ${agencyDocs.length}`, 'info');
      if (agencyDocs.length > 0) {
        agencyDocs.forEach((doc, index) => {
          addLog(`  ${index + 1}. ${doc.type} - ${doc.status} (v${doc.version})`, 'success');
        });
      }

      // 6. Test d'insertion
      addLog('➕ Test d\'insertion...', 'info');
      const testDoc = {
        lead_id: user.id, // Utiliser l'ID utilisateur comme lead de test
        agency_id: profile.agency_id,
        type: 'TEST_DEBUG',
        title: 'Document de test debug',
        content: { test: true, timestamp: new Date().toISOString() },
        metadata: { debug: true },
        version: 1,
        status: 'Généré',
        created_by: user.id,
        updated_by: user.id
      };
      
      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert(testDoc)
        .select();
      
      if (insertError) {
        addLog(`❌ Erreur insertion: ${insertError.message}`, 'error');
      } else {
        addLog(`✅ Insertion réussie: ${insertedDoc[0].id}`, 'success');
        
        // Nettoyer
        await supabase
          .from('documents')
          .delete()
          .eq('id', insertedDoc[0].id);
        addLog('🗑️ Document de test supprimé', 'info');
      }

      addLog('🎉 Test terminé avec succès!', 'success');

    } catch (error) {
      addLog(`❌ Erreur générale: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-96 max-h-96">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">🔍 Debug Base de Données</h3>
          <div className="flex gap-2">
            <button
              onClick={clearLogs}
              className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
            >
              Clear
            </button>
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Test...' : 'Tester'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4 overflow-y-auto max-h-80">
        {logs.length === 0 ? (
          <p className="text-slate-500 text-sm">Cliquez sur "Tester" pour vérifier la connexion</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div 
                key={log.id} 
                className={`text-xs p-2 rounded ${
                  log.type === 'error' ? 'bg-red-50 text-red-700' :
                  log.type === 'success' ? 'bg-green-50 text-green-700' :
                  'bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-mono text-slate-500">[{log.time}]</span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
