import React from 'react';

export default function StatusSuggestionModal({ 
  isOpen, 
  onClose, 
  documentType, 
  leadName, 
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null;

  const getSuggestedStatus = (docType) => {
    switch (docType) {
      case 'devis': return 'Négociation';
      case 'mandat': return 'Gagné';
      case 'facture': return 'Gagné';
      case 'contrat': return 'Gagné';
      default: return null;
    }
  };

  const suggestedStatus = getSuggestedStatus(documentType);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">🎯 Suggestion de statut</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            Document généré : <span className="font-semibold">{documentType}</span>
          </p>
          <p className="text-gray-700 mb-4">
            Lead : <span className="font-semibold">{leadName}</span>
          </p>
          
          {suggestedStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium mb-2">
                💡 Suggestion automatique
              </p>
              <p className="text-blue-700">
                Mettre le statut du lead à <span className="font-bold">"{suggestedStatus}"</span> ?
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(suggestedStatus)}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            ✅ Appliquer la suggestion
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
          >
            ❌ Non, garder le statut actuel
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          ⚠️ Vous pouvez toujours modifier le statut manuellement plus tard
        </p>
      </div>
    </div>
  );
}
