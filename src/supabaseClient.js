import { createClient } from '@supabase/supabase-js'

// Configuration Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fonctions utilitaires pour l'authentification
export const auth = {
  // Inscription avec création d'agence
  signUp: async (email, password, agencyName) => {
    try {
      // 1. Créer l'utilisateur dans auth.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      // 2. Créer l'agence
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .insert([{ nom_agence: agencyName, plan: 'starter' }])
        .select()
        .single()

      if (agencyError) throw agencyError

      // 3. Créer le profil utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          user_id: authData.user.id,
          agency_id: agencyData.id,
          email: email,
          role: 'admin',
          nom_complet: agencyName
        }])
        .select()
        .single()

      if (profileError) throw profileError

      return { success: true, user: authData.user, profile: profileData }
    } catch (error) {
      console.error('Erreur inscription:', error)
      return { success: false, error: error.message }
    }
  },

  // Connexion
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Récupérer le profil de l'utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, agencies(*)')
        .eq('user_id', data.user.id)
        .single()

      if (profileError) throw profileError

      return { success: true, user: data.user, profile }
    } catch (error) {
      console.error('Erreur connexion:', error)
      return { success: false, error: error.message }
    }
  },

  // Déconnexion
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Erreur déconnexion:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir l'utilisateur actuel
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error

      if (!user) return { user: null, profile: null }

      // Récupérer le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, agencies(*)')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError

      return { user, profile }
    } catch (error) {
      console.error('Erreur getCurrentUser:', error)
      return { user: null, profile: null, error }
    }
  },

  // Écouter les changements d'authentification
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Fonctions pour les leads
export const leads = {
  // Récupérer tous les leads de l'agence
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          interactions (
            id,
            type_action,
            details,
            date
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur getAll leads:', error)
      return { success: false, error: error.message }
    }
  },

  // Créer un nouveau lead
  create: async (leadData) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur create lead:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour un lead
  update: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur update lead:', error)
      return { success: false, error: error.message }
    }
  }
}

// Fonctions pour les interactions
export const interactions = {
  // Ajouter une interaction
  create: async (interactionData) => {
    try {
      const { data, error } = await supabase
        .from('interactions')
        .insert([interactionData])
        .select()
        .single()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Erreur create interaction:', error)
      return { success: false, error: error.message }
    }
  }
}

export default supabase
