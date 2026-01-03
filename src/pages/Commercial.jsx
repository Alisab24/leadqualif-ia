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
      console.log(`✅ Profil agence chargé: ${profile.nom_agence || 'Nom non défini'}`)
      console.log(`✅ ${leadsData?.length || 0} clients chargés`)

    } catch (error) {
      console.error('Erreur loadData:', error)
      setError('Erreur de chargement des données')
    } finally {
      setLoading(false)
    }
  }

  // --- FONCTION UTILITAIRE POUR LE LOGO (CRITIQUE) ---
  const getBase64ImageFromUrl = async (imageUrl) => {
    try {
      console.log('Tentative de chargement du logo:', imageUrl)
      
      // Créer un proxy pour éviter les problèmes CORS
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`
      
      const response = await fetch(proxyUrl)
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`)
      }
      
      const blob = await response.blob()
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Erreur chargement logo:', error)
      return null
    }
  }

  // --- GÉNÉRATION PDF PREMIUM BRANDÉ ---
  const generateDocument = async (type, title) => {
    // Vérifier que le profil de l'agence est configuré
    if (!agencyProfile || !agencyProfile.nom_agence) {
      alert('Veuillez configurer vos paramètres d\'agence avant de générer des documents.')
      return
    }

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
        specificInfo = prompt('Prix du bien :') || '0'
        template = `ENTRE LES SOUSSIGNÉS :

Le soussigné, ${recipientInfo.name}, ci-après dénommé "LE VENDEUR"
Et l'agence ${agencyProfile.nom_agence}, ci-après dénommée "L'AGENCE"

OBJET : Mandat exclusif de vente

LE VENDEUR donne mandat exclusif à L'AGENCE pour la vente du bien immobilier situé :
${recipientInfo.address || '[Adresse complète du bien]'}${recipientInfo.city ? ', ' + recipientInfo.city : ''}

CARACTÉRISTIQUES :
- Type : ${recipientInfo.type_bien}
- Secteur : ${recipientInfo.secteur}
- Prix de vente : ${parseInt(specificInfo).toLocaleString()} ${agencyProfile.devise || 'FCFA'}

DURÉE : 3 mois à compter de la date de signature
HONORAIRES : ${Math.round(parseInt(specificInfo) * 0.05).toLocaleString()} ${agencyProfile.devise || 'FCFA'} (5% du prix de vente)

FAIT À ${agencyProfile.pays || 'Bénin'}, le ${new Date().toLocaleDateString('fr-FR')}

Signature du Vendeur : ____________________

Signature de l'Agence : ____________________

Pour l'agence : ${agencyProfile.signataire || 'Le Gérant'}`
        break

      case 'visite':
        specificInfo = prompt('Référence du bien :') || 'REF-001'
        template = `DATE : ${new Date().toLocaleDateString('fr-FR')}
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

Signature de l'agent : ____________________`
        break

      case 'devis':
        specificInfo = prompt('Montant total des honoraires :') || '0'
        template = `PRESTATIONS :
- Honoraires de négociation immobilière
- Accompagnement dans la recherche de bien
- Visites et constitution de dossier

MONTANT TOTAL HT : ${parseInt(specificInfo).toLocaleString()} ${agencyProfile.devise || 'FCFA'}
TVA (20%) : ${Math.round(parseInt(specificInfo) * 0.2).toLocaleString()} ${agencyProfile.devise || 'FCFA'}
MONTANT TTC : ${Math.round(parseInt(specificInfo) * 1.2).toLocaleString()} ${agencyProfile.devise || 'FCFA'}

CONDITIONS DE PAIEMENT :
- 50% à la signature du devis
- 50% à la signature du compromis de vente

VALIDITÉ DU DEVIS : 1 mois

Date : ${new Date().toLocaleDateString('fr-FR')}

Signature client : ____________________

Signature agence : ____________________

Pour l'agence : ${agencyProfile.signataire || 'Le Gérant'}`
        break

      case 'facture':
        specificInfo = prompt('Montant des honoraires :') || '0'
        template = `FACTURE N° : FAC-${Date.now()}

DATE D'ÉMISSION : ${new Date().toLocaleDateString('fr-FR')}
DATE D'ÉCHÉANCE : ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('fr-FR')}

DÉTAIL DE LA PRESTATION :
- Honoraires de négociation immobilière
- Référence bien : ${recipientInfo.type_bien} - ${recipientInfo.secteur}

MONTANT HT : ${parseInt(specificInfo).toLocaleString()} ${agencyProfile.devise || 'FCFA'}
TVA (20%) : ${Math.round(parseInt(specificInfo) * 0.2).toLocaleString()} ${agencyProfile.devise || 'FCFA'}
MONTANT TTC : ${Math.round(parseInt(specificInfo) * 1.2).toLocaleString()} ${agencyProfile.devise || 'FCFA'}

MODE DE PAIEMENT :
Virement bancaire sur IBAN : ${agencyProfile.iban || 'À communiquer'}

PENALITÉS DE RETARD :
0,5% par jour de retard après la date d'échéance

Mention : "TVA payée par acompte sur les honoraires"

En cas de litige, le tribunal de commerce de ${agencyProfile.pays || 'Cotonou'} sera seul compétent.

Pour l'agence : ${agencyProfile.signataire || 'Le Gérant'}`
        break
    }

    // Génération du PDF avec design Premium Brandé
    const doc = new jsPDF()
    
    // Couleurs de marque
    const couleurPrimaire = agencyProfile.couleur_primaire || '#1e40af'
    const couleurSecondaire = agencyProfile.couleur_secondaire || '#64748b'
    
    // Convertir les couleurs hex en RGB pour jsPDF
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 30, g: 64, b: 175 }
    }
    
    const primaireRgb = hexToRgb(couleurPrimaire)
    const secondaireRgb = hexToRgb(couleurSecondaire)
    
    // --- LE HEADER (EN-TÊTE) ---
    // Barre pleine en haut avec couleur primaire
    doc.setFillColor(primaireRgb.r, primaireRgb.g, primaireRgb.b)
    doc.rect(0, 0, 210, 40, 'F')
    
    // Logo ou nom de l'agence dans la barre
    let logoData = null
    if (agencyProfile.logo_url) {
      logoData = await getBase64ImageFromUrl(agencyProfile.logo_url)
    }
    
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 15, 10, 30, 20)
      } catch (error) {
        console.log('Erreur ajout logo, utilisation du nom')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(16)
        doc.setFont(undefined, 'bold')
        doc.text(agencyProfile.nom_agence || 'AGENCE', 15, 25)
      }
    } else {
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont(undefined, 'bold')
      doc.text(agencyProfile.nom_agence || 'AGENCE', 15, 25)
    }
    
    // Nom de l'agence en blanc à droite dans la barre
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont(undefined, 'normal')
    doc.text('IMMOBILIER PRO', 195, 25, { align: 'right' })
    
    // Coordonnées sous la barre avec couleur secondaire
    doc.setTextColor(secondaireRgb.r, secondaireRgb.g, secondaireRgb.b)
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text(agencyProfile.adresse_agence || 'Adresse', 20, 50)
    doc.text(agencyProfile.telephone_agence || 'Téléphone', 20, 57)
    doc.text(agencyProfile.email_agence || 'Email', 20, 64)
    doc.text(agencyProfile.identifiant_fiscal ? `IFU: ${agencyProfile.identifiant_fiscal}` : '', 120, 50)
    
    // --- TITRE DU DOCUMENT ---
    doc.setTextColor(primaireRgb.r, primaireRgb.g, primaireRgb.b)
    doc.setFontSize(20)
    doc.setFont(undefined, 'bold')
    doc.text(title.toUpperCase(), 105, 85, { align: 'center' })
    
    // --- INFOS CLIENT (ENCADRÉ AVEC COULEUR SECONDAIRE) ---
    doc.setDrawColor(secondaireRgb.r, secondaireRgb.g, secondaireRgb.b)
    doc.setLineWidth(0.5)
    doc.rect(15, 95, 180, 35)
    
    doc.setTextColor(primaireRgb.r, primaireRgb.g, primaireRgb.b)
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('INFORMATIONS CLIENT', 20, 110)
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.text(`Nom : ${recipientInfo.name}`, 20, 120)
    if (recipientInfo.address) doc.text(`Adresse : ${recipientInfo.address}`, 20, 127)
    if (recipientInfo.city) doc.text(`Ville : ${recipientInfo.city}`, 20, 134)
    if (recipientInfo.phone) doc.text(`Téléphone : ${recipientInfo.phone}`, 120, 120)
    if (recipientInfo.email) doc.text(`Email : ${recipientInfo.email}`, 120, 127)
    
    // --- CORPS DU DOCUMENT ---
    let yPosition = 145
    const sections = template.split('\n\n')
    
    sections.forEach(section => {
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      
      // Titre de section en couleur primaire
      if (section.includes(':') && !section.startsWith(' ')) {
        doc.setTextColor(primaireRgb.r, primaireRgb.g, primaireRgb.b)
        doc.setFontSize(12)
        doc.setFont(undefined, 'bold')
        const lines = section.split('\n')
        if (lines[0]) {
          doc.text(lines[0], 20, yPosition)
          yPosition += 8
        }
        
        // Reste du texte en noir
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(11)
        doc.setFont(undefined, 'normal')
        for (let i = 1; i < lines.length; i++) {
          if (lines[i]) {
            doc.text(lines[i], 20, yPosition)
            yPosition += 6
          }
        }
      } else {
        // Texte normal
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(11)
        doc.setFont(undefined, 'normal')
        const lines = section.split('\n')
        lines.forEach(line => {
          if (line && yPosition < 270) {
            doc.text(line, 20, yPosition)
            yPosition += 6
          }
        })
      }
      yPosition += 4 // Espace entre sections
    })
    
    // --- FOOTER (PIED DE PAGE) ---
    // Ligne fine en bas avec couleur primaire
    doc.setDrawColor(primaireRgb.r, primaireRgb.g, primaireRgb.b)
    doc.setLineWidth(1)
    doc.line(15, 275, 195, 275)
    
    // Mentions légales en petit
    doc.setTextColor(secondaireRgb.r, secondaireRgb.g, secondaireRgb.b)
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    const footerText = `${agencyProfile.nom_agence || 'AGENCE'} - IFU: ${agencyProfile.identifiant_fiscal || 'N/A'} - ${agencyProfile.site_web || 'www.agence.fr'}`
    doc.text(footerText, 105, 285, { align: 'center' })
    
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
          <h1 className="text-3xl font-bold text-gray-900">Générateur de Documents Premium</h1>
          <Link 
            to="/app" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            ← Retour au Dashboard
          </Link>
        </div>
        <p className="text-gray-600">Créez vos documents professionnels avec votre identité visuelle</p>
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
                  placeholder="Ex: Cotonou"
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
                {agencyProfile?.nom_agence || 'AGENCE NON CONFIGURÉE'}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.adresse_agence || 'Adresse non renseignée'}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.telephone_agence && `📞 ${agencyProfile.telephone_agence}`}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.identifiant_fiscal && `🆔 IFU: ${agencyProfile.identifiant_fiscal}`}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.signataire && `✍️ Signataire: ${agencyProfile.signataire}`}
              </div>
              <div className="text-sm text-gray-600">
                {agencyProfile?.devise && `💰 Devise: ${agencyProfile.devise}`}
              </div>
              {agencyProfile?.couleur_primaire && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-600">Couleurs:</span>
                  <div className="flex gap-1">
                    <div 
                      className="w-4 h-4 rounded border border-gray-300" 
                      style={{ backgroundColor: agencyProfile.couleur_primaire }}
                      title="Primaire"
                    />
                    <div 
                      className="w-4 h-4 rounded border border-gray-300" 
                      style={{ backgroundColor: agencyProfile.couleur_secondaire }}
                      title="Secondaire"
                    />
                  </div>
                </div>
              )}
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
              {recipientType === 'lead' && selectedLead.budget && ` - 💰 ${selectedLead.budget.toLocaleString()}${agencyProfile?.devise || 'FCFA'}`}
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
          onClick={() => generateDocument('mandat', 'Mandat de Vente')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📜</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Mandat de Vente</h3>
            <p className="text-sm text-gray-600 mb-4">Générez un mandat exclusif personnalisé</p>
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF Premium
            </div>
          </div>
        </div>

        {/* Bon de Visite */}
        <div 
          onClick={() => generateDocument('visite', 'Bon de Visite')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">👁️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bon de Visite</h3>
            <p className="text-sm text-gray-600 mb-4">Créez un bon de visite officiel</p>
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF Premium
            </div>
          </div>
        </div>

        {/* Devis */}
        <div 
          onClick={() => generateDocument('devis', 'Devis d\'Honoraires')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📑</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Devis</h3>
            <p className="text-sm text-gray-600 mb-4">Établissez un devis d'honoraires</p>
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF Premium
            </div>
          </div>
        </div>

        {/* Facture */}
        <div 
          onClick={() => generateDocument('facture', 'Facture d\'Honoraires')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">💶</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Facture</h3>
            <p className="text-sm text-gray-600 mb-4">Générez une facture professionnelle</p>
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF Premium
            </div>
          </div>
        </div>

      </div>

      {/* Guide d'utilisation */}
      <div className="mt-12 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Guide d'utilisation Premium</h3>
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
              <strong>Téléchargez</strong> votre PDF brandé
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
          <div className="text-sm text-gray-600">Documents Premium</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-green-600">∞</div>
          <div className="text-sm text-gray-600">Générations</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">100%</div>
          <div className="text-sm text-gray-600">Brandé</div>
        </div>
      </div>
    </div>
  )
}
