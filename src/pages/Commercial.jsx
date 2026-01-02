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

    const documentContent = `
      <html>
        <head>
          <title>${selectedDocType === 'devis' ? 'Devis Honoraires' : selectedDocType === 'mandat' ? 'Mandat de Vente' : 'Facture'} - ${agencyConfig.nom || 'LeadQualif IA'}</title>
          <style>
            @page { margin: 2cm; }
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
            .agency-info { margin-bottom: 30px; }
            .client-info { margin-bottom: 30px; }
            .document-title { text-align: center; font-size: 24px; font-weight: bold; margin: 30px 0; }
            .content { margin: 30px 0; }
            .footer { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 20px; font-size: 12px; }
            .logo { max-width: 200px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${agencyConfig.logo ? `<img src="${agencyConfig.logo}" class="logo" alt="Logo">` : ''}
            <h1>${agencyConfig.nom || 'LeadQualif IA'}</h1>
            <div class="agency-info">
              <p><strong>Adresse :</strong> ${agencyConfig.adresse || 'Non renseignée'}</p>
              <p><strong>Téléphone :</strong> ${agencyConfig.telephone || 'Non renseigné'}</p>
              <p><strong>SIRET/NIF :</strong> ${agencyConfig.siret || 'Non renseigné'}</p>
            </div>
          </div>

          <div class="client-info">
            <h2>Informations Client</h2>
            <p><strong>Nom :</strong> ${lead.nom}</p>
            <p><strong>Email :</strong> ${lead.email}</p>
            <p><strong>Téléphone :</strong> ${lead.telephone}</p>
            <p><strong>Budget :</strong> ${lead.budget ? lead.budget.toLocaleString() + ' €' : 'Non précisé'}</p>
            <p><strong>Type de bien :</strong> ${lead.type_bien}</p>
          </div>

          <div class="document-title">
            ${selectedDocType === 'devis' ? 'DEVIS HONORAIRES' : selectedDocType === 'mandat' ? 'MANDAT DE VENTE' : 'FACTURE'}
          </div>

          <div class="content">
            ${selectedDocType === 'devis' ? `
              <h3>Honoraires de négociation</h3>
              <p>Conformément à la loi Hoguet, nos honoraires sont à la charge du vendeur.</p>
              <p><strong>Taux :</strong> 5% du montant de la vente</p>
              <p><strong>Montant estimé :</strong> ${lead.budget ? Math.round(lead.budget * 0.05).toLocaleString() + ' €' : 'À calculer'}</p>
              <p><strong>Honoraires TTC :</strong> ${lead.budget ? Math.round(lead.budget * 0.06).toLocaleString() + ' €' : 'À calculer'}</p>
            ` : selectedDocType === 'mandat' ? `
              <h3>Mandat de Vente Exclusif</h3>
              <p>Le soussigné ${lead.nom} donne mandat exclusif à ${agencyConfig.nom || 'LeadQualif IA'} pour la vente de son bien.</p>
              <p><strong>Bien :</strong> ${lead.type_bien}</p>
              <p><strong>Budget souhaité :</strong> ${lead.budget ? lead.budget.toLocaleString() + ' €' : 'À définir'}</p>
              <p><strong>Durée du mandat :</strong> 3 mois renouvelable</p>
              <p>Fait à ${agencyConfig.adresse?.split(',')[0] || 'Lieu'}, le ${new Date().toLocaleDateString('fr-FR')}</p>
            ` : `
              <h3>Facture d'Honoraires</h3>
              <p><strong>Client :</strong> ${lead.nom}</p>
              <p><strong>Prestation :</strong> Honoraires de négociation immobilière</p>
              <p><strong>Montant HT :</strong> ${lead.budget ? Math.round(lead.budget * 0.05).toLocaleString() + ' €' : 'À calculer'}</p>
              <p><strong>TVA (20%) :</strong> ${lead.budget ? Math.round(lead.budget * 0.01).toLocaleString() + ' €' : 'À calculer'}</p>
              <p><strong>Total TTC :</strong> ${lead.budget ? Math.round(lead.budget * 0.06).toLocaleString() + ' €' : 'À calculer'}</p>
              <p><strong>Échéance :</strong> 30 jours</p>
            `}
          </div>

          <div class="footer">
            <p>${agencyConfig.nom || 'LeadQualif IA'} - ${agencyConfig.adresse || ''} - ${agencyConfig.telephone || ''}</p>
            <p>Email : contact@leadqualif-ia.fr - SIRET : ${agencyConfig.siret || 'En cours'}</p>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(documentContent)
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
