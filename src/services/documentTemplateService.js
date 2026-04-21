/**
 * Service de génération de documents à partir des templates
 * Intégration avec les templates structurés pour IA
 */

import { getDocumentTemplate, remplacerVariablesTemplate } from '../templates/documentTemplates';
import { generateDocumentHtml } from '../utils/generateDocumentHtml';
import { supabase } from '../supabaseClient';

/**
 * Service de génération de documents professionnels
 */
export class DocumentTemplateService {
  
  /**
   * Génère un document à partir d'un template
   * @param {string} templateType - Type de template
   * @param {Object} data - Données pour le template
   * @param {Object} options - Options de génération
   * @returns {Object} Document généré avec HTML et métadonnées
   */
  static async generateFromTemplate(templateType, data, options = {}) {
    try {
      // 1️⃣ Récupérer le template
      const template = getDocumentTemplate(templateType, options.subtype);
      
      // 2️⃣ Remplacer les variables
      const templateData = remplacerVariablesTemplate(template, data);
      
      // 3️⃣ Générer le HTML
      const htmlContent = generateDocumentHtml({
        document: {
          ...templateData,
          ...options.documentData
        },
        agencyProfile: data.agency,
        lead: data.lead,
        docType: { id: templateType, label: templateData.title }
      });
      
      // 4️⃣ Structurer les données pour la base
      const documentData = {
        agency_id: data.agency.agency_id || data.agency.id,
        lead_id: data.lead.id,
        type: templateType,
        reference: options.reference || this.generateReference(templateType),
        titre: templateData.title,
        statut: 'generated',
        content_json: templateData, // Données structurées pour IA
        preview_html: htmlContent, // HTML pour affichage
        total_ttc: options.total_ttc || null,
        total_ht: options.total_ht || null,
        tva_amount: options.tva_amount || null,
        devise: options.devise || data.agency.devise || 'EUR',
        client_nom: data.lead.nom,
        client_email: data.lead.email,
        created_at: new Date().toISOString(),
        // Métadonnées IA
        ai_metadata: templateData.ai_metadata || {
          score_lead: null,
          risque_juridique: null,
          recommandation: null,
          priorite: 'medium'
        }
      };
      
      // 5️⃣ Sauvegarder dans la base
      const { data: savedDocument, error: saveError } = await supabase
        .from('documents')
        .insert([documentData])
        .select();
      
      if (saveError) {
        throw new Error(`Erreur sauvegarde document: ${saveError.message}`);
      }
      
      // 6️⃣ Ajouter à la timeline du lead
      const agencyId = data.agency?.agency_id || data.agency?.id
      await this.addToTimeline(data.lead.id, templateData.title, savedDocument[0], agencyId);
      
      return {
        success: true,
        document: savedDocument[0],
        template: templateData,
        html: htmlContent
      };
      
    } catch (error) {
      console.error('Erreur génération document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Génère une référence unique pour un document
   * @param {string} type - Type de document
   * @returns {string} Référence générée
   */
  static generateReference(type) {
    const prefixes = {
      mandat: 'MAN',
      compromis: 'COM',
      bon_visite: 'BV',
      contrat_gestion: 'CG',
      contrat_prestation: 'CP',
      briefing_client: 'BC',
      rapport_performance: 'RP'
    };
    
    const prefix = prefixes[type] || 'DOC';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    return `${prefix}-${timestamp}-${random}`;
  }
  
  /**
   * Ajoute un événement CRM lors de la génération d'un document
   */
  static async addToTimeline(leadId, documentTitle, document, agencyId) {
    if (!agencyId) return // agency_id requis par crm_events
    try {
      await supabase.from('crm_events').insert([{
        lead_id: leadId,
        agency_id: agencyId,
        type: 'document_generated',
        title: `📄 ${documentTitle} généré`,
        description: `${documentTitle} ${document.reference} créé avec succès`,
        metadata: { document_id: document.id },
        created_at: new Date().toISOString()
      }])
    } catch (_) { /* non-bloquant */ }
  }
  
  /**
   * Récupère les documents d'un lead avec leurs données structurées
   * @param {string} leadId - ID du lead
   * @returns {Array} Liste des documents
   */
  static async getLeadDocuments(leadId) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(doc => ({
        ...doc,
        structured_data: doc.content_json?.structured_data || {},
        ai_metadata: doc.ai_metadata || {}
      }));
      
    } catch (error) {
      console.error('Erreur récupération documents lead:', error);
      return [];
    }
  }
  
  /**
   * Met à jour les métadonnées IA d'un document
   * @param {string} documentId - ID du document
   * @param {Object} aiMetadata - Métadonnées IA
   * @returns {Object} Résultat de la mise à jour
   */
  static async updateAIMetadata(documentId, aiMetadata) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          ai_metadata: aiMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select();
      
      if (error) throw error;
      
      return { success: true, document: data[0] };
      
    } catch (error) {
      console.error('Erreur mise à jour métadonnées IA:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Calcule un score de risque juridique pour un document
   * @param {Object} document - Document avec données structurées
   * @returns {number} Score de risque (0-100)
   */
  static calculateRiskScore(document) {
    const structuredData = document.content_json?.structured_data || {};
    const type = document.type;
    
    let score = 0;
    
    // Risques par type de document
    const riskFactors = {
      compromis: 40, // Haut risque juridique
      mandat: 25, // Moyen risque
      contrat_gestion: 30, // Moyen-haut risque
      contrat_prestation: 20, // Moyen risque
      bon_visite: 10, // Bas risque
      briefing_client: 5, // Très bas risque
      rapport_performance: 5 // Très bas risque
    };
    
    score += riskFactors[type] || 20;
    
    // Facteurs aggravants
    if (structuredData.prix && parseFloat(structuredData.prix) > 500000) {
      score += 15; // Montant élevé
    }
    
    if (structuredData.duree && parseInt(structuredData.duree) > 24) {
      score += 10; // Durée longue
    }
    
    if (type === 'compromis' && !structuredData.conditions_suspensives) {
      score += 20; // Pas de conditions suspensives
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Génère des recommandations IA pour un document
   * @param {Object} document - Document avec données structurées
   * @returns {Array} Liste des recommandations
   */
  static generateRecommendations(document) {
    const structuredData = document.content_json?.structured_data || {};
    const type = document.type;
    const recommendations = [];
    
    // Recommandations par type
    switch (type) {
      case 'compromis':
        if (!structuredData.conditions_suspensives) {
          recommendations.push({
            type: 'juridique',
            priority: 'high',
            text: 'Ajouter des conditions suspensives (obtention prêt, permis de construire)'
          });
        }
        if (!structuredData.depots_garantie) {
          recommendations.push({
            type: 'financier',
            priority: 'medium',
            text: 'Préciser le montant et les conditions du dépôt de garantie'
          });
        }
        break;
        
      case 'mandat':
        if (structuredData.exclusivite === 'false') {
          recommendations.push({
            type: 'commercial',
            priority: 'medium',
            text: 'Proposer un mandat exclusif pour une meilleure commercialisation'
          });
        }
        break;
        
      case 'contrat_prestation':
        if (!structuredData.resultats_non_garantis) {
          recommendations.push({
            type: 'juridique',
            priority: 'high',
            text: 'Ajouter une clause sur les résultats non garantis'
          });
        }
        break;
    }
    
    return recommendations;
  }
}

export default DocumentTemplateService;
