// Configuration Supabase pour LeadQualif IA
import { createClient } from '@supabase/supabase-js'

// Configuration de l'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://votre-projet.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'votre-cle-anon'

// Création du client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fonctions utilitaires pour la gestion des leads
export const leadsService = {
  // Sauvegarder un lead dans Supabase
  async saveLead(leadData) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          nom: leadData.nom,
          email: leadData.email,
          telephone: leadData.telephone,
          message: leadData.message || '',
          source: 'site_web',
          score_qualification: leadData.score_qualification || 0,
          budget_estime: leadData.budget || '',
          urgence: leadData.urgence || 'moyenne',
          type_bien_recherche: leadData.type_bien || '',
          localisation_souhaitee: leadData.adresse || '',
          qualification_data: leadData.qualification_data || {},
          created_at: new Date().toISOString()
        }])
        .select()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du lead:', error)
      return { success: false, error: error.message }
    }
  },

  // Récupérer tous les leads
  async getAllLeads() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur lors de la récupération des leads:', error)
      return { success: false, error: error.message }
    }
  },

  // Récupérer les leads chauds (score >= 8)
  async getHotLeads() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .gte('score_qualification', 8)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur lors de la récupération des leads chauds:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour un lead
  async updateLead(id, updateData) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .select()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du lead:', error)
      return { success: false, error: error.message }
    }
  }
}

export default supabase
