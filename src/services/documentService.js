import { supabase } from '../supabaseClient';

class DocumentService {
  // Créer une entrée document unifiée
  static async createDocument({
    leadId,
    agencyId,
    type,
    title,
    content,
    metadata = {},
    userId
  }) {
    try {
      // Récupérer la dernière version pour ce type de document et ce lead
      const { data: lastVersion } = await supabase
        .from('documents')
        .select('version')
        .eq('lead_id', leadId)
        .eq('type', type)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const newVersion = lastVersion ? lastVersion.version + 1 : 1;

      // Créer le document
      const { data: document, error } = await supabase
        .from('documents')
        .insert([{
          lead_id: leadId,
          agency_id: agencyId,
          type,
          title,
          content,
          metadata,
          version: newVersion,
          status: 'Généré',
          created_by: userId,
          updated_by: userId
        }])
        .select()
        .single();

      if (error) throw error;

      // Créer l'événement CRM associé
      await this.createCRMEvent({
        leadId,
        agencyId,
        type: 'document_generated',
        title: `📄 ${title} généré (v${newVersion})`,
        description: `Document "${type}" généré pour le lead`,
        metadata: {
          document_id: document.id,
          document_type: type,
          version: newVersion
        },
        userId
      });

      return document;
    } catch (error) {
      console.error('Erreur création document:', error);
      throw error;
    }
  }

  // Mettre à jour le statut d'un document
  static async updateDocumentStatus(documentId, status, userId) {
    try {
      const { data: document, error } = await supabase
        .from('documents')
        .update({
          status,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;

      // Créer l'événement CRM associé
      await this.createCRMEvent({
        leadId: document.lead_id,
        agencyId: document.agency_id,
        type: 'document_status_updated',
        title: `📄 ${document.title} - Statut: ${status}`,
        description: `Le document "${document.type}" est maintenant "${status}"`,
        metadata: {
          document_id: documentId,
          document_type: document.type,
          status,
          version: document.version
        },
        userId
      });

      return document;
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      throw error;
    }
  }

  // Créer un événement CRM
  static async createCRMEvent({
    leadId,
    agencyId,
    type,
    title,
    description,
    metadata = {},
    userId
  }) {
    try {
      const { error } = await supabase
        .from('crm_events')
        .insert([{
          lead_id: leadId,
          agency_id: agencyId,
          type,
          title,
          description,
          metadata,
          created_by: userId
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur création événement CRM:', error);
      throw error;
    }
  }

  // Récupérer tous les documents d'une agence
  static async getAgencyDocuments(agencyId, filters = {}) {
    try {
      let query = supabase
        .from('documents')
        .select(`
          *,
          leads!inner(
            id,
            nom,
            email,
            telephone,
            type_bien,
            budget
          )
        `)
        .eq('agency_id', agencyId);

      // Appliquer les filtres
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.leadId) {
        query = query.eq('lead_id', filters.leadId);
      }
      if (filters.dateRange) {
        const now = new Date();
        if (filters.dateRange === '7jours') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          query = query.gte('created_at', sevenDaysAgo.toISOString());
        } else if (filters.dateRange === '30jours') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          query = query.gte('created_at', thirtyDaysAgo.toISOString());
        }
      }

      const { data: documents, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;
      return documents || [];
    } catch (error) {
      console.error('Erreur récupération documents:', error);
      throw error;
    }
  }

  // Récupérer l'historique CRM d'un lead
  static async getLeadHistory(leadId, agencyId) {
    try {
      const { data: events, error } = await supabase
        .from('crm_events')
        .select('*')
        .eq('lead_id', leadId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return events || [];
    } catch (error) {
      console.error('Erreur récupération historique:', error);
      throw error;
    }
  }

  // Récupérer les documents d'un lead spécifique
  static async getLeadDocuments(leadId, agencyId) {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('lead_id', leadId)
        .eq('agency_id', agencyId)
        .order('version', { ascending: false });

      if (error) throw error;
      return documents || [];
    } catch (error) {
      console.error('Erreur récupération documents lead:', error);
      throw error;
    }
  }

  // Obtenir les statistiques de documents
  static async getDocumentStats(agencyId) {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('agency_id', agencyId);

      if (error) throw error;

      const stats = {
        total: documents?.length || 0,
        thisMonth: documents?.filter(doc => {
          const docDate = new Date(doc.created_at);
          const now = new Date();
          return docDate.getMonth() === now.getMonth() && docDate.getFullYear() === now.getFullYear();
        }).length || 0,
        thisWeek: documents?.filter(doc => {
          const docDate = new Date(doc.created_at);
          const now = new Date();
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          return docDate >= weekStart;
        }).length || 0,
        immo: documents?.filter(doc => 
          ['Bon de Visite', 'Mandat de Vente', 'Offre d\'Achat', 'Fiche Client', 'Compte-rendu'].includes(doc.type)
        ).length || 0,
        smma: documents?.filter(doc => 
          ['Devis Prestation', 'Contrat Service', 'Facture', 'Brief Onboarding'].includes(doc.type)
        ).length || 0,
        byStatus: {
          'Brouillon': documents?.filter(doc => doc.status === 'Brouillon').length || 0,
          'Généré': documents?.filter(doc => doc.status === 'Généré').length || 0,
          'Envoyé': documents?.filter(doc => doc.status === 'Envoyé').length || 0,
          'Signé': documents?.filter(doc => doc.status === 'Signé').length || 0
        }
      };

      return stats;
    } catch (error) {
      console.error('Erreur statistiques:', error);
      throw error;
    }
  }
}

export default DocumentService;
