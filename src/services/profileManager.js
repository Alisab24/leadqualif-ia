/**
 * 🛡️ PROFILE MANAGER - Production-Ready Profile Management
 * 
 * Gestion robuste des profils utilisateurs avec protection contre les null
 * et stratégie de récupération automatique ou blocage contrôlé.
 */

import { supabase } from '../supabaseClient';

/**
 * Service centralisé de gestion des profils avec protection robuste
 */
class ProfileManager {
  
  /**
   * Récupérer le profil utilisateur avec gestion d'erreurs complète
   * @param {string} userId - ID de l'utilisateur authentifié
   * @param {Object} options - Options de récupération
   * @returns {Promise<{success: boolean, profile: Object|null, error: string|null, action: string}>}
   */
  static async getUserProfile(userId, options = {}) {
    const {
      createIfMissing = false,    // Créer automatiquement si non trouvé
      useFallback = true,         // Utiliser un profil fallback si non trouvé
      fallbackProfile = null,     // Profil fallback personnalisé
      required = ['agency_id'],    // Champs obligatoires
      verbose = true              // Logging détaillé
    } = options;

    if (!userId) {
      const error = '❌ ProfileManager.getUserProfile(): userId est requis';
      if (verbose) console.error(error);
      return {
        success: false,
        profile: null,
        error,
        action: 'invalid_input'
      };
    }

    try {
      if (verbose) console.log(`🔍 ProfileManager: Récupération profil pour user_id: ${userId}`);

      // 🎯 ÉTAPE 1: Tentative de récupération avec maybeSingle (pas d'erreur si non trouvé)
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // ✅ maybeSingle au lieu de single

      // 🎯 ÉTAPE 2: Gestion des différents cas
      if (fetchError) {
        if (verbose) console.error('❌ ProfileManager: Erreur requête profil:', fetchError);
        return await this.handleFetchError(userId, fetchError, options);
      }

      if (!profile) {
        if (verbose) console.warn('⚠️ ProfileManager: Profil non trouvé pour user_id:', userId);
        return await this.handleMissingProfile(userId, options);
      }

      // 🎯 ÉTAPE 3: Validation des champs requis
      const validation = this.validateProfile(profile, required);
      if (!validation.valid) {
        if (verbose) console.warn('⚠️ ProfileManager: Profil invalide:', validation.errors);
        return await this.handleInvalidProfile(userId, profile, validation, options);
      }

      if (verbose) console.log('✅ ProfileManager: Profil récupéré avec succès:', {
        user_id: profile.user_id,
        agency_id: profile.agency_id,
        nom_agence: profile.nom_agence
      });

      return {
        success: true,
        profile,
        error: null,
        action: 'profile_found'
      };

    } catch (error) {
      const errorMsg = `❌ ProfileManager: Erreur inattendue: ${error.message}`;
      if (verbose) console.error(errorMsg, error);
      return {
        success: false,
        profile: null,
        error: errorMsg,
        action: 'unexpected_error'
      };
    }
  }

  /**
   * Gérer les erreurs de fetch
   */
  static async handleFetchError(userId, fetchError, options) {
    const { verbose = true } = options;

    // Erreur de connexion ou permission
    if (fetchError.code === 'PGRST301' || fetchError.code === 'PGRST116') {
      return {
        success: false,
        profile: null,
        error: `Erreur de permission: ${fetchError.message}`,
        action: 'permission_error'
      };
    }

    // Erreur réseau ou serveur
    if (fetchError.code === 'NETWORK_ERROR' || fetchError.code === '503') {
      if (options.useFallback) {
        const fallbackProfile = this.createFallbackProfile(userId);
        if (verbose) console.warn('⚠️ ProfileManager: Utilisation fallback suite à erreur réseau');
        return {
          success: true,
          profile: fallbackProfile,
          error: `Erreur réseau, utilisation fallback: ${fetchError.message}`,
          action: 'fallback_used'
        };
      }
    }

    return {
      success: false,
      profile: null,
      error: `Erreur fetch profil: ${fetchError.message}`,
      action: 'fetch_error'
    };
  }

  /**
   * Gérer les profils manquants
   */
  static async handleMissingProfile(userId, options) {
    const { 
      createIfMissing = false, 
      useFallback = true, 
      fallbackProfile = null,
      verbose = true 
    } = options;

    // 🎯 STRATÉGIE 1: Création automatique
    if (createIfMissing) {
      try {
        const newProfile = await this.createProfile(userId);
        if (verbose) console.log('✅ ProfileManager: Profil créé automatiquement:', newProfile);
        return {
          success: true,
          profile: newProfile,
          error: null,
          action: 'profile_created'
        };
      } catch (createError) {
        if (verbose) console.error('❌ ProfileManager: Échec création profil:', createError);
        // Continuer vers fallback si échec
      }
    }

    // 🎯 STRATÉGIE 2: Fallback personnalisé
    if (fallbackProfile) {
      const enhancedFallback = {
        user_id: userId,
        agency_id: fallbackProfile.agency_id || 'default',
        nom_agence: fallbackProfile.nom_agence || 'Agence par défaut',
        type_agence: fallbackProfile.type_agence || 'immobilier',
        ...fallbackProfile
      };
      
      if (verbose) console.log('✅ ProfileManager: Utilisation fallback personnalisé');
      return {
        success: true,
        profile: enhancedFallback,
        error: 'Profil non trouvé, utilisation fallback personnalisé',
        action: 'custom_fallback'
      };
    }

    // 🎯 STRATÉGIE 3: Fallback par défaut
    if (useFallback) {
      const defaultFallback = this.createFallbackProfile(userId);
      if (verbose) console.log('✅ ProfileManager: Utilisation fallback par défaut');
      return {
        success: true,
        profile: defaultFallback,
        error: 'Profil non trouvé, utilisation fallback par défaut',
        action: 'default_fallback'
      };
    }

    // 🎯 STRATÉGIE 4: Blocage contrôlé
    return {
      success: false,
      profile: null,
      error: 'Profil utilisateur non trouvé et aucune stratégie de récupération',
      action: 'blocked'
    };
  }

  /**
   * Gérer les profils invalides
   */
  static async handleInvalidProfile(userId, profile, validation, options) {
    const { verbose = true } = options;

    // 🎯 STRATÉGIE 1: Tentative de réparation automatique
    if (validation.repairable) {
      try {
        const repairedProfile = await this.repairProfile(userId, profile, validation.missing);
        if (verbose) console.log('✅ ProfileManager: Profil réparé automatiquement');
        return {
          success: true,
          profile: repairedProfile,
          error: 'Profil réparé automatiquement',
          action: 'profile_repaired'
        };
      } catch (repairError) {
        if (verbose) console.error('❌ ProfileManager: Échec réparation profil:', repairError);
      }
    }

    // 🎯 STRATÉGIE 2: Fallback avec préservation
    const fallbackProfile = this.createFallbackProfile(userId, profile);
    if (verbose) console.log('✅ ProfileManager: Utilisation fallback avec préservation');
    return {
      success: true,
      profile: fallbackProfile,
      error: `Profil invalide, utilisation fallback: ${validation.errors.join(', ')}`,
      action: 'invalid_fallback'
    };
  }

  /**
   * Créer un nouveau profil utilisateur
   */
  static async createProfile(userId) {
    // D'abord, créer une agence si nécessaire
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .insert([{ 
        nom_agence: `Agence de ${userId}`,
        plan: 'starter' 
      }])
      .select()
      .single();

    if (agencyError) throw new Error(`Erreur création agence: ${agencyError.message}`);

    // Ensuite, créer le profil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([{
        user_id: userId,
        agency_id: agency.id,
        nom_agence: agency.nom_agence,
        type_agence: 'immobilier',
        plan: 'starter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (profileError) throw new Error(`Erreur création profil: ${profileError.message}`);

    return profile;
  }

  /**
   * Réparer un profil incomplet
   */
  static async repairProfile(userId, profile, missingFields) {
    const updates = {};
    
    // Créer une agence si manquante
    if (missingFields.includes('agency_id')) {
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert([{ 
          nom_agence: profile.nom_agence || `Agence de ${userId}`,
          plan: 'starter' 
        }])
        .select()
        .single();

      if (agencyError) throw new Error(`Erreur création agence: ${agencyError.message}`);
      updates.agency_id = agency.id;
    }

    // Ajouter les autres champs manquants
    if (missingFields.includes('nom_agence')) {
      updates.nom_agence = profile.nom_agence || `Agence de ${userId}`;
    }
    if (missingFields.includes('type_agence')) {
      updates.type_agence = profile.type_agence || 'immobilier';
    }

    updates.updated_at = new Date().toISOString();

    const { data: repairedProfile, error: repairError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (repairError) throw new Error(`Erreur réparation profil: ${repairError.message}`);

    return repairedProfile;
  }

  /**
   * Valider un profil
   */
  static validateProfile(profile, required = ['agency_id']) {
    const errors = [];
    const missing = [];

    for (const field of required) {
      if (!profile[field]) {
        errors.push(`Champ requis manquant: ${field}`);
        missing.push(field);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      missing,
      repairable: missing.length > 0 && missing.includes('agency_id')
    };
  }

  /**
   * Créer un profil fallback
   */
  static createFallbackProfile(userId, existingProfile = null) {
    return {
      user_id: userId,
      agency_id: existingProfile?.agency_id || 'default',
      nom_agence: existingProfile?.nom_agence || 'Agence par défaut',
      type_agence: existingProfile?.type_agence || 'immobilier',
      plan: existingProfile?.plan || 'starter',
      devise: existingProfile?.devise || 'EUR',
      mentions_legales: existingProfile?.mentions_legales || 'Document généré via NexaPro',
      adresse_legale: existingProfile?.adresse_legale || '—',
      telephone: existingProfile?.telephone || '—',
      email: existingProfile?.email || '—',
      created_at: existingProfile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _isFallback: true, // Marquer comme fallback pour tracking
      _originalProfile: existingProfile // Garder l'original pour référence
    };
  }

  /**
   * Vérifier si un profil est un fallback
   */
  static isFallbackProfile(profile) {
    return profile?._isFallback === true;
  }

  /**
   * Obtenir l'agency_id sécurisé
   */
  static getSafeAgencyId(profile) {
    if (!profile) return null;
    return profile.agency_id || 'default';
  }

  /**
   * Wrapper pour les composants React (à utiliser dans un fichier .jsx séparé)
   */
  static createUseProfileHook() {
    // Cette méthode doit être appelée depuis un fichier .jsx
    // car elle utilise React hooks
    throw new Error('useProfile hook doit être utilisé dans un composant React (.jsx)');
  }

  /**
   * Wrapper pour les composants React (à utiliser dans un fichier .jsx séparé)
   */
  static createWithProfileProtection() {
    // Cette méthode doit être appelée depuis un fichier .jsx
    // car elle utilise JSX
    throw new Error('withProfileProtection doit être utilisé dans un composant React (.jsx)');
  }
}

export default ProfileManager;
