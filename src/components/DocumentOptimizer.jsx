import React, { useState } from 'react';
import DocumentOptimizationService from '../services/documentOptimizationService';

export default function DocumentOptimizer({ document, lead, onOptimized }) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleOptimize = async () => {
    setOptimizing(true);
    
    try {
      const optimizedDoc = await DocumentOptimizationService.optimizeDocument(
        document.id, 
        lead
      );
      
      if (optimizedDoc) {
        setOptimization(optimizedDoc);
        if (onOptimized) {
          onOptimized(optimizedDoc);
        }
      }
    } catch (error) {
      console.error('Erreur optimisation:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon';
    if (score >= 40) return 'Moyen';
    return 'À améliorer';
  };

  const isAlreadyOptimized = document.metadata?.ai_optimized;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-slate-800">🤖 Optimisation IA</h4>
          {isAlreadyOptimized && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              Déjà optimisé
            </span>
          )}
        </div>
        
        {!isAlreadyOptimized && (
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
          >
            {optimizing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Optimisation...
              </>
            ) : (
              <>
                🚀 Optimiser
              </>
            )}
          </button>
        )}
      </div>

      {/* Score actuel */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Score de qualité actuel</span>
          {document.metadata?.optimization_score && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(document.metadata.optimization_score)}`}>
              {document.metadata.optimization_score}% - {getScoreLabel(document.metadata.optimization_score)}
            </span>
          )}
        </div>
        
        {!document.metadata?.optimization_score && (
          <div className="text-sm text-slate-500">
            Ce document n'a pas encore été analysé par l'IA
          </div>
        )}
      </div>

      {/* Résultats d'optimisation */}
      {optimization && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-800 mb-2">✨ Optimisation réussie !</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Score avant:</span>
                <span className="font-medium ml-2">
                  {document.metadata?.optimization_score || 'N/A'}%
                </span>
              </div>
              <div>
                <span className="text-blue-600">Score après:</span>
                <span className="font-medium ml-2">
                  {optimization.metadata?.optimization_score}%
                </span>
              </div>
            </div>
          </div>

          {/* Suggestions d'amélioration */}
          {optimization.metadata?.ai_analysis?.suggestions?.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h5 className="font-medium text-yellow-800 mb-2">💡 Suggestions d'amélioration</h5>
              <ul className="space-y-2 text-sm">
                {optimization.metadata.ai_analysis.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-0.5">•</span>
                    <span className="text-slate-700">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bouton pour voir les détails */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2"
          >
            {showDetails ? 'Masquer' : 'Voir'} les détails d'analyse
            <span>{showDetails ? '▲' : '▼'}</span>
          </button>

          {/* Détails complets */}
          {showDetails && optimization.metadata?.ai_analysis && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
              <h5 className="font-medium text-slate-800 mb-3">📊 Analyse détaillée</h5>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-slate-600">Complétude:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${optimization.metadata.ai_analysis.completeness}%` }}
                      ></div>
                    </div>
                    <span className="font-medium">
                      {optimization.metadata.ai_analysis.completeness}%
                    </span>
                  </div>
                </div>
                
                <div>
                  <span className="text-slate-600">Professionnalisme:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${optimization.metadata.ai_analysis.professionalism}%` }}
                      ></div>
                    </div>
                    <span className="font-medium">
                      {optimization.metadata.ai_analysis.professionalism}%
                    </span>
                  </div>
                </div>
              </div>

              {optimization.metadata.ai_analysis.improvements?.length > 0 && (
                <div>
                  <h6 className="font-medium text-slate-700 mb-2">🔧 Améliorations appliquées:</h6>
                  <ul className="space-y-1">
                    {optimization.metadata.ai_analysis.improvements.map((improvement, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span className="text-slate-600">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
