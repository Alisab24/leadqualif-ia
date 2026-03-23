import React from 'react';
import { useTranslation } from 'react-i18next';

export default function StatusSuggestionModal({ 
  isOpen, 
  onClose, 
  documentType, 
  leadName, 
  onConfirm, 
  onCancel 
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  // Mapping des suggestions selon le type de document
  const getSuggestions = (docType) => {
    switch (docType) {
      case 'devis':
        return {
          current: 'À traiter',
          suggested: 'Offre en cours',
          message: 'Devis généré',
          explanation: 'Le devis a été créé, souhaitez-vous passer le lead en "Offre en cours" ?'
        };
      case 'contrat':
        return {
          current: 'Offre en cours',
          suggested: 'Négociation',
          message: 'Contrat généré',
          explanation: 'Le contrat est prêt, souhaitez-vous passer le lead en "Négociation" ?'
        };
      case 'mandat':
        return {
          current: 'Négociation',
          suggested: 'Gagné',
          message: 'Mandat signé',
          explanation: 'Le mandat est signé, souhaitez-vous marquer le lead comme "Gagné" ?'
        };
      default:
        return {
          current: null,
          suggested: null,
          message: 'Document généré',
          explanation: 'Document créé avec succès'
        };
    }
  };

  const suggestion = getSuggestions(documentType);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white">
              {documentType === 'devis' && '💰'}
              {documentType === 'contrat' && '📋'}
              {documentType === 'mandat' && '✍️'}
              {documentType === 'facture' && '🧾'}
              {!['devis', 'contrat', 'mandat', 'facture'].includes(documentType) && '📄'}
            </span>
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            {suggestion.message}
          </h3>
          
          <p className="text-slate-600 mb-6">
            Pour le lead : <span className="font-semibold">{leadName}</span>
          </p>
          
          {suggestion.suggested && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
              <p className="text-sm text-blue-800 mb-3">
                {suggestion.explanation}
              </p>
              
              <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
                <div className="text-left">
                  <div className="text-xs text-slate-500 mb-1">Statut actuel</div>
                  <div className="font-semibold text-slate-700">{suggestion.current}</div>
                </div>
                
                <div className="text-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5-5m5 5H6" />
                  </svg>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-slate-500 mb-1">Suggéré</div>
                  <div className="font-semibold text-green-600">{suggestion.suggested}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {suggestion.suggested ? (
            <>
              <button
                onClick={() => onConfirm(suggestion.suggested)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
              >
                {t('statusModal.confirmBtn')}
              </button>
              
              <button
                onClick={onCancel}
                className="flex-1 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all border border-slate-200"
              >
                {t('statusModal.cancelBtn')}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
