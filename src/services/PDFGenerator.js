import jsPDF from 'jspdf'
import { supabase } from '../supabaseClient'

class PDFGenerator {
  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
  }

  async getAgencyBranding(agencyId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_name, logo_url, phone, email, primary_color, secondary_color')
        .eq('agency_id', agencyId)
        .single()
      
      if (error) throw error
      
      return {
        agencyName: data?.agency_name || 'LeadQualif IA',
        logoUrl: data?.logo_url || null,
        phone: data?.phone || '',
        email: data?.email || '',
        primaryColor: data?.primary_color || '#1e40af',
        secondaryColor: data?.secondary_color || '#3b82f6'
      }
    } catch (err) {
      console.error('Erreur récupération branding:', err)
      return {
        agencyName: 'LeadQualif IA',
        logoUrl: null,
        phone: '',
        email: '',
        primaryColor: '#1e40af',
        secondaryColor: '#3b82f6'
      }
    }
  }

  // Templates pour chaque métier
  getDocumentTemplate(type, agencyInfo, leadInfo) {
    const templates = {
      // Templates IMMO
      'mandat_vente': {
        title: 'MANDAT DE VENTE',
        content: [
          `ENTRE LES SOUSSIGNÉS :`,
          `${leadInfo.nom || '_________________________'}`,
          `${leadInfo.email || '_________________________'}`,
          `${leadInfo.phone || '_________________________'}`,
          ``,
          `AGENCE : ${agencyInfo.agencyName}`,
          `Tél : ${agencyInfo.phone}`,
          `Email : ${agencyInfo.email}`,
          ``,
          `Le soussigné déclare vendre le bien suivant :`,
          `Type : ${leadInfo.type_bien || '________________'}`,
          `Surface : ${leadInfo.surface || '________________'} m²`,
          `Localisation : ${leadInfo.adresse || '________________'}`,
          `Budget : ${leadInfo.budget ? leadInfo.budget.toLocaleString('fr-FR') + ' €' : '________________'}`,
          ``,
          `Le présent mandant confère au mandataire :`,
          `${leadInfo.nom || '_________________________'}`,
          `Le pouvoir de vendre le bien susmentionné,`,
          `Aux conditions et prix ci-dessous mentionnés dans le présent mandat.`,
          `Le mandant s'engage à faire son mieux pour aboutir la vente dans les meilleurs délais possibles.`,
          `Le présent mandat est établi pour une durée de ${leadInfo.mandat_duree || '6'} mois.`,
          `Honoraires : ${leadInfo.honoraires || '4%'} du prix de vente HT.`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Signatures :`,
          `Vendeur : ${leadInfo.nom || '_________________________'}`,
          `Agence : ${agencyInfo.agencyName}`
        ]
      },
      
      'bon_visite': {
        title: 'BON DE VISITE',
        content: [
          `BON DE VISITE`,
          ``,
          `Bien visité le ${new Date().toLocaleDateString('fr-FR')}`,
          ``,
          `PROPRIÉTAIRE :`,
          `${leadInfo.adresse || '________________'}`,
          ``,
          `Type : ${leadInfo.type_bien || '________________'}`,
          `Surface : ${leadInfo.surface || '________________'} m²`,
          `Visite effectué par : ${leadInfo.nom || '_________________________'}`,
          `Tél : ${leadInfo.phone || '_________________________'}`,
          `Email : ${leadInfo.email || '_________________________'}`,
          `Agence : ${agencyInfo.agencyName}`,
          `Observations : ${leadInfo.observations || 'Aucune observation particulière'}`,
          `Recommandations : ${leadInfo.recommandations || 'Aucune recommandation particulière'}`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Visiteur : ${leadInfo.nom || '_________________________'}`,
          `Agent : ${agencyInfo.agencyName}`
        ]
      },
      
      'offre_achat': {
        title: 'OFFRE D\'ACHAT',
        content: [
          `OFFRE D'ACHAT`,
          ``,
          `Date : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          ``,
          `PROPRIÉTAIRE :`,
          `${leadInfo.adresse || '________________'}`,
          ``,
          `Type : ${leadInfo.type_bien || '________________'}`,
          `Surface : ${leadInfo.surface || '________________'} m²`,
          `ACHETEUR : ${leadInfo.nom || '_________________________'}`,
          `Tél : ${leadInfo.phone || '_________________________'}`,
          `Email : ${leadInfo.email || '_________________________'}`,
          `Agence : ${agencyInfo.agencyName}`,
          `Description : ${leadInfo.description || 'Aucune description particulière'}`,
          `Prix proposé : ${leadInfo.offre_prix ? leadInfo.offre_prix.toLocaleString('fr-FR') + ' €' : '________________'}`,
          `Conditions : ${leadInfo.conditions || 'Conditions à préciser'}`,
          `Validité de l'offre : ${leadInfo.validite_offre || '15 jours'}`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Vendeur : ${agencyInfo.agencyName}`,
          `Acheteur : ${leadInfo.nom || '_________________________'}`,
          `Signature de l'acheteur obligatoire`
        ]
      },
      
      'fiche_client_immo': {
        title: 'FICHE CLIENT',
        content: [
          `FICHE CLIENT`,
          ``,
          `Date : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          ``,
          `CLIENT :`,
          `${leadInfo.nom || '_________________________'}`,
          `${leadInfo.adresse || '________________'}`,
          `${leadInfo.phone || '_________________________'}`,
          `${leadInfo.email || '_________________________'}`,
          ``,
          `PROPRIÉTÉ :`,
          `${leadInfo.type_bien || '________________'}`,
          `${leadInfo.surface || '________________'} m²`,
          `${leadInfo.budget ? leadInfo.budget.toLocaleString('fr-FR') + ' €' : '________________'}`,
          `PROJET : ${leadInfo.projet || '________________'}`,
          `NOTES : ${leadInfo.notes || 'Aucune note particulière'}`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Agent : ${agencyInfo.agencyName}`,
          `Client : ${leadInfo.nom || '_________________________'}`,
          `Agent : ${agencyInfo.agencyName}`
        ]
      },
      
      // Templates SMMA/Autre
      'devis_sma': {
        title: 'DEVis - Prestations',
        content: [
          `DEVis N°${Math.floor(Math.random() * 1000)}`,
          `Date : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          ``,
          `CLIENT :`,
          `${leadInfo.nom || '_________________________'}`,
          `${leadInfo.adresse || '________________'}`,
          `${leadInfo.phone || '_________________________'}`,
          `${leadInfo.email || '_________________________'}`,
          ``,
          `PRESTATAIRE :`,
          ``,
          `Détail des prestations :`,
          ``,
          `1. ${leadInfo.prestation_1 || '________________'} : ${leadInfo.prix_1 || '0'} €`,
          `2. ${leadInfo.prestation_2 || '________________'} : ${leadInfo.prix_2 || '0'} €`,
          `3. ${leadInfo.prestation_3 || '________________'} : ${leadInfo.prix_3 || '0'} €`,
          `4. ${leadInfo.prestation_4 || '________________'} : ${leadInfo.prix_4 || '0'} €`,
          `5. ${leadInfo.prestation_5 || '________________'} : ${leadInfo.prix_5 || '0'} €`,
          ``,
          `TOTAL HT : ${leadInfo.total_ht || '0'} €`,
          `TVA (${leadInfo.tva || '20'}%) : ${leadInfo.total_tva || '0'} €`,
          `TOTAL TTC : ${leadInfo.total_ttc || '0'} €`,
          ``,
          `Conditions de paiement : ${leadInfo.conditions_paiement || 'Paiement à 30 jours'}`,
          `Validité de l'offre : ${leadInfo.validite_devis || '30 jours'}`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Vendeur : ${agencyInfo.agencyName}`,
          `Client : ${leadInfo.nom || '_________________________'}`,
          `Vendeur : ${agencyInfo.agencyName}`
        ]
      },
      
      'contrat_prestation': {
        title: 'CONTRAT DE PRESTATION',
        content: [
          `CONTRAT DE PRESTATION DE SERVICES`,
          `N° ${Math.floor(Math.random() * 1000)}`,
          `Date : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          ``,
          `ENTRE LES SOUSSIGNÉS :`,
          `PRESTATAIRE :`,
          `${agencyInfo.agencyName}`,
          `Adresse : ${agencyInfo.adresse || '________________'}`,
          `${agencyInfo.phone || '________________'}`,
          `${agencyInfo.email || '_________________________'}`,
          `SIRET : ${agencyInfo.siret || '________________'}`,
          ``,
          `CLIENT :`,
          `${leadInfo.nom || '_________________________'}`,
          `${leadInfo.adresse || '________________'}`,
          `${leadInfo.phone || '_________________________'}`,
          `${leadInfo.email || '_________________________'}`,
          ``,
          `OBJET : ${leadInfo.contrat_objet || '________________'}`,
          `DÉBUT DES TRAVAUX : ${leadInfo.contrat_debut || '________________'}`,
          `FIN DES TRAVAUX : ${leadInfo.contrat_fin || '________________'}`,
          `DURÉE : ${leadInfo.contrat_duree || '________________'}`,
          `MONTANT TOTAL : ${leadInfo.montant_total || '0'} €`,
          `CONDITIONS : ${leadInfo.contrat_conditions || 'Conditions à préciser'}`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Vendeur : ${agencyInfo.agencyName}`,
          `Client : ${leadInfo.nom || '_________________________'}`,
          `Vendeur : ${agencyInfo.agencyName}`
        ]
      },
      
      'facture_sma': {
        title: 'FACTURE',
        content: [
          `FACTURE N°${Math.floor(Math.random() * 1000)}`,
          `Date de facturation : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Date d'échéance : ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          ``,
          `CLIENT :`,
          `${leadInfo.nom || '_________________________'}`,
          `${leadInfo.adresse || '________________'}`,
          `${leadInfo.phone || '_________________________'}`,
          `${leadInfo.email || '_________________________'}`,
          ``,
          `PRESTATAIRE :`,
          ``,
          `Détail des prestations :`,
          ``,
          `1. ${leadInfo.prestation_1 || '________________'} : ${leadInfo.prix_1 || '0'} €`,
          `2. ${leadInfo.prestation_2 || '________________'} : ${leadInfo.prix_2 || '0'} €`,
          `3. ${leadInfo.prestation_3 || '________________'} : ${leadInfo.prix_3 || '0'} €`,
          `4. ${leadInfo.prestation_4 || '________________'} : ${leadInfo.prix_4 || '0'} €`,
          `5. ${leadInfo.prestation_5 || '________________'} : ${leadInfo.prix_5 || '0'} €`,
          ``,
          `TOTAL HT : ${leadInfo.total_ht || '0'} €`,
          `TVA (${leadInfo.tva || '20'}%) : ${leadInfo.total_tva || '0'} €`,
          `TOTAL TTC : ${leadInfo.total_ttc || '0'} €`,
          ``,
          `Conditions de paiement : ${leadInfo.conditions_paiement || 'Paiement à 30 jours'}`,
          `Fait à ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          `Vendeur : ${agencyInfo.agencyName}`,
          `Client : ${leadInfo.nom || '_________________________'}`,
          `Vendeur : ${agencyInfo.agencyName}`
        ]
      }
    }
    
    return templates[type] || templates['mandat_vente']
  }

  addHeader(doc, agencyInfo) {
    // Ajouter le logo en haut à gauche
    if (agencyInfo.logoUrl) {
      try {
        const logoWidth = 40
        const logoHeight = 30
        doc.addImage(agencyInfo.logoUrl, 15, 15, { width: logoWidth, height: logoHeight })
      } catch (error) {
        console.error('Erreur ajout logo:', error)
      }
    }
    
    // En-tête avec couleurs de l'agence
    doc.setFillColor(agencyInfo.primaryColor)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(agencyInfo.agencyName, 15, 15)
    
    doc.setFillColor(100, 100, 100, 100)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(agencyInfo.phone, 15, 25)
    doc.text(agencyInfo.email, 15, 35)
    
    doc.setFillColor(0, 0, 0, 0)
  }

  addFooter(doc, agencyInfo) {
    // Pied de page légal
    const footerY = doc.internal.pageSize.height - 30
    
    doc.setFillColor(240, 240, 240, 240)
    doc.setDrawColor(200, 200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(15, footerY, doc.internal.pageSize.width - 30, 0.5)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    
    doc.text(`Document généré par ${agencyInfo.agencyName}`, 15, footerY + 5)
    doc.text(`SIRET : ${agencyInfo.siret || 'En cours d\'immatriculation'}`, 15, footerY + 15)
    doc.text(`Email : ${agencyInfo.email}`, 15, footerY + 25)
    
    // Mentions légales
    doc.setFontSize(7)
    doc.text('En cas de litige, seul le tribunal de commerce compétent', 15, footerY + 40)
    doc.text('du lieu d\'exécution du contrat pourra connaître du litige applicable.', 15, footerY + 50)
    doc.text('et statuer la nullité de la clause de réserve de propriété.', 15, footerY + 55)
  }

  async generatePDF(type, leadId, agencyId) {
    try {
      // Récupérer les informations
      const [agencyInfo] = await Promise.all([
        this.getAgencyBranding(agencyId),
        supabase.from('leads').select('*').eq('id', leadId).single()
      ])
      
      const leadInfo = agencyInfo[1] || {}
      
      // Initialiser le document
      this.doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      // Obtenir le template
      const template = this.getDocumentTemplate(type, agencyInfo[0], leadInfo)
      
      // Ajouter l'en-tête
      this.addHeader(this.doc, agencyInfo[0])
      
      // Ajouter le contenu
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(50, 50, 50, 50)
      
      template.content.forEach(line => {
        if (line) {
          this.doc.text(line, 20, 20)
        }
      })
      
      // Ajouter le pied de page
      this.addFooter(this.doc, agencyInfo[0])
      
      // Sauvegarder le PDF
      const pdfBytes = this.doc.output('arraybuffer')
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      // Retourner l'URL du PDF
      return {
        success: true,
        url: url,
        filename: `${type}_${leadInfo.nom}_${new Date().toISOString().split('T')[0]}.pdf`
      }
      
    } catch (error) {
      console.error('Erreur génération PDF:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default PDFGenerator
