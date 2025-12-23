import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Créer un client Supabase même si les variables ne sont pas définies
// Cela permet à l'app de démarrer, mais les appels API échoueront avec un message clair
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Fonctions pour gérer les leads
export const leadsService = {
  // Récupérer tous les leads
  async getAllLeads() {
    if (!supabase) {
      console.warn('Supabase non configuré. Veuillez définir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre fichier .env')
      return []
    }
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Récupérer un lead par ID
  async getLeadById(id) {
    if (!supabase) {
      throw new Error('Supabase non configuré')
    }
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Créer un nouveau lead
  async createLead(leadData) {
    if (!supabase) {
      throw new Error('Supabase non configuré')
    }
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mettre à jour un lead
  async updateLead(id, updates) {
    if (!supabase) {
      throw new Error('Supabase non configuré')
    }
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Supprimer un lead
  async deleteLead(id) {
    if (!supabase) {
      throw new Error('Supabase non configuré')
    }
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}
