import { createClient } from '@supabase/supabase-js'

// 🎯 CLIENT SUPABASE GLOBAL UNIQUE
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validation des variables d'environnement
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERREUR CRITIQUE: Variables Supabase manquantes!')
  console.error('Veuillez configurer VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
  throw new Error('Configuration Supabase manquante')
}

// 🎯 UN SEUL CLIENT SUPABASE POUR TOUTE L'APPLICATION
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 🎯 SERVICES D'AUTHENTIFICATION SÉCURISÉS
export const auth = {
  signUp: async (email, password, agencyName) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .insert([{ nom_agence: agencyName, plan: 'starter' }])
        .select()
        .single()

      if (agencyError) throw agencyError

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

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

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

  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error

      if (!user) return { user: null, profile: null }

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

  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// 🎯 EXPORT PAR DÉFAUT
export default supabase
