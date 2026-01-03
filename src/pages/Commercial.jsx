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
  const [recipientType, setRecipientType] = useState('lead') // 'lead' ou 'other'
  const [error, setError] = useState('')

  // --- FORM DATA POUR DESTINATAIRE AUTRE ---
  const [otherRecipient, setOtherRecipient] = useState({
    name: '',
    address: '',
    city: ''
  })

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
    // Vérifier le destinataire
    let recipientInfo = null
    
    if (recipientType === 'lead') {
      if (!selectedLead) {
        alert('Veuillez d\'abord sélectionner un client dans la zone de configuration.')
        return
      }
      recipientInfo = {
        name: selectedLead.nom,
        email: selectedLead.email,
        phone: selectedLead.telephone || 'Non renseigné',
        type_bien: selectedLead.type_bien || 'Non spécifié',
        secteur: selectedLead.secteur || 'Non spécifié'
      }
    } else {
      if (!otherRecipient.name) {
        alert('Veuillez remplir les informations du destinataire.')
        return
      }
      recipientInfo = {
        name: otherRecipient.name,
        address: otherRecipient.address,
        city: otherRecipient.city,
        email: '',
        phone: '',
        type_bien: 'Non spécifié',
        secteur: otherRecipient.city
      }
    }

    // Demander l'information spécifique selon le type de document
    let specificInfo = ''
    let template = ''

    switch(type) {
      case 'mandat':
        specificInfo = prompt('Prix du bien (€) :') || '0'
        template = `MANDAT DE VENTE EXCLUSIF

ENTRE LES SOUSSIGNÉS :

Le soussigné, ${recipientInfo.name}, ci-après dénommé "LE VENDEUR"
Et l'agence ${agencyProfile?.nom_agence || 'LeadQualif IA'}, ci-après dénommée "L'AGENCE"

OBJET : Mandat exclusif de vente

LE VENDEUR donne mandat exclusif à L'AGENCE pour la vente du bien immobilier situé :
${recipientInfo.address || '[Adresse complète du bien]'}${recipientInfo.city ? ', ' + recipientInfo.city : ''}

CARACTÉRISTIQUES :
- Type : ${recipientInfo.type_bien}
- Secteur : ${recipientInfo.secteur}
- Prix de vente : ${parseInt(specificInfo).toLocaleString()} ${agencyProfile?.devise || '€'}

DURÉE : 3 mois à compter de la date de signature
HONORAIRES : ${Math.round(parseInt(specificInfo) * 0.05).toLocaleString()} ${agencyProfile?.devise || '€'} (5% du prix de vente)

FAIT À ${agencyProfile?.pays || 'France'}, le ${new Date().toLocaleDateString('fr-FR')}

Signature du Vendeur : ____________________

Signature de l'Agence : ____________________

Pour l'agence : ${agencyProfile?.signataire || 'Le Gérant'}

Identifiant fiscal : ${agencyProfile?.identifiant_fiscal || 'En cours'}`
        break

      case 'visite':
        specificInfo = prompt('Référence du bien :') || 'REF-001'
        template = `BON DE VISITE

DATE : ${new Date().toLocaleDateString('fr-FR')}
HEURE : ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}

VISITEUR :
Nom : ${recipientInfo.name}
${recipientInfo.email ? 'Email : ' + recipientInfo.email : ''}
${recipientInfo.phone ? 'Téléphone : ' + recipientInfo.phone : ''}

BIEN VISITÉ :
Référence : ${specificInfo}
Type : ${recipientInfo.type_bien}
Secteur : ${recipientInfo.secteur}

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

AGENCE : ${agencyProfile?.nom_agence || 'LeadQualif IA'}
${agencyProfile?.adresse_agence || 'Adresse non renseignée'}
Tél : ${agencyProfile?.telephone_agence || 'Non renseigné'}
Email : ${agencyProfile?.email_agence || 'Non renseigné'}
Identifiant fiscal : ${agencyProfile?.identifiant_fiscal || 'En cours'}

CLIENT : ${recipientInfo.name}
${recipientInfo.email || ''}
${recipientInfo.phone || ''}

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

Signature agence : ____________________

Pour l'agence : ${agencyProfile?.signatory_name || 'Le Gérant'}`
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

CLIENT : ${recipientInfo.name}
${recipientInfo.email || ''}
${recipientInfo.phone || ''}

FACTURE N° : FAC-${Date.now()}

DATE D'ÉMISSION : ${new Date().toLocaleDateString('fr-FR')}
DATE D'ÉCHÉANCE : ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('fr-FR')}

DÉTAIL DE LA PRESTATION :
- Honoraires de négociation immobilière
- Référence bien : ${recipientInfo.type_bien} - ${recipientInfo.secteur}

MONTANT HT : ${parseInt(specificInfo).toLocaleString()} €
TVA (20%) : ${Math.round(parseInt(specificInfo) * 0.2).toLocaleString()} €
MONTANT TTC : ${Math.round(parseInt(specificInfo) * 1.2).toLocaleString()} €

MODE DE PAIEMENT :
Virement bancaire sur IBAN : ${agencyProfile?.iban || 'À communiquer'}

PENALITÉS DE RETARD :
0,5% par jour de retard après la date d'échéance

Mention : "TVA payée par acompte sur les honoraires"

En cas de litige, le tribunal de commerce de ${agencyProfile?.city || 'Ville'} sera seul compétent.

Pour l'agence : ${agencyProfile?.signatory_name || 'Le Gérant'}`
        break
    }

    // Génération du PDF
    const doc = new jsPDF()
    
    // En-tête GRAND - Nom de l'agence
    doc.setFontSize(20)
    doc.text(`${agencyProfile?.nom_agence || 'LeadQualif IA'}`, 105, 25, { align: 'center' })
    
    // Adresse et téléphone sous le nom
    doc.setFontSize(10)
    const agencyAddress = `${agencyProfile?.adresse_agence || 'Adresse non renseignée'}`
    doc.text(agencyAddress, 105, 35, { align: 'center' })
    doc.text(`Tél : ${agencyProfile?.telephone_agence || 'Non renseigné'}`, 105, 42, { align: 'center' })
    
    // Ligne de séparation
    doc.line(20, 50, 190, 50)
    
    // Infos Client (droite)
    doc.setFontSize(12)
    doc.text('CLIENT :', 140, 65)
    doc.setFontSize(10)
    doc.text(recipientInfo.name, 140, 75)
    if (recipientInfo.email) doc.text(recipientInfo.email, 140, 85)
    if (recipientInfo.phone) doc.text(recipientInfo.phone, 140, 95)
    if (recipientInfo.address) doc.text(recipientInfo.address, 140, 105)
    if (recipientInfo.city) doc.text(recipientInfo.city, 140, 115)
    
    // Titre du document
    doc.setFontSize(16)
    doc.text(title, 105, 65, { align: 'center' })
    
    // Ligne de séparation
    doc.line(20, 125, 190, 125)
    
    // Corps du document
    doc.setFontSize(11)
    const lines = template.split('\n')
    let yPosition = 135
    
    lines.forEach(line => {
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      doc.text(line, 20, yPosition)
      yPosition += 6
    })
    
    // Pied de page avec identifiant fiscal et site web
    doc.setFontSize(8)
    const footerText = `Identifiant fiscal : ${agencyProfile?.identifiant_fiscal || 'En cours'} - ${agencyProfile?.site_web || 'www.agence.fr'}`
    doc.text(footerText, 105, 280, { align: 'center' })
    
    // Signature en bas à droite
    doc.text(`Pour l'agence : ${agencyProfile?.signataire || 'Le Gérant'}`, 190, 270, { align: 'right' })
    
    // Téléchargement
    const fileName = `${type.toLowerCase().replace(/\s+/g, '-')}-${recipientInfo.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`
    doc.save(fileName)
  }

  // --- CHANGEMENT DESTINATAIRE AUTRE ---
  const handleOtherRecipientChange = (field, value) => {
    setOtherRecipient({
      ...otherRecipient,
      [field]: value
    })
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
        
        {/* Toggle Destinataire */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de destinataire
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setRecipientType('lead')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                recipientType === 'lead' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              👥 Client Internet (Lead)
            </button>
            <button
              onClick={() => setRecipientType('other')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                recipientType === 'other' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🏠 Autre (Propriétaire/Libre)
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sélection du client ou formulaire autre */}
          {recipientType === 'lead' ? (
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
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du destinataire *
                </label>
                <input
                  type="text"
                  value={otherRecipient.name}
                  onChange={(e) => handleOtherRecipientChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse
                </label>
                <input
                  type="text"
                  value={otherRecipient.address}
                  onChange={(e) => handleOtherRecipientChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 123 Rue de l'Immobilier"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville
                </label>
                <input
                  type="text"
                  value={otherRecipient.city}
                  onChange={(e) => handleOtherRecipientChange('city', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Paris"
                />
              </div>
            </div>
          )}

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
              <div className="text-sm text-gray-600">
                {agencyProfile?.siret && `🆔 SIRET: ${agencyProfile.siret}`}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.signatory_name && `✍️ Signataire: ${agencyProfile.signatory_name}`}
              </div>
            </div>
          </div>
        </div>

        {/* Destinataire sélectionné */}
        {(recipientType === 'lead' && selectedLead) || (recipientType === 'other' && otherRecipient.name) ? (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600">✅</span>
              <span className="font-medium text-blue-900">Destinataire sélectionné</span>
            </div>
            <div className="text-sm text-blue-800">
              <strong>{recipientType === 'lead' ? selectedLead.nom : otherRecipient.name}</strong>
              {recipientType === 'lead' && ` - ${selectedLead.email}`}
              {recipientType === 'lead' && selectedLead.telephone && ` - 📞 ${selectedLead.telephone}`}
              {recipientType === 'lead' && selectedLead.budget && ` - 💰 ${selectedLead.budget.toLocaleString()}€`}
              {recipientType === 'other' && otherRecipient.address && ` - 📍 ${otherRecipient.address}`}
              {recipientType === 'other' && otherRecipient.city && ` - 🏙️ ${otherRecipient.city}`}
            </div>
          </div>
        ) : null}
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
              <strong>Choisissez</strong> le type de destinataire
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">2.</span>
            <div>
              <strong>Sélectionnez</strong> ou saisissez le destinataire
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
