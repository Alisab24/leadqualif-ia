import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Building2, FileCheck, Save, Printer, Users, Settings, FileText, 
  Phone, Mail, MapPin, Hash, Globe, ChevronRight
} from 'lucide-react'

const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Commercial() {
  const [activeTab, setActiveTab] = useState('config')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState('')
  const [selectedDocType, setSelectedDocType] = useState('devis')
  
  // Configuration agence depuis localStorage
  const [agencyConfig, setAgencyConfig] = useState({
    nom: localStorage.getItem('agencyName') || '',
    adresse: localStorage.getItem('agencyAddress') || '',
    telephone: localStorage.getItem('agencyPhone') || '',
    siret: localStorage.getItem('agencySiret') || '',
    logo: localStorage.getItem('agencyLogo') || ''
  })

  // Charger les leads depuis l'API
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/leads-chauds`)
        const data = await res.json()
        
        if (data.status === 'success' && data.data.leads_chauds) {
          setLeads(data.data.leads_chauds.map(l => ({
            ...l,
            nom: l.nom || 'Prospect Inconnu',
            email: l.email || '',
            telephone: l.telephone || '',
            budget: l.budget || 0,
            type_bien: l.type_bien || 'Non précisé'
          })))
        }
      } catch (e) {
        console.error("Erreur de chargement des leads:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchLeads()
  }, [])

  // Sauvegarder configuration agence
  const saveAgencyConfig = () => {
    localStorage.setItem('agencyName', agencyConfig.nom)
    localStorage.setItem('agencyAddress', agencyConfig.adresse)
    localStorage.setItem('agencyPhone', agencyConfig.telephone)
    localStorage.setItem('agencySiret', agencyConfig.siret)
    localStorage.setItem('agencyLogo', agencyConfig.logo)
    alert('Configuration sauvegardée !')
  }

  // Générer et imprimer document
  const generateDocument = () => {
    if (!selectedLead) {
      alert('Veuillez sélectionner un lead')
      return
    }

    const lead = leads.find(l => l.id === parseInt(selectedLead))
    if (!lead) return

    const documentNumber = `DOC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    const currentDate = new Date().toLocaleDateString('fr-FR')
    const validityDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')

    const printWindow = window.open('', '', 'height=600,width=800')

    if (selectedDocType === 'devis' || selectedDocType === 'facture') {
      // MISE EN PAGE COMPTABLE (DEVIS/FACTURE)
      const isDevis = selectedDocType === 'devis'
      const montantHT = lead.budget ? Math.round(lead.budget * 0.05) : 0
      const tva = montantHT * 0.2
      const montantTTC = montantHT + tva

      printWindow.document.write(`
        <html>
          <head>
            <title>${isDevis ? 'DEVIS' : 'FACTURE'} - ${documentNumber}</title>
            <style>
              @page { margin: 1cm; size: A4; }
              body { 
                font-family: 'Helvetica Neue', Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0;
                padding: 20px;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
              }
              .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-start; 
                margin-bottom: 40px; 
                border-bottom: 3px solid #2563eb; 
                padding-bottom: 20px; 
              }
              .agency-info h1 { margin: 0; font-size: 24px; color: #1e40af; }
              .agency-info p { margin: 4px 0; font-size: 14px; color: #666; }
              .document-type { 
                text-align: right; 
                margin: 0; 
              }
              .document-type h2 { 
                margin: 0; 
                font-size: 36px; 
                font-weight: bold; 
                color: #1e40af; 
                text-transform: uppercase; 
              }
              .document-type p { margin: 8px 0; font-size: 14px; color: #666; }
              .info-bar { 
                background: #f8fafc; 
                border: 1px solid #e2e8f0; 
                padding: 15px; 
                margin-bottom: 30px; 
                display: flex; 
                justify-content: space-between; 
              }
              .info-bar span { font-size: 14px; }
              .parties { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 30px; 
                gap: 20px; 
              }
              .party-box { 
                flex: 1; 
                border: 1px solid #e2e8f0; 
                padding: 20px; 
                background: #f9fafb; 
              }
              .party-box h3 { 
                margin: 0 0 15px 0; 
                font-size: 16px; 
                color: #1e40af; 
                border-bottom: 2px solid #1e40af; 
                padding-bottom: 8px; 
              }
              .party-box p { margin: 6px 0; font-size: 14px; }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px; 
                border: 1px solid #e2e8f0; 
              }
              th { 
                background: #f1f5f9; 
                padding: 12px; 
                text-align: left; 
                font-weight: 600; 
                border-bottom: 1px solid #e2e8f0; 
                font-size: 14px; 
              }
              td { 
                padding: 12px; 
                border-bottom: 1px solid #e2e8f0; 
                font-size: 14px; 
              }
              .total-row { font-weight: bold; background: #f8fafc; }
              .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #e2e8f0; 
                font-size: 12px; 
                color: #666; 
              }
              .bank-info { 
                background: #f8fafc; 
                border: 1px solid #e2e8f0; 
                padding: 15px; 
                margin-bottom: 20px; 
                font-size: 14px; 
              }
              @media print {
                @page { margin: 1cm; size: A4; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                #ubersuggest-container, .grammarly-extension, #loom-companion-mv3 { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="agency-info">
                ${agencyConfig.logo ? `<img src="${agencyConfig.logo}" style="max-width: 200px; margin-bottom: 10px;" alt="Logo"><br>` : ''}
                <h1>${agencyConfig.nom || 'LeadQualif IA'}</h1>
                <p>${agencyConfig.adresse || 'Adresse non renseignée'}</p>
                <p>Tél: ${agencyConfig.telephone || 'Téléphone non renseigné'}</p>
                <p>SIRET: ${agencyConfig.siret || 'En cours'}</p>
              </div>
              <div class="document-type">
                <h2>${isDevis ? 'DEVIS' : 'FACTURE'}</h2>
                <p><strong>N° ${documentNumber}</strong></p>
                <p>Date: ${currentDate}</p>
                ${isDevis ? `<p>Validité: ${validityDate}</p>` : `<p>Échéance: 30 jours</p>`}
              </div>
            </div>

            <div class="info-bar">
              <span><strong>Client:</strong> ${lead.nom}</span>
              <span><strong>Email:</strong> ${lead.email}</span>
              <span><strong>Tél:</strong> ${lead.telephone || 'Non renseigné'}</span>
            </div>

            <div class="parties">
              <div class="party-box">
                <h3>Émetteur</h3>
                <p><strong>${agencyConfig.nom || 'LeadQualif IA'}</strong></p>
                <p>${agencyConfig.adresse || 'Adresse non renseignée'}</p>
                <p>Tél: ${agencyConfig.telephone || 'Téléphone non renseigné'}</p>
                <p>Email: contact@leadqualif-ia.fr</p>
                <p>SIRET: ${agencyConfig.siret || 'En cours'}</p>
              </div>
              <div class="party-box">
                <h3>Adressé à</h3>
                <p><strong>${lead.nom}</strong></p>
                <p>${lead.email}</p>
                <p>Tél: ${lead.telephone || 'Non renseigné'}</p>
                <p>Projet: ${lead.type_bien || 'Non précisé'}</p>
                <p>Budget: ${lead.budget ? lead.budget.toLocaleString() + ' €' : 'Non précisé'}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="width: 80px; text-align: center;">Qté</th>
                  <th style="width: 120px; text-align: right;">Prix Unitaire</th>
                  <th style="width: 120px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Honoraires de négociation immobilière (${lead.type_bien || 'bien immobilier'})</td>
                  <td style="text-align: center;">1</td>
                  <td style="text-align: right;">${montantHT.toLocaleString()} €</td>
                  <td style="text-align: right;">${montantHT.toLocaleString()} €</td>
                </tr>
                <tr>
                  <td>TVA (20%)</td>
                  <td style="text-align: center;">1</td>
                  <td style="text-align: right;">20%</td>
                  <td style="text-align: right;">${tva.toLocaleString()} €</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;"><strong>Total TTC</strong></td>
                  <td style="text-align: right;"><strong>${montantTTC.toLocaleString()} €</strong></td>
                </tr>
              </tbody>
            </table>

            <div class="bank-info">
              <strong>Coordonnées bancaires:</strong><br>
              IBAN: FR76 3000 6000 0112 3456 7890 123<br>
              BIC: SOGEFRPP<br>
              ${isDevis ? '<p><em>Devis valable jusqu\'au ' + validityDate + '. Acceptation du devis vaut contrat.</em></p>' : '<p><em>Paiement à 30 jours date de facture.</em></p>'}
            </div>

            <div class="footer">
              <p><strong>${agencyConfig.nom || 'LeadQualif IA'}</strong> - ${agencyConfig.adresse || ''} - ${agencyConfig.telephone || ''}</p>
              <p>Email: contact@leadqualif-ia.fr - SIRET: ${agencyConfig.siret || 'En cours'} - N° ${documentNumber}</p>
              <p>Conformément à la loi Hoguet, les honoraires sont à la charge du vendeur.</p>
            </div>
          </body>
        </html>
      `)
    } else {
      // MISE EN PAGE JURIDIQUE (MANDAT DE VENTE)
      printWindow.document.write(`
        <html>
          <head>
            <title>MANDAT DE VENTE - ${documentNumber}</title>
            <style>
              @page { margin: 1cm; size: A4; }
              body { 
                font-family: 'Times New Roman', serif; 
                line-height: 1.8; 
                color: #333; 
                margin: 0;
                padding: 40px;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
              }
              .header { 
                text-align: center; 
                margin-bottom: 40px; 
              }
              .title { 
                font-size: 28px; 
                font-weight: bold; 
                text-transform: uppercase; 
                margin: 0; 
                color: #1e40af; 
                letter-spacing: 2px;
              }
              .subtitle { 
                font-size: 16px; 
                margin: 10px 0; 
                color: #666; 
                font-style: italic;
              }
              .parties { 
                margin-bottom: 30px; 
              }
              .party { 
                margin-bottom: 20px; 
              }
              .party strong { 
                text-transform: uppercase; 
                color: #1e40af; 
              }
              .legal-text { 
                text-align: justify; 
                margin-bottom: 30px; 
                font-size: 14px;
                line-height: 1.8;
              }
              .signatures { 
                display: flex; 
                justify-content: space-between; 
                margin-top: 60px; 
              }
              .signature-box { 
                width: 45%; 
                border-top: 1px solid #333; 
                padding-top: 10px; 
                text-align: center;
              }
              .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #ccc; 
                font-size: 12px; 
                color: #666; 
                text-align: center;
              }
              @media print {
                @page { margin: 1cm; size: A4; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                #ubersuggest-container, .grammarly-extension, #loom-companion-mv3 { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">Mandat de Vente Exclusif</h1>
              <p class="subtitle">N° ${documentNumber} - ${currentDate}</p>
            </div>

            <div class="parties">
              <div class="party">
                <p><strong>Le Mandant:</strong> ${lead.nom}</p>
                <p>Email: ${lead.email}</p>
                <p>Téléphone: ${lead.telephone || 'Non renseigné'}</p>
                <p>Adresse: ${lead.adresse || 'À compléter'}</p>
              </div>
              <div class="party">
                <p><strong>Le Mandataire:</strong> ${agencyConfig.nom || 'LeadQualif IA'}</p>
                <p>${agencyConfig.adresse || 'Adresse non renseignée'}</p>
                <p>Tél: ${agencyConfig.telephone || 'Téléphone non renseigné'}</p>
                <p>SIRET: ${agencyConfig.siret || 'En cours'}</p>
              </div>
            </div>

            <div class="legal-text">
              <h3>OBJET DU MANDAT</h3>
              <p>
                Le soussigné ${lead.nom}, ci-après dénommé "le Mandant", donne par les présentes mandat exclusif à 
                ${agencyConfig.nom || 'LeadQualif IA'}, ci-après dénommé "le Mandataire", agence immobilière immatriculée 
                sous le numéro ${agencyConfig.siret || 'en cours'}, pour rechercher un acquéreur et négocier la vente du bien suivant :
              </p>
              <p><strong>Description du bien:</strong> ${lead.type_bien || 'Bien immobilier'} situé ${lead.adresse || 'adresse à préciser'}</p>
              <p><strong>Prix de vente souhaité:</strong> ${lead.budget ? lead.budget.toLocaleString() + ' €' : 'À définir'}</p>
              
              <h3>DURÉE DU MANDAT</h3>
              <p>
                Le présent mandat est consenti pour une durée de trois (3) mois à compter de ce jour. Il sera renouvelé 
                par tacite reconduction par périodes de trois (3) mois, sauf dénonciation par l'une des parties par 
                lettre recommandée avec accusé de réception quinze (15) jours avant l'expiration.
              </p>
              
              <h3>OBLIGATIONS DU MANDATAIRE</h3>
              <p>
                Le Mandataire s'engage à: 1) Assurer la promotion du bien par tous moyens appropriés; 
                2) Organiser les visites et présenter les offres d'achat; 3) Négocier les conditions de vente 
                dans l'intérêt du Mandant; 4) Assurer le suivi administratif jusqu'à la signature de l'acte authentique.
              </p>
              
              <h3>HONORAIRES</h3>
              <p>
                Conformément à la loi Hoguet du 2 janvier 1970, les honoraires de négociation sont fixés à 
                5% du prix de vente, TVA comprise, et seront à la charge exclusive de l'acquéreur. 
                Ces honoraires seront dus lors de la signature de l'acte authentique de vente.
              </p>
              
              <h3>EXCLUSIVITÉ</h3>
              <p>
                Le Mandant s'engage à ne pas confier à une autre agence ou à vendre directement le bien 
                pendant la durée du présent mandat. En cas de manquement à cette obligation, le Mandant 
                devra verser au Mandataire des dommages et intérêts égaux aux honoraires prévus.
              </p>
              
              <h3>RÉSILIATION</h3>
              <p>
                Le présent mandat pourra être résilié par accord mutuel des parties ou en cas de force majeure. 
                La résiliation unilatérale par le Mandant avant l'expiration du mandat entraînera le paiement 
                des honoraires prévus si la vente est réalisée dans un délai de six mois suivant la résiliation.
              </p>
              
              <p><strong>Fait à ${agencyConfig.adresse?.split(',')[0] || 'Lieu'}, le ${currentDate}</strong></p>
              <p>En deux exemplaires originaux, un pour chaque partie.</p>
            </div>

            <div class="signatures">
              <div class="signature-box">
                <p><strong>Le Mandant</strong></p>
                <p>${lead.nom}</p>
                <p>Signature et cachet</p>
              </div>
              <div class="signature-box">
                <p><strong>Le Mandataire</strong></p>
                <p>${agencyConfig.nom || 'LeadQualif IA'}</p>
                <p>Signature et cachet</p>
              </div>
            </div>

            <div class="footer">
              <p>${agencyConfig.nom || 'LeadQualif IA'} - ${agencyConfig.adresse || ''} - ${agencyConfig.telephone || ''}</p>
              <p>Email: contact@leadqualif-ia.fr - SIRET: ${agencyConfig.siret || 'En cours'} - N° ${documentNumber}</p>
              <p>Document soumis au secret professionnel - Loi Hoguet du 2 janvier 1970</p>
            </div>
          </body>
        </html>
      `)
    }

    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><Building2 size={20} /></div>
            <h1 className="text-xl font-bold">Espace <span className="text-blue-600">Professionnel</span></h1>
          </div>
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium px-4 py-2 hover:bg-slate-50 rounded-lg transition">
            <ChevronRight size={18} /> Retour Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        {/* Onglets */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-8">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'config' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings size={18} /> Configuration Agence
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'documents' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileCheck size={18} /> Générateur de Documents
            </button>
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Building2 className="text-blue-600" /> Configuration de l'Agence
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Hash size={16} className="inline mr-1" /> Nom de l'Agence
                </label>
                <input
                  type="text"
                  value={agencyConfig.nom}
                  onChange={(e) => setAgencyConfig({...agencyConfig, nom: e.target.value})}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Agence Immobilière Paris"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Phone size={16} className="inline mr-1" /> Téléphone
                </label>
                <input
                  type="tel"
                  value={agencyConfig.telephone}
                  onChange={(e) => setAgencyConfig({...agencyConfig, telephone: e.target.value})}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 01 23 45 67 89"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <MapPin size={16} className="inline mr-1" /> Adresse
                </label>
                <input
                  type="text"
                  value={agencyConfig.adresse}
                  onChange={(e) => setAgencyConfig({...agencyConfig, adresse: e.target.value})}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 123 Rue de la Paix, 75001 Paris"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Hash size={16} className="inline mr-1" /> SIRET/NIF
                </label>
                <input
                  type="text"
                  value={agencyConfig.siret}
                  onChange={(e) => setAgencyConfig({...agencyConfig, siret: e.target.value})}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 12345678901234"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Globe size={16} className="inline mr-1" /> URL du Logo
                </label>
                <input
                  type="url"
                  value={agencyConfig.logo}
                  onChange={(e) => setAgencyConfig({...agencyConfig, logo: e.target.value})}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>

            <button
              onClick={saveAgencyConfig}
              className="mt-6 flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg"
            >
              <Save size={18} /> Sauvegarder la Configuration
            </button>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <FileCheck className="text-green-600" /> Générateur de Documents
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Users size={16} className="inline mr-1" /> Sélectionner un Lead
                </label>
                <select
                  value={selectedLead}
                  onChange={(e) => setSelectedLead(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choisir un lead...</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>
                      {lead.nom} - {lead.budget ? lead.budget.toLocaleString() + ' €' : 'Budget non précisé'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <FileText size={16} className="inline mr-1" /> Type de Document
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setSelectedDocType('devis')}
                    className={`p-4 rounded-xl border-2 transition ${
                      selectedDocType === 'devis' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileCheck className="mx-auto mb-2" />
                    <div className="font-bold">Devis Honoraires</div>
                  </button>
                  <button
                    onClick={() => setSelectedDocType('mandat')}
                    className={`p-4 rounded-xl border-2 transition ${
                      selectedDocType === 'mandat' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileText className="mx-auto mb-2" />
                    <div className="font-bold">Mandat de Vente</div>
                  </button>
                  <button
                    onClick={() => setSelectedDocType('facture')}
                    className={`p-4 rounded-xl border-2 transition ${
                      selectedDocType === 'facture' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileCheck className="mx-auto mb-2" />
                    <div className="font-bold">Facture</div>
                  </button>
                </div>
              </div>

              <button
                onClick={generateDocument}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-green-700 transition shadow-lg"
              >
                <Printer size={20} /> Générer & Imprimer
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
