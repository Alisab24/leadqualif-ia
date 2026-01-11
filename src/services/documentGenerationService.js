/**
 * ARCHITECTURE SaaS - Service de Génération de Documents Multi-Agences
 * 
 * Principes :
 * - Zero duplication de logique
 * - Extensibilité à d'autres métiers
 * - Templates dynamiques depuis la base
 * - Routage par type d'agence
 * - Production-ready
 */

import { supabase } from '../supabaseClient';

/**
 * Mapping des configurations par type d'agence
 * Extensible pour ajouter de nouveaux métiers
 */
export const AGENCY_CONFIGS = {
  // Configuration pour agences Immobilier
  immobilier: {
    documentTypes: {
      devis: {
        templateKey: 'immobilier_devis_template',
        requiredFields: ['bien_type', 'surface', 'adresse', 'prix_vente'],
        calculations: {
          honoraires: (data) => data.prix_vente * 0.05, // 5% standard
          tva: (data) => data.honoraires * 0.20,
          total_ttc: (data) => data.prix_vente + data.honoraires + data.tva
        },
        metadata: {
          category: 'transaction',
          legal_mentions: ['loi_alur', 'droit_preemption'],
          risk_level: 'medium'
        }
      },
      facture: {
        templateKey: 'immobilier_facture_template',
        requiredFields: ['bien_type', 'surface', 'adresse', 'prix_vente'],
        calculations: {
          honoraires: (data) => data.prix_vente * 0.05,
          tva: (data) => data.honoraires * 0.20,
          total_ttc: (data) => data.honoraires + data.tva
        },
        metadata: {
          category: 'facturation',
          legal_mentions: ['facturation_obligatoire'],
          risk_level: 'low'
        }
      },
      mandat: {
        templateKey: 'immobilier_mandat_template',
        requiredFields: ['bien_type', 'adresse', 'duree_mandat', 'exclusivite'],
        calculations: {
          commission: (data) => data.exclusivite ? data.prix_vente * 0.05 : data.prix_vente * 0.08,
        },
        metadata: {
          category: 'contractuel',
          legal_mentions: ['mandat_immobilier', 'exclusivite'],
          risk_level: 'high'
        }
      }
    },
    defaultValues: {
      tva_rate: 0.20,
      commission_rate: 0.05,
      devise: 'EUR',
      mentions_legales: [
        'Agence immatriculée au RCS',
        'Assurance responsabilité civile professionnelle',
        'Conformité loi Hoguet et ALUR'
      ]
    }
  },

  // Configuration pour agences SMMA
  smma: {
    documentTypes: {
      devis: {
        templateKey: 'smma_devis_template',
        requiredFields: ['services_inclus', 'budget_mensuel', 'duree_contrat'],
        calculations: {
          total_ht: (data) => data.budget_mensuel * data.duree_contrat,
          tva: (data) => data.total_ht * 0.20,
          total_ttc: (data) => data.total_ht + data.tva,
          setup_fee: (data) => data.budget_mensuel * 0.5 // 50% du premier mois
        },
        metadata: {
          category: 'commercial',
          legal_mentions: ['services_digitals', 'rgpd'],
          risk_level: 'low'
        }
      },
      facture: {
        templateKey: 'smma_facture_template',
        requiredFields: ['services_inclus', 'budget_mensuel', 'periode_facturation'],
        calculations: {
          total_ht: (data) => data.budget_mensuel,
          tva: (data) => data.total_ht * 0.20,
          total_ttc: (data) => data.total_ht + data.tva
        },
        metadata: {
          category: 'facturation',
          legal_mentions: ['facturation_digitale', 'preuve_prestation'],
          risk_level: 'low'
        }
      },
      rapport: {
        templateKey: 'smma_rapport_template',
        requiredFields: ['periode_analyse', 'kpi_principaux', 'resultats_obtenus'],
        calculations: {
          performance_score: (data) => {
            const base = data.resultats_obtenus.leads_generes / data.kpi_principaux.objectif_leads;
            return Math.min(base * 100, 100);
          },
          roi_estime: (data) => (data.resultats_obtenus.conversions * data.kpi_principaux.valeur_conversion) - data.budget_mensuel
        },
        metadata: {
          category: 'reporting',
          legal_mentions: ['analytics_consent'],
          risk_level: 'very_low'
        }
      }
    },
    defaultValues: {
      tva_rate: 0.20,
      devise: 'EUR',
      mentions_legales: [
        'Prestataire de services digitaux',
        'Conformité RGPD',
        'Propriété intellectuelle préservée'
      ]
    }
  },

  // Extensibilité : facile à ajouter pour d'autres métiers
  // ex: consultant, avocat, architecte, etc.
};

/**
 * Service principal de génération de documents
 * Architecture SaaS robuste et extensible
 */
export class DocumentGenerationService {
  
  /**
   * Génère un document en fonction du type d'agence
   * @param {Object} params - Paramètres de génération
   * @param {string} params.agencyType - Type d'agence (immobilier, smma)
   * @param {string} params.documentType - Type de document (devis, facture, etc.)
   * @param {Object} params.agencyProfile - Profil de l'agence
   * @param {Object} params.leadData - Données du lead/client
   * @param {Object} params.customData - Données additionnelles
   * @returns {Promise<Object>} Document généré
   */
  static async generateDocument({ 
    agencyType, 
    documentType, 
    agencyProfile, 
    leadData, 
    customData = {} 
  }) {
    try {
      // 1️⃣ Validation des paramètres
      this.validateParams({ agencyType, documentType, agencyProfile, leadData });
      
      // 2️⃣ Récupération de la configuration
      const config = this.getAgencyConfig(agencyType, documentType);
      
      // 3️⃣ Validation des champs requis
      this.validateRequiredFields(config.requiredFields, { ...leadData, ...customData });
      
      // 4️⃣ Préparation des données
      const documentData = this.prepareDocumentData({
        config,
        agencyProfile,
        leadData,
        customData
      });
      
      // 5️⃣ Récupération du template depuis la base
      const template = await this.getTemplateFromDatabase(config.templateKey);
      
      // 6️⃣ Génération du HTML
      const htmlContent = this.generateHTML(template, documentData);
      
      // 7️⃣ Création de l'enregistrement dans la table documents
      const documentRecord = await this.createDocumentRecord({
        agencyProfile,
        leadData,
        documentType,
        documentData,
        htmlContent,
        config
      });
      
      return {
        success: true,
        document: documentRecord,
        html: htmlContent,
        metadata: config.metadata
      };
      
    } catch (error) {
      console.error('Erreur génération document:', error);
      return {
        success: false,
        error: error.message,
        code: error.code || 'GENERATION_ERROR'
      };
    }
  }
  
  /**
   * Validation des paramètres d'entrée
   */
  static validateParams({ agencyType, documentType, agencyProfile, leadData }) {
    // 🧠 RÈGLE D'OR (PROCESS D) - Seuls les champs critiques sont bloquants
    
    // Champs OBLIGATOIRES pour la génération et les quotas
    if (!agencyType || !AGENCY_CONFIGS[agencyType]) {
      throw new Error(`Type d'agence invalide: ${agencyType}`);
    }
    
    if (!documentType) {
      throw new Error('Type de document requis');
    }
    
    if (!agencyProfile?.agency_id) {
      throw new Error('agencyProfile.agency_id est requis pour la génération');
    }
    
    if (!agencyProfile?.nom_agence && !agencyProfile?.nom_legal) {
      throw new Error('agencyProfile.nom_agence ou nom_legal est requis');
    }
    
    // 🎯 Champs secondaires manquants = WARNING + FALLBACKS (pas d'erreur bloquante)
    if (!agencyProfile?.devise) {
      console.warn('⚠️ Devise manquante, utilisation du fallback: EUR');
      agencyProfile.devise = 'EUR'; // Fallback automatique
    }
    
    if (!agencyProfile?.mentions_legales) {
      console.warn('⚠️ Mentions légales manquantes, utilisation du fallback: Document généré via NexaPro');
      agencyProfile.mentions_legales = 'Document généré via NexaPro'; // Fallback automatique
    }
    
    if (!agencyProfile?.adresse_legale && !agencyProfile?.adresse) {
      console.warn('⚠️ Adresse manquante, utilisation du fallback: —');
      agencyProfile.adresse_legale = agencyProfile.adresse_legale || agencyProfile.adresse || '—'; // Fallback automatique
    }
    
    // ✅ Génération toujours possible - quotas toujours comptabilisés
    console.log('✅ Validation OK - Génération possible avec fallbacks automatiques');
  }
  
  /**
   * Récupération de la configuration par type d'agence et document
   */
  static getAgencyConfig(agencyType, documentType) {
    const agencyConfig = AGENCY_CONFIGS[agencyType];
    if (!agencyConfig) {
      throw new Error(`Configuration non trouvée pour le type d'agence: ${agencyType}`);
    }
    
    const docConfig = agencyConfig.documentTypes[documentType];
    if (!docConfig) {
      throw new Error(`Type de document "${documentType}" non disponible pour ${agencyType}`);
    }
    
    return {
      ...docConfig,
      defaultValues: agencyConfig.defaultValues
    };
  }
  
  /**
   * Validation des champs requis
   */
  static validateRequiredFields(requiredFields, data) {
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Champs requis manquants: ${missingFields.join(', ')}`);
    }
  }
  
  /**
   * Préparation des données du document
   */
  static prepareDocumentData({ config, agencyProfile, leadData, customData }) {
    // Fusion des données
    const baseData = {
      ...leadData,
      ...customData,
      agency: agencyProfile,
      generated_at: new Date().toISOString(),
      reference: this.generateReference(config.templateKey)
    };
    
    // Calculs automatiques
    const calculatedData = {};
    Object.entries(config.calculations).forEach(([key, calculation]) => {
      try {
        calculatedData[key] = calculation(baseData);
      } catch (error) {
        console.warn(`Erreur calcul ${key}:`, error);
        calculatedData[key] = 0;
      }
    });
    
    // Valeurs par défaut
    const defaults = {};
    Object.entries(config.defaultValues).forEach(([key, value]) => {
      if (!baseData[key]) {
        defaults[key] = value;
      }
    });
    
    return {
      ...baseData,
      ...calculatedData,
      ...defaults
    };
  }
  
  /**
   * Récupération du template depuis la base de données
   */
  static async getTemplateFromDatabase(templateKey) {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .single();
      
      if (error) {
        // Fallback: template par défaut si non trouvé en base
        return this.getDefaultTemplate(templateKey);
      }
      
      if (!data) {
        throw new Error(`Template non trouvé: ${templateKey}`);
      }
      
      return data.template_html;
      
    } catch (error) {
      console.warn(`Template ${templateKey} non trouvé en base, utilisation du défaut:`, error);
      return this.getDefaultTemplate(templateKey);
    }
  }
  
  /**
   * Template par défaut (fallback)
   */
  static getDefaultTemplate(templateKey) {
    const defaultTemplates = {
      immobilier_devis_template: `
        <div class="document">
          <header>
            <h1>DEVIS - {{agency.nom_agence}}</h1>
            <p>Référence: {{reference}}</p>
          </header>
          <section>
            <h2>Informations du bien</h2>
            <p>Type: {{bien_type}}</p>
            <p>Surface: {{surface}} m²</p>
            <p>Adresse: {{adresse}}</p>
            <p>Prix de vente: {{prix_vente}} {{devise}}</p>
          </section>
          <section>
            <h2>Honoraires</h2>
            <p>Honoraires: {{honoraires}} {{devise}}</p>
            <p>TVA (20%): {{tva}} {{devise}}</p>
            <p>Total: {{total_ttc}} {{devise}}</p>
          </section>
        </div>
      `,
      smma_devis_template: `
        <div class="document">
          <header>
            <h1>DEVIS - {{agency.nom_agence}}</h1>
            <p>Référence: {{reference}}</p>
          </header>
          <section>
            <h2>Prestations marketing</h2>
            <p>Services: {{services_inclus}}</p>
            <p>Budget mensuel: {{budget_mensuel}} {{devise}}</p>
            <p>Durée: {{duree_contrat}} mois</p>
          </section>
          <section>
            <h2>Coût total</h2>
            <p>Total HT: {{total_ht}} {{devise}}</p>
            <p>TVA (20%): {{tva}} {{devise}}</p>
            <p>Total TTC: {{total_ttc}} {{devise}}</p>
          </section>
        </div>
      `
    };
    
    return defaultTemplates[templateKey] || `
      <div class="document">
        <h1>Document - {{agency.nom_agence}}</h1>
        <p>Référence: {{reference}}</p>
        <p>Template par défaut - Veuillez configurer le template dans la base</p>
      </div>
    `;
  }
  
  /**
   * Génération du HTML final
   */
  static generateHTML(template, data) {
    let html = template;
    
    // Remplacement des variables {{variable}}
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value || '');
    });
    
    // Support des objets imbriqués {{agency.nom_agence}}
    html = this.replaceNestedVariables(html, data);
    
    return html;
  }
  
  /**
   * Remplacement des variables imbriquées
   */
  static replaceNestedVariables(html, data) {
    // Gestion des objets imbriqués (ex: {{agency.nom_agence}})
    const nestedRegex = /{{(\w+)\.(\w+)}}/g;
    
    return html.replace(nestedRegex, (match, objKey, propKey) => {
      return data[objKey]?.[propKey] || match;
    });
  }
  
  /**
   * Création de l'enregistrement dans la table documents
   */
  static async createDocumentRecord({ 
    agencyProfile, 
    leadData, 
    documentType, 
    documentData, 
    htmlContent, 
    config 
  }) {
    const record = {
      agency_id: agencyProfile.agency_id || agencyProfile.id,
      lead_id: leadData.id,
      type: documentType,
      reference: documentData.reference,
      titre: `${documentType.toUpperCase()} - ${leadData.nom}`,
      statut: 'generated',
      preview_html: htmlContent,
      content_json: {
        ...documentData,
        metadata: config.metadata,
        agency_type: agencyProfile.type_agence
      },
      total_ttc: documentData.total_ttc || 0,
      total_ht: documentData.total_ht || 0,
      tva_amount: documentData.tva || 0,
      devise: documentData.devise || 'EUR',
      client_nom: leadData.nom,
      client_email: leadData.email,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('documents')
      .insert([record])
      .select()
      .single();
    
    if (error) {
      throw new Error(`Erreur sauvegarde document: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Génération de référence unique
   */
  static generateReference(templateKey) {
    const prefix = templateKey.split('_')[0].toUpperCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    return `${prefix}-${timestamp}-${random}`;
  }
  
  /**
   * Récupération des types de documents disponibles par agence
   */
  static getAvailableDocumentTypes(agencyType) {
    const config = AGENCY_CONFIGS[agencyType];
    if (!config) {
      return [];
    }
    
    return Object.keys(config.documentTypes).map(type => ({
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      metadata: config.documentTypes[type].metadata
    }));
  }
  
  /**
   * Validation de la complétude d'un document
   */
  static validateDocumentCompleteness(documentData, agencyType, documentType) {
    const config = this.getAgencyConfig(agencyType, documentType);
    const missingFields = [];
    
    // Vérification des champs requis
    config.requiredFields.forEach(field => {
      if (!documentData[field]) {
        missingFields.push(field);
      }
    });
    
    // Vérification des calculs
    Object.keys(config.calculations).forEach(calcField => {
      if (!documentData[calcField] && documentData[calcField] !== 0) {
        missingFields.push(calcField);
      }
    });
    
    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completeness: ((config.requiredFields.length - missingFields.length) / config.requiredFields.length) * 100
    };
  }
}

export default DocumentGenerationService;
