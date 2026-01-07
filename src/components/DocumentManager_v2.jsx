import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function DocumentManager({ lead, agencyId }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Vérification de sécurité
  if (!lead || !lead.id) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">⚠️ Lead non sélectionné</p>
      </div>
    );
  }

  const generateDocument = async (type) => {
    setLoading(true);
    setMessage('');
    
    try {
      // Vérification si la table documents existe
      const { error: tableError } = await supabase
        .from('documents')
        .select('id')
        .limit(1);
      
      if (tableError) {
        setMessage('📋 Table documents non disponible. Contactez l\'administrateur.');
        return;
      }

      // Création du document en base
      const { data, error } = await supabase
        .from('documents')
        .insert([{
          lead_id: lead.id,
          agency_id: agencyId || 'default',
          type_document: type,
          statut: 'généré',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setMessage(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} généré avec succès`);
      console.log('Document créé:', data);
      
    } catch (error) {
      console.error('Erreur génération document:', error);
      setMessage('❌ Erreur lors de la génération. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t pt-6">
      <h3 className="font-bold text-lg mb-4">📄 Gestion des documents</h3>
      
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => generateDocument('devis')}
          disabled={loading}
          className="flex flex-col items-center p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
        >
          <span className="text-xl">💰</span>
          <span className="font-bold text-xs mt-1">Générer devis</span>
        </button>
        
        <button
          onClick={() => generateDocument('facture')}
          disabled={loading}
          className="flex flex-col items-center p-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200 disabled:opacity-50"
        >
          <span className="text-xl">🧾</span>
          <span className="font-bold text-xs mt-1">Générer facture</span>
        </button>
        
        <button
          onClick={() => generateDocument('mandat')}
          disabled={loading}
          className="flex flex-col items-center p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 border border-purple-200 disabled:opacity-50"
        >
          <span className="text-xl">📋</span>
          <span className="font-bold text-xs mt-1">Générer mandat</span>
        </button>
      </div>

      {loading && (
        <div className="mt-4 text-center text-sm text-slate-600">
          Génération en cours...
        </div>
      )}
    </div>
  );
}
