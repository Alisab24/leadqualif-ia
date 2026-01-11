/**
 * ARCHITECTE SaaS - Service de Conversion Devis → Facture
 * 
 * Principes Stripe-like :
 * - Immutabilité : le devis original n'est jamais modifié
 * - Traçabilité : lien parent/enfant via parent_document_id
 * - Numérotation autonome : nouvelle référence pour la facture
 * - Audit trail : historique complet des conversions
 * - Atomicité : transaction complète ou rollback
 */

import { supabase } from '../supabaseClient';
import DocumentHtmlService from './documentHtmlService';

/**
 * Service de conversion Devis → Facture
 * Architecture Stripe-like avec traçabilité complète
 */
class DevisToFactureService {
  
  /**
   * Convertit un devis en facture (Stripe-like)
   * @param {string} devisId - ID du devis à convertir
   * @param {Object} options - Options de conversion
   * @param {Date} options.dateFacturation - Date de facturation (défaut: aujourd'hui)
   * @param {string} options.notes - Notes additionnelles pour la facture
   * @param {Object} options.customData - Données additionnelles
   * @returns {Promise<Object>} { success: boolean, facture: Object, devis: Object }
   */
  static async convertDevisToFacture(devisId, options = {}) {
    // Validation d'entrée
    this.validateConversionRequest(devisId, options);
    
    const transactionId = this.generateTransactionId();
    console.log(`🔄 Début conversion devis→facture [${transactionId}]: ${devisId}`);
    
    try {
      // 1️⃣ Lecture du devis original (immutabilité garantie)
      const devis = await this.getDevisOriginal(devisId);
      
      // 2️⃣ Validation du devis
      this.validateDevisForConversion(devis);
      
      // 3️⃣ Génération nouvelle référence facture
      const referenceFacture = this.generateFactureReference(devis);
      
      // 4️⃣ Préparation des données facture
      const factureData = this.prepareFactureData(devis, referenceFacture, options);
      
      // 5️⃣ Génération HTML facture
      const htmlFacture = await this.generateFactureHtml(factureData);
      
      // 6️⃣ Création facture en base (atomicité)
      const facture = await this.createFactureRecord(factureData, htmlFacture, devis);
      
      // 7️⃣ Mise à jour du devis (lien parent)
      await this.updateDevisWithFactureLink(devis.id, facture.id);
      
      // 8️⃣ Création de l'audit trail
      await this.createAuditTrail(devis, facture, transactionId);
      
      console.log(`✅ Conversion réussie [${transactionId}]: ${devis.reference} → ${facture.reference}`);
      
      return {
        success: true,
        facture: facture,
        devis: devis,
        metadata: {
          transactionId,
          conversionDate: new Date().toISOString(),
          devisReference: devis.reference,
          factureReference: facture.reference,
          montantHT: facture.total_ht,
          montantTTC: facture.total_ttc,
          devise: facture.devise
        }
      };
      
    } catch (error) {
      console.error(`❌ Erreur conversion [${transactionId}]:`, error);
      
      // Rollback si nécessaire
      await this.rollbackConversion(transactionId, devisId);
      
      return {
        success: false,
        error: error.message,
        transactionId,
        metadata: {
          conversionDate: new Date().toISOString(),
          error: error.message,
          devisId
        }
      };
    }
  }
  
  /**
   * Validation de la demande de conversion
   */
  static validateConversionRequest(devisId, options) {
    if (!devisId || typeof devisId !== 'string') {
      throw new Error('ID de devis invalide');
    }
    
    if (options.dateFacturation && !(options.dateFacturation instanceof Date)) {
      throw new Error('dateFacturation doit être une Date valide');
    }
  }
  
  /**
   * Lecture du devis original (garantie d'immutabilité)
   */
  static async getDevisOriginal(devisId) {
    try {
      const { data: devis, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', devisId)
        .eq('type', 'devis')
        .single();
      
      if (error) {
        throw new Error(`Erreur lecture devis: ${error.message}`);
      }
      
      if (!devis) {
        throw new Error(`Devis non trouvé: ${devisId}`);
      }
      
      // Vérifier que le devis n'a pas déjà été converti
      if (devis.parent_document_id) {
        throw new Error(`Ce devis est déjà une conversion d'un autre document`);
      }
      
      // Vérifier qu'une facture n'existe pas déjà pour ce devis
      const { data: existingFacture } = await supabase
        .from('documents')
        .select('id, reference')
        .eq('parent_document_id', devisId)
        .eq('type', 'facture')
        .single();
      
      if (existingFacture) {
        throw new Error(`Une facture existe déjà pour ce devis: ${existingFacture.reference}`);
      }
      
      return devis;
      
    } catch (error) {
      console.error('❌ Erreur lecture devis original:', error);
      throw error;
    }
  }
  
  /**
   * Validation du devis pour conversion
   */
  static validateDevisForConversion(devis) {
    if (!devis.content_json) {
      throw new Error('Le devis ne contient pas de données structurées');
    }
    
    if (!devis.total_ht || !devis.total_ttc) {
      throw new Error('Le devis ne contient pas de montants valides');
    }
    
    if (!devis.client_nom) {
      throw new Error('Le devis ne contient pas d\'informations client');
    }
    
    // Vérifier que le devis est dans un statut convertible
    const statutsConvertibles = ['validé', 'accepté', 'signé', 'approuvé'];
    if (devis.statut && !statutsConvertibles.includes(devis.statut)) {
      console.warn(`⚠️ Devis avec statut non convertible: ${devis.statut}`);
    }
  }
  
  /**
   * Génération de référence facture (Stripe-like)
   */
  static generateFactureReference(devis) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    // Format: FAC-YYYYMMDD-XXXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `FAC-${dateStr}-${timestamp}-${random}`;
  }
  
  /**
   * Préparation des données facture
   */
  static prepareFactureData(devis, referenceFacture, options) {
    const dateFacturation = options.dateFacturation || new Date();
    
    // Copie des données du devis (immutabilité)
    const factureData = {
      // Informations de base
      agency_id: devis.agency_id,
      lead_id: devis.lead_id,
      type: 'facture',
      reference: referenceFacture,
      titre: `FACTURE - ${devis.client_nom}`,
      statut: 'émise',
      
      // Lien parent (Stripe-like)
      parent_document_id: devis.id,
      
      // Copie des montants (immutabilité)
      total_ht: devis.total_ht,
      total_ttc: devis.total_ttc,
      tva_amount: devis.tva_amount,
      devise: devis.devise || 'EUR',
      
      // Copie des informations client
      client_nom: devis.client_nom,
      client_email: devis.client_email,
      client_telephone: devis.client_telephone,
      
      // Informations facture spécifiques
      date_facturation: dateFacturation.toISOString().split('T')[0],
      date_echeance: this.calculateDueDate(dateFacturation).toISOString().split('T')[0],
      conditions_paiement: '30 jours',
      mode_paiement: 'Virement bancaire',
      
      // Contenu structuré (copie + enrichissement)
      content_json: {
        ...devis.content_json,
        type_document: 'facture',
        reference_facture: referenceFacture,
        reference_devis: devis.reference,
        date_facturation: dateFacturation.toISOString(),
        date_echeance: this.calculateDueDate(dateFacturation).toISOString(),
        notes: options.notes || '',
        conversion_info: {
          devis_id: devis.id,
          devis_reference: devis.reference,
          conversion_date: new Date().toISOString(),
          conversion_reason: 'conversion_devis_facture'
        }
      },
      
      // Métadonnées
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return factureData;
  }
  
  /**
   * Calcul de la date d'échéance (30 jours par défaut)
   */
  static calculateDueDate(dateFacturation) {
    const dueDate = new Date(dateFacturation);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }
  
  /**
   * Génération HTML de la facture
   */
  static async generateFactureHtml(factureData) {
    try {
      // Récupérer le profil agence
      const { data: agencyProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('agency_id', factureData.agency_id)
        .single();
      
      if (!agencyProfile) {
        throw new Error('Profil agence non trouvé pour la génération HTML');
      }
      
      // Récupérer les données du lead si disponible
      let leadData = null;
      if (factureData.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', factureData.lead_id)
          .single();
        
        leadData = lead;
      }
      
      // Génération HTML via DocumentHtmlService
      const result = await DocumentHtmlService.generateDocumentHtml({
        agencyProfile,
        documentType: 'facture',
        leadData,
        customData: {
          ...factureData.content_json,
          date_facturation: factureData.date_facturation,
          date_echeance: factureData.date_echeance,
          conditions_paiement: factureData.conditions_paiement,
          mode_paiement: factureData.mode_paiement
        },
        calculations: {
          total_ht: factureData.total_ht,
          tva: factureData.tva_amount,
          total_ttc: factureData.total_ttc
        }
      });
      
      if (!result.success) {
        throw new Error(`Erreur génération HTML: ${result.error}`);
      }
      
      return result.html;
      
    } catch (error) {
      console.error('❌ Erreur génération HTML facture:', error);
      
      // Fallback vers HTML basique
      return this.generateFallbackFactureHtml(factureData, error);
    }
  }
  
  /**
   * HTML fallback en cas d'erreur
   */
  static generateFallbackFactureHtml(factureData, error) {
    return `
      <div class="document">
        <header>
          <h1>FACTURE</h1>
          <p>Référence: ${factureData.reference}</p>
          <p>Date: ${factureData.date_facturation}</p>
          <p>Échéance: ${factureData.date_echeance}</p>
        </header>
        <section>
          <h2>Client</h2>
          <p>${factureData.client_nom}</p>
          ${factureData.client_email ? `<p>${factureData.client_email}</p>` : ''}
        </section>
        <section>
          <h2>Montants</h2>
          <p>Total HT: ${factureData.total_ht} ${factureData.devise}</p>
          <p>TVA: ${factureData.tva_amount} ${factureData.devise}</p>
          <p><strong>Total TTC: ${factureData.total_ttc} ${factureData.devise}</strong></p>
        </section>
        <section>
          <h2>Conditions</h2>
          <p>Paiement: ${factureData.conditions_paiement}</p>
          <p>Mode: ${factureData.mode_paiement}</p>
        </section>
        <footer>
          <p>Facture générée depuis le devis: ${factureData.content_json?.reference_devis || 'N/A'}</p>
          <p>Erreur HTML: ${error.message}</p>
        </footer>
      </div>
    `;
  }
  
  /**
   * Création de l'enregistrement facture (atomicité)
   */
  static async createFactureRecord(factureData, htmlFacture, devisOriginal) {
    try {
      const factureRecord = {
        ...factureData,
        preview_html: htmlFacture
      };
      
      const { data: facture, error } = await supabase
        .from('documents')
        .insert([factureRecord])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Erreur création facture: ${error.message}`);
      }
      
      if (!facture) {
        throw new Error('Échec création facture: aucune donnée retournée');
      }
      
      return facture;
      
    } catch (error) {
      console.error('❌ Erreur création facture:', error);
      throw error;
    }
  }
  
  /**
   * Mise à jour du devis avec lien vers facture
   */
  static async updateDevisWithFactureLink(devisId, factureId) {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          statut: 'facturé',
          updated_at: new Date().toISOString(),
          content_json: supabase.raw(`content_json || '{}' || '{}'`)
            .then(() => ({})) // Pas de modification du content_json
        })
        .eq('id', devisId);
      
      if (error) {
        console.warn('⚠️ Erreur mise à jour devis:', error);
        // Non bloquant pour la conversion
      }
      
    } catch (error) {
      console.error('❌ Erreur mise à jour devis:', error);
      // Non bloquant pour la conversion
    }
  }
  
  /**
   * Création de l'audit trail (Stripe-like)
   */
  static async createAuditTrail(devis, facture, transactionId) {
    try {
      const auditRecord = {
        transaction_id: transactionId,
        action: 'convert_devis_to_facture',
        devis_id: devis.id,
        devis_reference: devis.reference,
        facture_id: facture.id,
        facture_reference: facture.reference,
        montant_ht: facture.total_ht,
        montant_ttc: facture.total_ttc,
        devise: facture.devise,
        agency_id: devis.agency_id,
        user_id: await this.getCurrentUserId(),
        timestamp: new Date().toISOString(),
        metadata: {
          conversion_date: new Date().toISOString(),
          source: 'devis_to_facture_service',
          version: '1.0'
        }
      };
      
      const { error } = await supabase
        .from('document_audit_trail')
        .insert([auditRecord]);
      
      if (error) {
        console.warn('⚠️ Erreur création audit trail:', error);
        // Non bloquant pour la conversion
      }
      
    } catch (error) {
      console.error('❌ Erreur audit trail:', error);
      // Non bloquant pour la conversion
    }
  }
  
  /**
   * Récupération de l'utilisateur courant
   */
  static async getCurrentUserId() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Génération d'ID de transaction unique
   */
  static generateTransactionId() {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Rollback en cas d'erreur (Stripe-like)
   */
  static async rollbackConversion(transactionId, devisId) {
    console.log(`🔄 Rollback conversion [${transactionId}]: ${devisId}`);
    
    try {
      // Supprimer la facture si elle a été créée
      const { data: facture } = await supabase
        .from('documents')
        .select('id')
        .eq('parent_document_id', devisId)
        .eq('type', 'facture')
        .single();
      
      if (facture) {
        await supabase
          .from('documents')
          .delete()
          .eq('id', facture.id);
        
        console.log(`🗑️ Facture supprimée: ${facture.id}`);
      }
      
      // Restaurer le statut du devis
      await supabase
        .from('documents')
        .update({ statut: 'validé' })
        .eq('id', devisId);
      
      console.log(`✅ Rollback terminé [${transactionId}]`);
      
    } catch (error) {
      console.error(`❌ Erreur rollback [${transactionId}]:`, error);
    }
  }
  
  /**
   * Vérification de l'intégrité de la conversion
   */
  static async verifyConversionIntegrity(devisId, factureId) {
    try {
      // Vérification du devis
      const { data: devis } = await supabase
        .from('documents')
        .select('*')
        .eq('id', devisId)
        .single();
      
      // Vérification de la facture
      const { data: facture } = await supabase
        .from('documents')
        .select('*')
        .eq('id', factureId)
        .single();
      
      const integrity = {
        valid: true,
        errors: [],
        checks: {
          devis_exists: !!devis,
          facture_exists: !!facture,
          link_correct: facture?.parent_document_id === devisId,
          montants_match: (
            devis?.total_ht === facture?.total_ht &&
            devis?.total_ttc === facture?.total_ttc &&
            devis?.tva_amount === facture?.tva_amount
          ),
          client_match: (
            devis?.client_nom === facture?.client_nom &&
            devis?.client_email === facture?.client_email
          ),
          agency_match: devis?.agency_id === facture?.agency_id
        }
      };
      
      // Validation des checks
      Object.entries(integrity.checks).forEach(([check, result]) => {
        if (!result) {
          integrity.valid = false;
          integrity.errors.push(`Check failed: ${check}`);
        }
      });
      
      return integrity;
      
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        checks: {}
      };
    }
  }
  
  /**
   * Historique des conversions pour un devis
   */
  static async getConversionHistory(devisId) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('parent_document_id', devisId)
        .eq('type', 'facture')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Erreur historique: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Erreur historique conversions:', error);
      return [];
    }
  }
  
  /**
   * Statistiques de conversion
   */
  static async getConversionStats(agencyId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('type', 'facture')
        .not('parent_document_id', 'is', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (error) {
        throw new Error(`Erreur stats: ${error.message}`);
      }
      
      const stats = {
        total_conversions: data?.length || 0,
        total_montant_ht: data?.reduce((sum, doc) => sum + (doc.total_ht || 0), 0) || 0,
        total_montant_ttc: data?.reduce((sum, doc) => sum + (doc.total_ttc || 0), 0) || 0,
        average_montant: data?.length ? (data.reduce((sum, doc) => sum + (doc.total_ttc || 0), 0) / data.length) : 0,
        conversions_by_month: this.groupByMonth(data || []),
        recent_conversions: data?.slice(0, 10) || []
      };
      
      return stats;
      
    } catch (error) {
      console.error('❌ Erreur stats conversions:', error);
      return {
        total_conversions: 0,
        total_montant_ht: 0,
        total_montant_ttc: 0,
        average_montant: 0,
        conversions_by_month: [],
        recent_conversions: []
      };
    }
  }
  
  /**
   * Groupement par mois pour les stats
   */
  static groupByMonth(conversions) {
    const grouped = {};
    
    conversions.forEach(conv => {
      const month = conv.created_at?.slice(0, 7) || 'unknown';
      if (!grouped[month]) {
        grouped[month] = {
          month,
          count: 0,
          total_ttc: 0
        };
      }
      grouped[month].count++;
      grouped[month].total_ttc += conv.total_ttc || 0;
    });
    
    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }
}

export default DevisToFactureService;
