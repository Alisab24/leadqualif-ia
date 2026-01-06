import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PipelineAutomation() {
  const [leads, setLeads] = useState([])

  useEffect(() => {
    // Écouter les changements de documents
    const subscription = supabase
      .channel('documents_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'documents' },
        async (payload) => {
          const { new: newDoc } = payload
          
          // Récupérer les informations du lead
          const { data: lead } = await supabase
            .from('leads')
            .select('id, nom, statut')
            .eq('id', newDoc.lead_id)
            .single()
          
          if (!lead) return

          // Logique d'automation du pipeline
          await handleDocumentAutomation(newDoc, lead)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleDocumentAutomation = async (document, lead) => {
    const { type, status } = document
    
    // Si un mandat est signé, déplacer vers "Vendu" ou "Mandat Rentré"
    if (type === 'mandat_vente' && status === 'Signé') {
      const newStatus = lead.budget > 300000 ? 'Vendu' : 'Mandat Rentré'
      
      await updateLeadStatus(lead.id, newStatus)
      
      // Notification
      showNotification(`Lead ${lead.nom} déplacé vers "${newStatus}" suite à la signature du mandat`)
      
      // Créer une activité
      await createActivity(lead.id, 'statut', `Document "${type}" signé - Lead déplacé vers "${newStatus}"`)
    }
    
    // Si une offre est acceptée (devis signé), déplacer vers "Offre en cours"
    if ((type === 'offre_achat' || type === 'devis_sma') && status === 'Signé') {
      await updateLeadStatus(lead.id, 'Offre en cours')
      showNotification(`Offre acceptée pour ${lead.nom} - Passage en "Offre en cours"`)
      await createActivity(lead.id, 'statut', `Offre acceptée - Passage en négociation`)
    }
    
    // Si un contrat est signé, déplacer vers "Vendu" (pour SMMA)
    if (type === 'contrat_prestation' && status === 'Signé') {
      await updateLeadStatus(lead.id, 'Vendu')
      showNotification(`Contrat signé pour ${lead.nom} - Projet terminé`)
      await createActivity(lead.id, 'statut', `Contrat signé - Projet terminé`)
    }
  }

  const updateLeadStatus = async (leadId, newStatus) => {
    await supabase
      .from('leads')
      .update({ statut: newStatus, updated_at: new Date() })
      .eq('id', leadId)
  }

  const createActivity = async (leadId, type, description) => {
    await supabase
      .from('activities')
      .insert([{
        lead_id: leadId,
        type: type,
        description: description,
        created_at: new Date()
      }])
  }

  const showNotification = (message) => {
    // Créer une notification toast
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse'
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 5000)
  }

  return null // Composant invisible - gère l'automation en arrière-plan
}
