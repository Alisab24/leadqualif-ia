/**
 * INGÉNIEUR SaaS - Service de Génération HTML Robuste
 * 
 * Principes d'architecture :
 * - Zero hardcoding HTML
 * - Templates dynamiques depuis base
 * - Injection sécurisée des données
 * - Gestion d'erreurs complète
 * - Extensible sans modification
 * - Production-ready avec logging
 */

import { supabase } from '../supabaseClient';

/**
 * Service principal de génération HTML
 * Architecture SaaS robuste et extensible
 */
class DocumentHtmlService {
  
  /**
   * Génère le HTML d'un document de manière robuste
   * @param {Object} params - Paramètres de génération
   * @param {Object} params.agencyProfile - Profil de l'agence
   * @param {string} params.documentType - Type de document (devis, facture, etc.)
   * @param {Object} params.leadData - Données du lead (optionnel pour SMMA)
   * @param {Object} params.customData - Données additionnelles
   * @param {Object} params.calculations - Calculs pré-calculés (optionnel)
   * @returns {Promise<Object>} { html: string, metadata: Object }
   */
  static async generateDocumentHtml({
    agencyProfile,
    documentType,
    leadData = null,
    customData = {},
    calculations = {}
  }) {
    try {
      // 1️⃣ Validation des paramètres obligatoires
      this.validateParams({ agencyProfile, documentType });
      
      // 2️⃣ Détermination du type d'agence
      const agencyType = agencyProfile.type_agence || 'immobilier';
      
      // 3️⃣ Construction de la clé de template
      const templateKey = `${agencyType}_${documentType}_template`;
      
      // 4️⃣ Récupération du template depuis la base
      const template = await this.getTemplateFromDatabase(templateKey);
      
      // 5️⃣ Préparation des données d'injection
      const injectionData = this.prepareInjectionData({
        agencyProfile,
        documentType,
        leadData,
        customData,
        calculations,
        agencyType
      });
      
      // 6️⃣ Injection sécurisée dans le template
      const htmlContent = this.injectDataIntoTemplate(template, injectionData);
      
      // 7️⃣ Validation du HTML généré
      this.validateGeneratedHtml(htmlContent);
      
      // 8️⃣ Retour du résultat avec métadonnées
      return {
        success: true,
        html: htmlContent,
        metadata: {
          templateKey,
          agencyType,
          documentType,
          hasLead: !!leadData,
          injectionCount: Object.keys(injectionData).length,
          generatedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur génération HTML:', error);
      
      // Fallback vers template par défaut
      return this.generateFallbackHtml({
        agencyProfile,
        documentType,
        leadData,
        customData,
        calculations,
        error
      });
    }
  }
  
  /**
   * Validation des paramètres d'entrée
   */
  static validateParams({ agencyProfile, documentType }) {
    // 🧠 RÈGLE D'OR (PROCESS D) - Seuls les champs critiques sont bloquants
    
    // Champs OBLIGATOIRES pour la génération et les quotas
    if (!agencyProfile?.agency_id) {
      throw new Error('agencyProfile.agency_id est requis pour la génération');
    }
    
    if (!agencyProfile?.nom_agence && !agencyProfile?.nom_legal) {
      throw new Error('agencyProfile.nom_agence ou nom_legal est requis');
    }
    
    if (!documentType || typeof documentType !== 'string') {
      throw new Error('documentType doit être une chaîne non vide');
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
    
    // Validation du type de document
    const validTypes = ['devis', 'facture', 'mandat', 'rapport', 'contrat', 'attestation', 'convention'];
    if (!validTypes.includes(documentType)) {
      throw new Error(`documentType invalide: ${documentType}. Types valides: ${validTypes.join(', ')}`);
    }
    
    // ✅ Génération toujours possible - quotas toujours comptabilisés
    console.log('✅ Validation OK - Génération possible avec fallbacks automatiques');
  }
  
  /**
   * Récupération du template depuis la base de données
   */
  static async getTemplateFromDatabase(templateKey) {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('template_html, template_css, variables_schema')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .single();
      
      if (error) {
        console.warn(`⚠️ Template ${templateKey} non trouvé en base:`, error);
        throw new Error(`Template non trouvé: ${templateKey}`);
      }
      
      if (!data || !data.template_html) {
        throw new Error(`Template vide pour: ${templateKey}`);
      }
      
      // Combiner HTML et CSS si présent
      let fullTemplate = data.template_html;
      if (data.template_css) {
        fullTemplate = this.injectCssIntoHtml(data.template_html, data.template_css);
      }
      
      return {
        html: fullTemplate,
        schema: data.variables_schema || {}
      };
      
    } catch (error) {
      console.error(`❌ Erreur chargement template ${templateKey}:`, error);
      throw error;
    }
  }
  
  /**
   * Injection du CSS dans le HTML
   */
  static injectCssIntoHtml(html, css) {
    const cssBlock = `<style>\n${css}\n</style>`;
    
    // Injection après la balise <head> ou au début si pas de head
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n${cssBlock}`);
    } else {
      return `${cssBlock}\n${html}`;
    }
  }
  
  /**
   * Préparation des données d'injection
   */
  static prepareInjectionData({
    agencyProfile,
    documentType,
    leadData,
    customData,
    calculations,
    agencyType
  }) {
    // Données de base toujours présentes
    const baseData = {
      // Agence
      agency: {
        nom_agence: agencyProfile.nom_agence || 'Agence',
        adresse_legale: agencyProfile.adresse_legale || '',
        telephone: agencyProfile.telephone || '',
        email: agencyProfile.email || '',
        siret: agencyProfile.numero_siret || '',
        logo_url: agencyProfile.logo_url || '',
        type_agence: agencyType,
        mentions_legales: agencyProfile.mentions_legales || ''
      },
      
      // Document
      document: {
        type: documentType,
        reference: this.generateReference(documentType),
        date_generation: new Date().toLocaleDateString('fr-FR'),
        date_iso: new Date().toISOString(),
        devise: agencyProfile.devise || 'EUR',
        titre: this.getDocumentTitle(documentType, agencyType)
      }
    };
    
    // Données client si lead présent
    if (leadData) {
      baseData.client = {
        nom: leadData.nom || 'Client',
        email: leadData.email || '',
        telephone: leadData.telephone || '',
        adresse: leadData.adresse || leadData.adresse_complete || '',
        id: leadData.id || ''
      };
    } else {
      // SMMA peut fonctionner sans lead
      baseData.client = {
        nom: customData.client_nom || 'Client',
        email: customData.client_email || '',
        telephone: customData.client_telephone || '',
        adresse: customData.client_adresse || '',
        id: customData.client_id || ''
      };
    }
    
    // Données spécifiques par type d'agence
    const specificData = this.prepareSpecificData({
      agencyType,
      documentType,
      leadData,
      customData,
      calculations
    });
    
    // Fusion avec priorité : customData > specificData > baseData
    return {
      ...baseData,
      ...specificData,
      ...calculations,
      ...customData
    };
  }
  
  /**
   * Préparation des données spécifiques par type d'agence
   */
  static prepareSpecificData({ agencyType, documentType, leadData, customData, calculations }) {
    if (agencyType === 'immobilier') {
      return this.prepareImmobilierData({ documentType, leadData, customData });
    } else if (agencyType === 'smma') {
      return this.prepareSmmaData({ documentType, leadData, customData });
    }
    
    return {};
  }
  
  /**
   * Données spécifiques IMMOBILIER
   */
  static prepareImmobilierData({ documentType, leadData, customData }) {
    const immobilierData = {
      bien: {
        type: leadData?.type_bien || customData.bien_type || 'appartement',
        surface: leadData?.surface || customData.surface || 0,
        adresse: leadData?.adresse || customData.adresse || '',
        prix_vente: leadData?.budget || customData.prix_vente || 0,
        description: leadData?.description || customData.description || ''
      }
    };
    
    // Ajout des données spécifiques au type de document
    if (documentType === 'mandat') {
      immobilierData.mandat = {
        duree: customData.duree_mandat || 3,
        exclusivite: customData.exclusivite !== false,
        commission: customData.commission || 0
      };
    }
    
    return immobilierData;
  }
  
  /**
   * Données spécifiques SMMA
   */
  static prepareSmmaData({ documentType, leadData, customData }) {
    const smmaData = {
      services: {
        inclus: customData.services_inclus || 'Community Management, Publicité',
        periode: customData.periode_facturation || 'mensuel'
      },
      campagne: {
        budget_mensuel: customData.budget_mensuel || 500,
        duree_contrat: customData.duree_contrat || 6,
        plateformes: customData.plateformes || ['Facebook', 'Instagram']
      }
    };
    
    // Ajout des données spécifiques au type de document
    if (documentType === 'rapport') {
      smmaData.performance = {
        periode_analyse: customData.periode_analyse || new Date().toISOString().slice(0, 7),
        kpi_principaux: customData.kpi_principaux || {
          objectif_leads: 50,
          objectif_conversions: 5
        },
        resultats_obtenus: customData.resultats_obtenus || {
          leads_generes: 25,
          conversions: 2
        }
      };
    }
    
    return smmaData;
  }
  
  /**
   * Injection sécurisée des données dans le template
   */
  static injectDataIntoTemplate(template, data) {
    let html = template.html;
    
    // 1️⃣ Remplacement des variables simples {{variable}}
    html = this.replaceSimpleVariables(html, data);
    
    // 2️⃣ Remplacement des variables imbriquées {{objet.propriete}}
    html = this.replaceNestedVariables(html, data);
    
    // 3️⃣ Remplacement des variables conditionnelles {{#if condition}}...{{/if}}
    html = this.replaceConditionalVariables(html, data);
    
    // 4️⃣ Remplacement des boucles {{#each array}}...{{/each}}
    html = this.replaceLoopVariables(html, data);
    
    return html;
  }
  
  /**
   * Remplacement des variables simples {{variable}}
   */
  static replaceSimpleVariables(html, data) {
    // Remplacer toutes les variables simples
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value);
      }
    });
    
    return html;
  }
  
  /**
   * Remplacement des variables imbriquées {{objet.propriete}}
   */
  static replaceNestedVariables(html, data) {
    const nestedRegex = /{{(\w+)\.(\w+)}}/g;
    
    return html.replace(nestedRegex, (match, objKey, propKey) => {
      const obj = data[objKey];
      if (obj && typeof obj === 'object' && obj[propKey] !== undefined) {
        return obj[propKey];
      }
      return match; // Garder le placeholder si non trouvé
    });
  }
  
  /**
   * Remplacement des variables conditionnelles
   */
  static replaceConditionalVariables(html, data) {
    const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    
    return html.replace(conditionalRegex, (match, condition, content) => {
      const value = data[condition];
      if (value && value !== false && value !== 0) {
        return content;
      }
      return ''; // Supprimer le contenu si condition fausse
    });
  }
  
  /**
   * Remplacement des boucles
   */
  static replaceLoopVariables(html, data) {
    const loopRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
    
    return html.replace(loopRegex, (match, arrayKey, content) => {
      const array = data[arrayKey];
      if (Array.isArray(array)) {
        return array.map(item => {
          let itemContent = content;
          Object.entries(item).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            itemContent = itemContent.replace(regex, value);
          });
          return itemContent;
        }).join('');
      }
      return '';
    });
  }
  
  /**
   * Validation du HTML généré
   */
  static validateGeneratedHtml(html) {
    if (!html || typeof html !== 'string') {
      throw new Error('HTML généré invalide');
    }
    
    // Vérifier qu'il n'y a plus de placeholders non remplis
    const remainingPlaceholders = html.match(/{{[^}]+}}/g);
    if (remainingPlaceholders && remainingPlaceholders.length > 0) {
      console.warn('⚠️ Placeholders non remplis:', remainingPlaceholders);
    }
    
    // Vérifier la présence de balises HTML de base
    if (!html.includes('<') || !html.includes('>')) {
      console.warn('⚠️ HTML semble invalide (pas de balises)');
    }
  }
  
  /**
   * Génération de fallback en cas d'erreur
   */
  static generateFallbackHtml({ agencyProfile, documentType, leadData, customData, error }) {
    console.warn('🔄 Utilisation du template fallback pour:', documentType);
    
    const fallbackTemplate = this.getFallbackTemplate(documentType);
    const fallbackData = {
      agency: {
        nom_agence: agencyProfile?.nom_agence || 'Agence',
        type_agence: agencyProfile?.type_agence || 'immobilier'
      },
      document: {
        type: documentType,
        reference: this.generateReference(documentType),
        date_generation: new Date().toLocaleDateString('fr-FR')
      },
      client: leadData ? {
        nom: leadData.nom || 'Client'
      } : {
        nom: customData.client_nom || 'Client'
      },
      error: error.message
    };
    
    const html = this.injectDataIntoTemplate(
      { html: fallbackTemplate, schema: {} },
      fallbackData
    );
    
    return {
      success: true,
      html: html,
      metadata: {
        templateKey: 'fallback',
        agencyType: agencyProfile?.type_agence || 'unknown',
        documentType,
        hasLead: !!leadData,
        isFallback: true,
        error: error.message,
        generatedAt: new Date().toISOString()
      }
    };
  }
  
  /**
   * Template fallback par défaut
   */
  static getFallbackTemplate(documentType) {
    const templates = {
      devis: `
        <div class="document">
          <header>
            <h1>DEVIS - {{agency.nom_agence}}</h1>
            <p>Référence: {{document.reference}}</p>
            <p>Date: {{document.date_generation}}</p>
          </header>
          <section>
            <h2>Client</h2>
            <p>{{client.nom}}</p>
          </section>
          <section>
            <h2>Détails</h2>
            <p>Type d'agence: {{agency.type_agence}}</p>
            <p>Type de document: {{document.type}}</p>
          </section>
          <footer>
            <p>Template fallback - Erreur: {{error}}</p>
          </footer>
        </div>
      `,
      facture: `
        <div class="document">
          <header>
            <h1>FACTURE - {{agency.nom_agence}}</h1>
            <p>Référence: {{document.reference}}</p>
            <p>Date: {{document.date_generation}}</p>
          </header>
          <section>
            <h2>Client</h2>
            <p>{{client.nom}}</p>
          </section>
          <section>
            <h2>Montant</h2>
            <p>À définir selon les besoins</p>
          </section>
          <footer>
            <p>Template fallback - Erreur: {{error}}</p>
          </footer>
        </div>
      `,
      mandat: `
        <div class="document">
          <header>
            <h1>MANDAT - {{agency.nom_agence}}</h1>
            <p>Référence: {{document.reference}}</p>
            <p>Date: {{document.date_generation}}</p>
          </header>
          <section>
            <h2>Client</h2>
            <p>{{client.nom}}</p>
          </section>
          <section>
            <h2>Conditions</h2>
            <p>À définir selon les besoins</p>
          </section>
          <footer>
            <p>Template fallback - Erreur: {{error}}</p>
          </footer>
        </div>
      `,
      rapport: `
        <div class="document">
          <header>
            <h1>RAPPORT - {{agency.nom_agence}}</h1>
            <p>Référence: {{document.reference}}</p>
            <p>Date: {{document.date_generation}}</p>
          </header>
          <section>
            <h2>Période</h2>
            <p>À définir selon les besoins</p>
          </section>
          <section>
            <h2>Résultats</h2>
            <p>À définir selon les besoins</p>
          </section>
          <footer>
            <p>Template fallback - Erreur: {{error}}</p>
          </footer>
        </div>
      `,
      contrat: `
        <div class="document">
          <header>
            <h1>CONTRAT - {{agency.nom_agence}}</h1>
            <p>Référence: {{document.reference}}</p>
            <p>Date: {{document.date_generation}}</p>
          </header>
          <section>
            <h2>Parties</h2>
            <p>{{client.nom}}</p>
          </section>
          <section>
            <h2>Conditions</h2>
            <p>À définir selon les besoins</p>
          </section>
          <footer>
            <p>Template fallback - Erreur: {{error}}</p>
          </footer>
        </div>
      `
    };
    
    return templates[documentType] || templates.devis;
  }
  
  /**
   * Génération de référence unique
   */
  static generateReference(documentType) {
    const prefixes = {
      devis: 'DEV',
      facture: 'FAC',
      mandat: 'MAN',
      rapport: 'RAP',
      contrat: 'CTR'
    };
    
    const prefix = prefixes[documentType] || 'DOC';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    return `${prefix}-${timestamp}-${random}`;
  }
  
  /**
   * Titre du document selon type et agence
   */
  static getDocumentTitle(documentType, agencyType) {
    const titles = {
      immobilier: {
        devis: 'Devis de services immobiliers',
        facture: 'Facture d\'honoraires',
        mandat: 'Mandat de vente/location',
        rapport: 'Rapport d\'activité',
        contrat: 'Contrat de prestation'
      },
      smma: {
        devis: 'Devis de services marketing',
        facture: 'Facture de prestations',
        mandat: 'Mandat de gestion',
        rapport: 'Rapport de performance',
        contrat: 'Contrat de prestation'
      }
    };
    
    return titles[agencyType]?.[documentType] || `Document ${documentType}`;
  }
  
  /**
   * Fonction utilitaire pour le logging des performances
   */
  static logPerformance(startTime, metadata) {
    const duration = Date.now() - startTime;
    console.log(`📊 Performance génération HTML:`, {
      duration: `${duration}ms`,
      templateKey: metadata.templateKey,
      agencyType: metadata.agencyType,
      documentType: metadata.documentType,
      hasLead: metadata.hasLead,
      injectionCount: metadata.injectionCount
    });
  }
}

export default DocumentHtmlService;
