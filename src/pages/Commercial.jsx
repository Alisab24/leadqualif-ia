import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import jsPDF from 'jspdf'

export default function Commercial() {
  // --- ÉTATS ---
  const [loading, setLoading] = useState(true)
  const [agencyProfile, setAgencyProfile] = useState(null)
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [error, setError] = useState('')

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Récupérer la session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session non trouvée')
        return
      }

      // 1. Récupérer le profil de l'agence
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (profileError) {
        console.error('Erreur profil:', profileError)
        setError('Erreur de chargement du profil')
        return
      }

      // 2. Récupérer la liste des clients (leads)
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('nom', { ascending: true })

      if (leadsError) {
        console.error('Erreur leads:', leadsError)
        setError('Erreur de chargement des clients')
        return
      }

      setAgencyProfile(profile)
      setLeads(leadsData || [])
      console.log(`✅ Profil agence chargé: ${profile.agency_name || 'Nom non défini'}`)
      console.log(`✅ ${leadsData?.length || 0} clients chargés`)

    } catch (error) {
      console.error('Erreur loadData:', error)
      setError('Erreur de chargement des données')
    } finally {
      setLoading(false)
    }
  }

  // --- GÉNÉRATION PDF INTÉLLIGENTE ---
  const generateDocument = (type, title) => {
    // Vérifier qu'un client est sélectionné
    if (!selectedLead) {
      alert('Veuillez d\'abord sélectionner un client dans la zone de configuration.')
      return
    }

    // Demander l'information spécifique selon le type de document
    let specificInfo = ''
    let template = ''

    switch(type) {
      case 'mandat':
        specificInfo = prompt('Prix du bien (€) :') || '0'
        template = `MANDAT DE VENTE EXCLUSIF

ENTRE LES SOUSSIGNÉS :

Le soussigné, ${selectedLead.nom}, ci-après dénommé "LE VENDEUR"
Et l'agence ${agencyProfile?.agency_name || 'LeadQualif IA'}, ci-après dénommée "L'AGENCE"

OBJET : Mandat exclusif de vente

LE VENDEUR donne mandat exclusif à L'AGENCE pour la vente du bien immobilier situé :
[Adresse complète du bien]

CARACTÉRISTIQUES :
- Type : ${selectedLead.type_bien || 'Non spécifié'}
- Secteur : ${selectedLead.secteur || 'Non spécifié'}
- Prix de vente : ${parseInt(specificInfo).toLocaleString()} €

DURÉE : 3 mois à compter de la date de signature
HONORAIRES : ${Math.round(parseInt(specificInfo) * 0.05).toLocaleString()} € (5% du prix de vente)

FAIT À ${agencyProfile?.city || 'Ville'}, le ${new Date().toLocaleDateString('fr-FR')}

Signature du Vendeur : ____________________

Signature de l'Agence : ____________________`
        break

      case 'visite':
        specificInfo = prompt('Référence du bien :') || 'REF-001'
        template = `BON DE VISITE

DATE : ${new Date().toLocaleDateString('fr-FR')}
HEURE : ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}

VISITEUR :
Nom : ${selectedLead.nom}
Email : ${selectedLead.email}
Téléphone : ${selectedLead.telephone || 'Non renseigné'}

BIEN VISITÉ :
Référence : ${specificInfo}
Type : ${selectedLead.type_bien || 'Non spécifié'}
Secteur : ${selectedLead.secteur || 'Non spécifié'}

OBSERVATIONS :
[............................................................................]
[............................................................................]
[............................................................................]

Le visiteur certifie avoir visité le bien dans son état actuel
et en prend connaissance.

Signature du visiteur : ____________________

Signature de l'agent : ____________________

AGENCE : ${agencyProfile?.agency_name || 'LeadQualif IA'}
Tél : ${agencyProfile?.phone || 'Non renseigné'}
Email : ${agencyProfile?.email || 'Non renseigné'}`
        break

      case 'devis':
        specificInfo = prompt('Montant total des honoraires (€) :') || '0'
        template = `DEVIS D'HONORAIRES

AGENCE : ${agencyProfile?.agency_name || 'LeadQualif IA'}
${agencyProfile?.address || 'Adresse non renseignée'}
${agencyProfile?.postal_code || 'CP'} ${agencyProfile?.city || 'Ville'}
Tél : ${agencyProfile?.phone || 'Non renseigné'}
Email : ${agencyProfile?.email || 'Non renseigné'}

CLIENT : ${selectedLead.nom}
${selectedLead.email}
${selectedLead.telephone || 'Non renseigné'}

DEVIS N° : DEV-${Date.now()}

PRESTATIONS :
- Honoraires de négociation immobilière
- Accompagnement dans la recherche de bien
- Visites et constitution de dossier

MONTANT TOTAL HT : ${parseInt(specificInfo).toLocaleString()} €
TVA (20%) : ${Math.round(parseInt(specificInfo) * 0.2).toLocaleString()} €
MONTANT TTC : ${Math.round(parseInt(specificInfo) * 1.2).toLocaleString()} €

CONDITIONS DE PAIEMENT :
- 50% à la signature du devis
- 50% à la signature du compromis de vente

VALIDITÉ DU DEVIS : 1 mois

Date : ${new Date().toLocaleDateString('fr-FR')}

Signature client : ____________________

Signature agence : ____________________`
        break

      case 'facture':
        specificInfo = prompt('Montant des honoraires (€) :') || '0'
        template = `FACTURE D'HONORAIRES

AGENCE : ${agencyProfile?.agency_name || 'LeadQualif IA'}
${agencyProfile?.address || 'Adresse non renseignée'}
${agencyProfile?.postal_code || 'CP'} ${agencyProfile?.city || 'Ville'}
SIRET : ${agencyProfile?.siret || 'En cours'}
Tél : ${agencyProfile?.phone || 'Non renseigné'}
Email : ${agencyProfile?.email || 'Non renseigné'}

CLIENT : ${selectedLead.nom}
${selectedLead.email || ''}
${selectedLead.telephone || ''}

FACTURE N° : FAC-${Date.now()}

DATE D'ÉMISSION : ${new Date().toLocaleDateString('fr-FR')}
DATE D'ÉCHÉANCE : ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('fr-FR')}

DÉTAIL DE LA PRESTATION :
- Honoraires de négociation immobilière
- Référence bien : ${selectedLead.type_bien || 'Non spécifié'} - ${selectedLead.secteur || 'Non spécifié'}

MONTANT HT : ${parseInt(specificInfo).toLocaleString()} €
TVA (20%) : ${Math.round(parseInt(specificInfo) * 0.2).toLocaleString()} €
MONTANT TTC : ${Math.round(parseInt(specificInfo) * 1.2).toLocaleString()} €

MODE DE PAIEMENT :
Virement bancaire sur IBAN : ${agencyProfile?.iban || 'À communiquer'}

PENALITÉS DE RETARD :
0,5% par jour de retard après la date d'échéance

Mention : "TVA payée par acompte sur les honoraires"

En cas de litige, le tribunal de commerce de ${agencyProfile?.city || 'Ville'} sera seul compétent.`
        break
    }

    // Génération du PDF
    const doc = new jsPDF()
    
    // Configuration des polices
    doc.setFontSize(10)
    
    // En-tête gauche - Infos Agence
    doc.setFontSize(12)
    doc.text(`${agencyProfile?.agency_name || 'LeadQualif IA'}`, 20, 30)
    doc.setFontSize(10)
    doc.text(`${agencyProfile?.address || 'Adresse non renseignée'}`, 20, 40)
    doc.text(`${agencyProfile?.postal_code || 'CP'} ${agencyProfile?.city || 'Ville'}`, 20, 50)
    doc.text(`Tél : ${agencyProfile?.phone || 'Non renseigné'}`, 20, 60)
    doc.text(`Email : ${agencyProfile?.email || 'Non renseigné'}`, 20, 70)
    
    // En-tête droit - Infos Client
    doc.setFontSize(12)
    doc.text('CLIENT :', 140, 30)
    doc.setFontSize(10)
    doc.text(selectedLead.nom, 140, 40)
    doc.text(selectedLead.email, 140, 50)
    doc.text(selectedLead.telephone || 'Non renseigné', 140, 60)
    
    // Titre du document
    doc.setFontSize(18)
    doc.text(title, 105, 90, { align: 'center' })
    
    // Ligne de séparation
    doc.line(20, 100, 190, 100)
    
    // Corps du document
    doc.setFontSize(11)
    const lines = template.split('\n')
    let yPosition = 110
    
    lines.forEach(line => {
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }
      doc.text(line, 20, yPosition)
      yPosition += 7
    })
    
    // Pied de page
    doc.setFontSize(9)
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} par LeadQualif IA`, 105, 280, { align: 'center' })
    
    // Téléchargement
    doc.save(`${type.toLowerCase().replace(/\s+/g, '-')}-${selectedLead.nom.replace(/\s+/g, '-')}-${Date.now()}.pdf`)
  }

  // --- ÉTAT DE CHARGEMENT ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des données...</p>
        </div>
      </div>
    )
  }

  // --- ÉTAT D'ERREUR ---
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur de chargement</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // --- RENDU PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Générateur de Documents</h1>
          <Link 
            to="/app" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            ← Retour au Dashboard
          </Link>
        </div>
        <p className="text-gray-600">Créez vos documents professionnels connectés à votre base de données</p>
      </div>

      {/* Zone de Configuration */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          ⚙️ Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sélection du client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choisir le client concerné
            </label>
            <select 
              value={selectedLead?.id || ''}
              onChange={(e) => {
                const lead = leads.find(l => l.id === e.target.value)
                setSelectedLead(lead)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Sélectionner un client --</option>
              {leads.map(lead => (
                <option key={lead.id} value={lead.id}>
                  {lead.nom} - {lead.email}
                </option>
              ))}
            </select>
          </div>

          {/* Infos de l'agence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document émis par
            </label>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="font-bold text-gray-900">
                {agencyProfile?.agency_name || 'LeadQualif IA'}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.address && `${agencyProfile.address}, `}
                {agencyProfile?.postal_code && `${agencyProfile.postal_code} `}
                {agencyProfile?.city || ''}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.phone && `📞 ${agencyProfile.phone}`}
              </div>
            </div>
          </div>
        </div>

        {/* Client sélectionné */}
        {selectedLead && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600">✅</span>
              <span className="font-medium text-blue-900">Client sélectionné</span>
            </div>
            <div className="text-sm text-blue-800">
              <strong>{selectedLead.nom}</strong> - {selectedLead.email}
              {selectedLead.telephone && ` - 📞 ${selectedLead.telephone}`}
              {selectedLead.budget && ` - 💰 ${selectedLead.budget.toLocaleString()}€`}
            </div>
          </div>
        )}
      </div>

      {/* Grille des Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Mandat de Vente */}
        <div 
          onClick={() => generateDocument('mandat', 'MANDAT DE VENTE EXCLUSIF')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📜</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Mandat de Vente</h3>
            <p className="text-sm text-gray-600 mb-4">Générez un mandat exclusif personnalisé</p>
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

        {/* Bon de Visite */}
        <div 
          onClick={() => generateDocument('visite', 'BON DE VISITE')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">👁️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bon de Visite</h3>
            <p className="text-sm text-gray-600 mb-4">Créez un bon de visite officiel</p>
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

        {/* Devis */}
        <div 
          onClick={() => generateDocument('devis', 'DEVIS D\'HONORAIRES')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📑</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Devis</h3>
            <p className="text-sm text-gray-600 mb-4">Établissez un devis d'honoraires</p>
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

        {/* Facture */}
        <div 
          onClick={() => generateDocument('facture', 'FACTURE D\'HONORAIRES')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">💶</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Facture</h3>
            <p className="text-sm text-gray-600 mb-4">Générez une facture professionnelle</p>
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

      </div>

      {/* Guide d'utilisation */}
      <div className="mt-12 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Guide d'utilisation</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-800">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">1.</span>
            <div>
              <strong>Sélectionnez</strong> un client dans la liste
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">2.</span>
            <div>
              <strong>Vérifiez</strong> les infos de l'agence
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">3.</span>
            <div>
              <strong>Cliquez</strong> sur le document souhaité
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">4.</span>
            <div>
              <strong>Saisissez</strong> l'info demandée
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{leads.length}</div>
          <div className="text-sm text-gray-600">Clients disponibles</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">4</div>
          <div className="text-sm text-gray-600">Documents</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-green-600">∞</div>
          <div className="text-sm text-gray-600">Générations</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">100%</div>
          <div className="text-sm text-gray-600">Personnalisé</div>
        </div>
      </div>
    </div>
  )
}
