/**
 * Composant de génération de documents à partir de templates
 * Interface unifiée pour tous les types de documents (IMMO + SMMA)
 */

import React, { useState, useEffect } from 'react';
import { DocumentTemplateService } from '../services/documentTemplateService';
import { supabase } from '../supabaseClient';
import MandatIAGenerator from './MandatIAGenerator';

const DocumentTemplateGenerator = ({ 
  lead, 
  agencyId, 
  agencyType, 
  onDocumentGenerated,
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateData, setTemplateData] = useState({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Templates disponibles par type d'agence
  const getAvailableTemplates = () => {
    if (agencyType === 'immobilier') {
      return [
        { 
          id: 'mandat', 
          label: 'Mandat de Vente', 
          icon: '📋',
          description: 'Mandat de vente exclusif ou simple',
          category: 'transaction'
        },
        { 
          id: 'compromis', 
          label: 'Compromis de Vente', 
          icon: '🤝',
          description: 'Promesse de vente avec conditions suspensives',
          category: 'transaction'
        },
        { 
          id: 'bon_visite', 
          label: 'Bon de Visite', 
          icon: '🏠',
          description: 'Engagement de visite sans contournement',
          category: 'prospection'
        },
        { 
          id: 'contrat_gestion', 
          label: 'Contrat de Gestion', 
          icon: '📄',
          description: 'Contrat de gestion locative ou syndic',
          category: 'service'
        }
      ];
    } else {
      return [
        { 
          id: 'contrat_prestation', 
          label: 'Contrat de Prestation', 
          icon: '📝',
          description: 'Contrat de services marketing digitaux',
          category: 'service'
        },
        { 
          id: 'briefing_client', 
          label: 'Briefing Client', 
          icon: '📋',
          description: 'Document interne de briefing stratégique',
          category: 'interne'
        },
        { 
          id: 'rapport_performance', 
          label: 'Rapport de Performance', 
          icon: '📊',
          description: 'Rapport mensuel de performance marketing',
          category: 'reporting'
        }
      ];
    }
  };

  const availableTemplates = getAvailableTemplates();

  // Charger le profil agence
  useEffect(() => {
    const fetchAgencyProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Utilisateur non authentifié');

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!profileData) throw new Error('Profil agence non trouvé');

        setAgencyProfile(profileData);
      } catch (error) {
        console.error('Erreur chargement profil:', error);
      }
    };

    fetchAgencyProfile();
  }, []);

  // Gérer la sélection de template
  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    setTemplateData(getDefaultTemplateData(templateId));
    setShowPreview(false);
  };

  // Données par défaut pour chaque template
  const getDefaultTemplateData = (templateId) => {
    const baseData = {
      // Données communes
      date_signature: new Date().toLocaleDateString('fr-FR'),
      lieu_signature: agencyProfile?.ville || 'Lieu de signature',
      
      // Données agence
      agency: agencyProfile
    };

    // Données spécifiques par template
    switch (templateId) {
      case 'mandat':
        return {
          ...baseData,
          bien_type: lead.type_bien || 'appartement',
          prix: lead.budget || 0,
          commission: 5,
          commission_type: 'pourcentage',
          duree: 3,
          exclusivite: true,
          qui_paie_honoraires: 'vendeur'
        };
        
      case 'compromis':
        return {
          ...baseData,
          bien_type: lead.type_bien || 'appartement',
          prix: lead.budget || 0,
          acquereur_nom: '',
          acquereur_email: '',
          condition_financement: true,
          delai_financement: 45,
          depot_garantie: lead.budget * 0.1 || 0
        };
        
      case 'bon_visite':
        return {
          ...baseData,
          bien_type: lead.type_bien || 'appartement',
          date_visite: new Date().toISOString().split('T')[0],
          heure_visite: '14:00',
          duree_estimee: '1h',
          agent_present: true
        };
        
      case 'contrat_gestion':
        return {
          ...baseData,
          type_gestion: 'location',
          duree_mois: 12,
          type_remuneration: 'pourcentage_loyer',
          taux_honoraires: 8
        };
        
      case 'contrat_prestation':
        return {
          ...baseData,
          type_prestation: 'complet',
          duree_mois: 6,
          montant_mensuel: lead.budget * 0.05 || 500,
          ads_plateformes: ['facebook', 'instagram'],
          cm_plateformes: ['facebook', 'instagram']
        };
        
      case 'briefing_client':
        return {
          ...baseData,
          nom_entreprise: lead.nom,
          secteur_activite: lead.secteur || 'Non spécifié',
          objectif_principal: 'génération de leads',
          budget_mensuel: lead.budget * 0.05 || 500,
          date_lancement: new Date().toISOString().split('T')[0]
        };
        
      case 'rapport_performance':
        return {
          ...baseData,
          periode_analyse: 'Mois en cours',
          objectifs_initiaux: 'Augmenter la visibilité',
          portee_totale: 10000,
          leads_generes: 50,
          conversions: 5
        };
        
      default:
        return baseData;
    }
  };

  // Gérer les changements dans les données du template
  const handleTemplateDataChange = (field, value) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Générer le document
  const handleGenerateDocument = async () => {
    if (!selectedTemplate || !agencyProfile) return;

    setLoading(true);
    try {
      const result = await DocumentTemplateService.generateFromTemplate(
        selectedTemplate,
        {
          agency: agencyProfile,
          lead: lead,
          custom: templateData
        },
        {
          reference: DocumentTemplateService.generateReference(selectedTemplate),
          total_ttc: templateData.prix || templateData.montant_mensuel || 0,
          devise: agencyProfile.devise || 'EUR'
        }
      );

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

  // Télécharger le document
  const handleDownload = () => {
    if (!previewHtml) return;

    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate}_${lead.nom}_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Générateur de Documents
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
          {!selectedTemplate ? (
            /* Sélection du template */
            <div>
              <h3 className="text-lg font-semibold mb-4">Sélectionnez un type de document</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTemplates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-3">{template.icon}</span>
                      <div>
                        <h4 className="font-semibold">{template.label}</h4>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {template.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : !showPreview ? (
            /* Formulaire de template */
            <div>
              <div className="mb-6">
                <button
                  onClick={() => setSelectedTemplate('')}
                  className="text-blue-600 hover:text-blue-800 mb-4"
                >
                  ← Retour aux templates
                </button>
                <h3 className="text-lg font-semibold">
                  {availableTemplates.find(t => t.id === selectedTemplate)?.label}
                </h3>
              </div>

              <div className="space-y-4">
                {/* Champs communs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date de signature
                    </label>
                    <input
                      type="date"
                      value={templateData.date_signature || ''}
                      onChange={(e) => handleTemplateDataChange('date_signature', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lieu de signature
                    </label>
                    <input
                      type="text"
                      value={templateData.lieu_signature || ''}
                      onChange={(e) => handleTemplateDataChange('lieu_signature', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Champs spécifiques selon template */}
                {renderTemplateSpecificFields()}

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
              </div>
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
                    onClick={handleDownload}
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

  // Rendu des champs spécifiques selon le template
  function renderTemplateSpecificFields() {
    switch (selectedTemplate) {
      case 'mandat':
        return (
          <>
            {/* ── Générateur IA des clauses ── */}
            <MandatIAGenerator
              lead={lead}
              agency={agencyProfile}
              onClauses={(clauses) => {
                // Pré-remplir automatiquement les champs depuis les suggestions IA
                if (clauses.commission) {
                  const match = clauses.commission.match(/(\d+(?:[.,]\d+)?)\s*%/)
                  if (match) handleTemplateDataChange('commission', parseFloat(match[1]))
                }
                if (typeof clauses.exclusivite === 'boolean') {
                  handleTemplateDataChange('exclusivite', clauses.exclusivite)
                }
                const dureeMatch = clauses.duree && clauses.duree.match(/(\d+)\s*mois/)
                if (dureeMatch) handleTemplateDataChange('duree', parseInt(dureeMatch[1]))
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de bien</label>
                <select
                  value={templateData.bien_type || ''}
                  onChange={(e) => handleTemplateDataChange('bien_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                  <option value="terrain">Terrain</option>
                  <option value="local">Local commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (€)</label>
                <input
                  type="number"
                  value={templateData.prix || ''}
                  onChange={(e) => handleTemplateDataChange('prix', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission (%)</label>
                <input
                  type="number"
                  value={templateData.commission || ''}
                  onChange={(e) => handleTemplateDataChange('commission', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée (mois)</label>
                <input
                  type="number"
                  value={templateData.duree || ''}
                  onChange={(e) => handleTemplateDataChange('duree', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exclusivité</label>
                <select
                  value={templateData.exclusivite ? 'true' : 'false'}
                  onChange={(e) => handleTemplateDataChange('exclusivite', e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'contrat_prestation':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de prestation</label>
                <select
                  value={templateData.type_prestation || ''}
                  onChange={(e) => handleTemplateDataChange('type_prestation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="complet">Package complet</option>
                  <option value="community_management">Community management</option>
                  <option value="ads">Publicité uniquement</option>
                  <option value="funnels">Funnels et automatisation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant mensuel (€)</label>
                <input
                  type="number"
                  value={templateData.montant_mensuel || ''}
                  onChange={(e) => handleTemplateDataChange('montant_mensuel', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (mois)</label>
              <input
                type="number"
                value={templateData.duree_mois || ''}
                onChange={(e) => handleTemplateDataChange('duree_mois', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </>
        );

      case 'briefing_client':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={templateData.nom_entreprise || ''}
                  onChange={(e) => handleTemplateDataChange('nom_entreprise', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secteur d'activité</label>
                <input
                  type="text"
                  value={templateData.secteur_activite || ''}
                  onChange={(e) => handleTemplateDataChange('secteur_activite', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objectif principal</label>
              <select
                value={templateData.objectif_principal || ''}
                onChange={(e) => handleTemplateDataChange('objectif_principal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="génération de leads">Génération de leads</option>
                <option value="vente">Vente en ligne</option>
                <option value="notoriete">Notoriété</option>
                <option value="engagement">Engagement communauté</option>
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget mensuel (€)</label>
                <input
                  type="number"
                  value={templateData.budget_mensuel || ''}
                  onChange={(e) => handleTemplateDataChange('budget_mensuel', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de lancement</label>
                <input
                  type="date"
                  value={templateData.date_lancement || ''}
                  onChange={(e) => handleTemplateDataChange('date_lancement', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </>
        );

      default:
        return (
          <div className="text-gray-500 text-center py-8">
            Les champs spécifiques pour ce template seront bientôt disponibles.
          </div>
        );
    }
  }
};

export default DocumentTemplateGenerator;
