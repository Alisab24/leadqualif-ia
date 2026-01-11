/**
 * ARCHITECTURE SaaS - Composant de Génération de Documents
 * Interface unifiée pour tous les types d'agences
 */

import React, { useState, useEffect } from 'react';
import DocumentGenerationService from '../services/documentGenerationService';

const UnifiedDocumentGenerator = ({ 
  lead, 
  agencyProfile, 
  onDocumentGenerated,
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState('');
  const [documentData, setDocumentData] = useState({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [errors, setErrors] = useState([]);

  // Récupération des types de documents disponibles
  useEffect(() => {
    if (agencyProfile?.type_agence) {
      const types = DocumentGenerationService.getAvailableDocumentTypes(agencyProfile.type_agence);
      setAvailableTypes(types);
    }
  }, [agencyProfile]);

  // Gestion du changement de type de document
  const handleDocumentTypeChange = (type) => {
    setSelectedDocumentType(type);
    setDocumentData(getDefaultDataForType(type));
    setShowPreview(false);
    setErrors([]);
  };

  // Données par défaut selon le type
  const getDefaultDataForType = (documentType) => {
    const baseData = {
      lead_id: lead.id,
      client_nom: lead.nom,
      client_email: lead.email,
      client_telephone: lead.telephone,
      date_generation: new Date().toISOString().split('T')[0]
    };

    // Ajout des données spécifiques selon le type d'agence
    if (agencyProfile?.type_agence === 'immobilier') {
      return {
        ...baseData,
        bien_type: lead.type_bien || 'appartement',
        surface: lead.surface || 0,
        adresse: lead.adresse || lead.adresse_complete || '',
        prix_vente: lead.budget || 0,
        duree_mandat: 3,
        exclusivite: true
      };
    } else if (agencyProfile?.type_agence === 'smma') {
      return {
        ...baseData,
        services_inclus: 'Community Management, Publicité, Reporting',
        budget_mensuel: lead.budget ? lead.budget * 0.05 : 500,
        duree_contrat: 6,
        periode_facturation: 'mensuel',
        kpi_principaux: {
          objectif_leads: 50,
          objectif_conversions: 5,
          valeur_conversion: 1000
        }
      };
    }

    return baseData;
  };

  // Gestion des changements dans les données
  const handleDataChange = (field, value) => {
    setDocumentData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Effacer l'erreur si le champ est maintenant valide
    if (errors.includes(field)) {
      setErrors(prev => prev.filter(e => e !== field));
    }
  };

  // Validation avant génération
  const validateData = () => {
    if (!selectedDocumentType) {
      setErrors(['documentType']);
      return false;
    }

    try {
      const config = DocumentGenerationService.getAgencyConfig(
        agencyProfile.type_agence, 
        selectedDocumentType
      );
      
      const missingFields = config.requiredFields.filter(field => !documentData[field]);
      
      if (missingFields.length > 0) {
        setErrors(missingFields);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erreur validation:', error);
      setErrors(['validation']);
      return false;
    }
  };

  // Génération du document
  const handleGenerateDocument = async () => {
    if (!validateData()) {
      return;
    }

    setLoading(true);
    try {
      const result = await DocumentGenerationService.generateDocument({
        agencyType: agencyProfile.type_agence,
        documentType: selectedDocumentType,
        agencyProfile: agencyProfile,
        leadData: lead,
        customData: documentData
      });

      if (result.success) {
        setPreviewHtml(result.html);
        setShowPreview(true);
        
        if (onDocumentGenerated) {
          onDocumentGenerated(result.document);
        }
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur génération:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Rendu des champs spécifiques selon le type
  const renderSpecificFields = () => {
    if (!selectedDocumentType) return null;

    const agencyType = agencyProfile?.type_agence;

    if (agencyType === 'immobilier') {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de bien *
              </label>
              <select
                value={documentData.bien_type || ''}
                onChange={(e) => handleDataChange('bien_type', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.includes('bien_type') ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Sélectionner...</option>
                <option value="appartement">Appartement</option>
                <option value="maison">Maison</option>
                <option value="terrain">Terrain</option>
                <option value="local_commercial">Local commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Surface (m²) *
              </label>
              <input
                type="number"
                value={documentData.surface || ''}
                onChange={(e) => handleDataChange('surface', parseFloat(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.includes('surface') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix de vente (€) *
              </label>
              <input
                type="number"
                value={documentData.prix_vente || ''}
                onChange={(e) => handleDataChange('prix_vente', parseFloat(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.includes('prix_vente') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {selectedDocumentType === 'mandat' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durée du mandat (mois) *
                  </label>
                  <input
                    type="number"
                    value={documentData.duree_mandat || ''}
                    onChange={(e) => handleDataChange('duree_mandat', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.includes('duree_mandat') ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exclusivité
                  </label>
                  <select
                    value={documentData.exclusivite ? 'true' : 'false'}
                    onChange={(e) => handleDataChange('exclusivite', e.target.value === 'true')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </>
      );
    }

    if (agencyType === 'smma') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Services inclus *
            </label>
            <textarea
              value={documentData.services_inclus || ''}
              onChange={(e) => handleDataChange('services_inclus', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.includes('services_inclus') ? 'border-red-500' : 'border-gray-300'
              }`}
              rows={3}
              placeholder="Community Management, Publicité Facebook/Instagram, Reporting mensuel..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget mensuel (€) *
              </label>
              <input
                type="number"
                value={documentData.budget_mensuel || ''}
                onChange={(e) => handleDataChange('budget_mensuel', parseFloat(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.includes('budget_mensuel') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée contrat (mois) *
              </label>
              <input
                type="number"
                value={documentData.duree_contrat || ''}
                onChange={(e) => handleDataChange('duree_contrat', parseInt(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.includes('duree_contrat') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {selectedDocumentType === 'rapport' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période d'analyse *
              </label>
              <input
                type="month"
                value={documentData.periode_analyse || ''}
                onChange={(e) => handleDataChange('periode_analyse', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.includes('periode_analyse') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Génération de Documents - {agencyProfile?.type_agence?.toUpperCase()}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {!selectedDocumentType ? (
            /* Sélection du type de document */
            <div>
              <h3 className="text-lg font-semibold mb-4">Sélectionnez un type de document</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTypes.map(type => (
                  <div
                    key={type.type}
                    onClick={() => handleDocumentTypeChange(type.type)}
                    className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-3">
                        {type.type === 'devis' ? '📋' : 
                         type.type === 'facture' ? '🧾' : 
                         type.type === 'mandat' ? '📄' :
                         type.type === 'rapport' ? '📊' : '📝'}
                      </span>
                      <div>
                        <h4 className="font-semibold">{type.label}</h4>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {type.metadata?.category || 'document'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {type.type === 'devis' ? 'Estimation des coûts pour vos prestations' :
                       type.type === 'facture' ? 'Facturation officielle des services rendus' :
                       type.type === 'mandat' ? 'Contrat de mandat immobilier' :
                       type.type === 'rapport' ? 'Rapport de performance et résultats' :
                       'Document personnalisé'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : !showPreview ? (
            /* Formulaire de génération */
            <div>
              <div className="mb-6">
                <button
                  onClick={() => setSelectedDocumentType('')}
                  className="text-blue-600 hover:text-blue-800 mb-4"
                >
                  ← Retour aux types de documents
                </button>
                <h3 className="text-lg font-semibold">
                  {selectedDocumentType.charAt(0).toUpperCase() + selectedDocumentType.slice(1)} - {lead.nom}
                </h3>
              </div>

              {/* Informations client (lecture seule) */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Informations client</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Nom:</span>
                    <span className="ml-2 font-medium">{lead.nom}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 font-medium">{lead.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Téléphone:</span>
                    <span className="ml-2 font-medium">{lead.telephone}</span>
                  </div>
                </div>
              </div>

              {/* Champs spécifiques */}
              <div className="space-y-4">
                {renderSpecificFields()}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerateDocument}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Génération...' : 'Générer le document'}
                </button>
              </div>

              {/* Erreurs */}
              {errors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Champs requis manquants:</h4>
                  <ul className="text-sm text-red-700">
                    {errors.map(error => (
                      <li key={error}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Prévisualisation */
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Prévisualisation du document</h3>
                <div className="space-x-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([previewHtml], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedDocumentType}_${lead.nom}_${Date.now()}.html`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Télécharger
                  </button>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-[60vh] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedDocumentGenerator;
