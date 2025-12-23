import { createContext, useContext, useState } from 'react'

/**
 * Context pour gérer le store global des leads
 * Solution temporaire simple sans base de données
 */
const LeadsContext = createContext()

/**
 * Provider pour le store des leads
 * Stocke les leads en mémoire (temporaire, sera remplacé par Supabase plus tard)
 */
export function LeadsProvider({ children }) {
  const [leads, setLeads] = useState([])

  /**
   * Ajoute un nouveau lead au store
   * @param {Object} leadData - Les données du lead à ajouter
   * @param {string} leadData.nom - Nom du prospect
   * @param {string} leadData.email - Email du prospect
   * @param {string} leadData.budget - Budget (optionnel)
   * @param {string} leadData.typeBien - Type de bien recherché (optionnel)
   * @param {string} leadData.delai - Délai d'achat (optionnel)
   * @param {number} leadData.score - Score de qualification (0-100)
   * @param {string} leadData.niveau - Niveau (chaud/tiède/froid)
   * @param {string} leadData.action - Action recommandée
   */
  const addLead = (leadData) => {
    console.log('[LEADS CONTEXT] addLead appelé avec:', leadData)
    
    const newLead = {
      id: Date.now().toString(), // ID temporaire basé sur timestamp
      created_at: new Date().toISOString(),
      nom: leadData.nom || '',
      email: leadData.email || '',
      budget: leadData.budget || '',
      typeBien: leadData.typeBien || '',
      delai: leadData.delai || '',
      score: leadData.score || 0,
      niveau: leadData.niveau || 'froid',
      action: leadData.action || leadData.action_recommandee || 'Aucune action spécifiée'
    }

    console.log('[LEADS CONTEXT] Nouveau lead créé:', newLead)

    // Ajouter le lead au début de la liste (plus récent en premier)
    setLeads(prev => {
      const updated = [newLead, ...prev]
      console.log('[LEADS CONTEXT] Liste mise à jour. Total de leads:', updated.length)
      return updated
    })
    
    return newLead
  }

  // Créer l'objet value de manière stable pour éviter les re-renders inutiles
  // mais permettre les mises à jour quand leads change
  const value = {
    leads,
    addLead
  }

  // Log pour déboguer
  console.log('[LEADS CONTEXT] État actuel du store:', {
    nombreLeads: leads.length,
    leads: leads,
    timestamp: new Date().toISOString()
  })

  return (
    <LeadsContext.Provider value={value}>
      {children}
    </LeadsContext.Provider>
  )
}

/**
 * Hook personnalisé pour accéder au contexte des leads
 * @returns {Object} - { leads, addLead }
 */
export function useLeads() {
  const context = useContext(LeadsContext)
  
  if (!context) {
    throw new Error('useLeads doit être utilisé à l\'intérieur d\'un LeadsProvider')
  }
  
  return context
}

