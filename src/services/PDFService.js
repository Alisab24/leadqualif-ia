import { PDFGenerator } from './PDFGenerator'

class PDFService {
  constructor() {
    this.generator = new PDFGenerator()
  }

  async generateDocument(type, leadId, agencyId) {
    try {
      const result = await this.generator.generatePDF(type, leadId, agencyId)
      
      // Mettre à jour le statut du document en base de données
      if (result.success) {
        await this.updateDocumentStatus(leadId, agencyId, type, 'Envoyé', result.url)
      }
      
      return result
    } catch (error) {
      console.error('Erreur génération document:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async updateDocumentStatus(leadId, agencyId, type, status, fileUrl = null) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          status: status,
          file_url: fileUrl,
          updated_at: new Date()
        })
        .eq('lead_id', leadId)
        .eq('agency_id', agencyId)
        .eq('type', type)
      
      if (error) throw error
      
      console.log(`Document ${type} mis à jour: ${status}`)
    } catch (error) {
      console.error('Erreur mise à jour document:', error)
    }
  }

  async getDocuments(leadId) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erreur récupération documents:', error)
      return []
    }
  }

  // Méthodes pour chaque type de document
  async generateMandatVente(leadId, agencyId) {
    return this.generateDocument('mandat_vente', leadId, agencyId)
  }

  async generateBonVisite(leadId, agencyId) {
    return this.generateDocument('bon_visite', leadId, agencyId)
  }

  async generateOffreAchat(leadId, agencyId) {
    return this.generateDocument('offre_achat', leadId, agencyId)
  }

  async generateFicheClientImmo(leadId, agencyId) {
    return this.generateDocument('fiche_client_immo', leadId, agencyId)
  }

  async generateDevisSMA(leadId, agencyId) {
    return this.generateDocument('devis_sma', leadId, agencyId)
  }

  async generateContratPrestation(leadId, agencyId) {
    return this.generateDocument('contrat_prestation', leadId, agencyId)
  }

  async generateFactureSMA(leadId, agencyId) {
    return this.generateDocument('facture_sma', leadId, agencyId)
  }
}

export default PDFService
