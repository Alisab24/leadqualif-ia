import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, Link } from 'react-router-dom'
import jsPDF from 'jspdf'

export default function Dashboard() {
  // --- ÉTATS (MÉMOIRE) ---
  const [session, setSession] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [agencyId, setAgencyId] = useState(null)
  const [agencyProfile, setAgencyProfile] = useState(null)

  // États pour la Modale (Fiche prospect)
  const [selectedLead, setSelectedLead] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // 'details' ou 'marketing'
  const [activities, setActivities] = useState([])
  const [generatedAd, setGeneratedAd] = useState('')

  const navigate = useNavigate()

  // --- CHARGEMENT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) getData(session.user.id)
      else setLoading(false)
    })
  }, [])

  async function getData(userId) {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
      if (profile?.agency_id) {
        setAgencyId(profile.agency_id)
        setAgencyProfile(profile)
        fetchLeads(profile.agency_id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLeads(id) {
    const { data } = await supabase.from('leads').select('*').eq('agency_id', id).order('created_at', { ascending: false })
    setLeads(data || [])
  }

  // --- LOGIQUE MÉTIER ---

  // 1. Calcul du Score
  const calculateScore = (lead) => {
    let score = 3;
    if (lead.budget > 200000) score += 2;
    if (lead.telephone) score += 3;
    if (lead.email) score += 2;
    return Math.min(score, 10);
  }

  // 2. Nettoyage numéro téléphone pour WhatsApp
  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '33' + cleaned.substring(1);
    } else if (cleaned.startsWith('33') && cleaned.length === 11) {
      return cleaned;
    }
    return cleaned;
  }

  // 3. Génération PDF
  const generatePDF = (lead) => {
    const doc = new jsPDF()
    
    // En-tête
    doc.setFontSize(20)
    doc.text('Fiche Prospect', 20, 20)
    
    // Informations client
    doc.setFontSize(12)
    doc.text(`Nom: ${lead.nom}`, 20, 40)
    doc.text(`Email: ${lead.email}`, 20, 50)
    doc.text(`Téléphone: ${lead.telephone || 'Non renseigné'}`, 20, 60)
    
    // Projet
    doc.text('Projet:', 20, 80)
    doc.text(`Budget: ${lead.budget ? lead.budget.toLocaleString() + ' €' : '-'}`, 20, 90)
    doc.text(`Type de bien: ${lead.type_bien || '-'}`, 20, 100)
    doc.text(`Score IA: ${calculateScore(lead)}/10`, 20, 110)
    doc.text(`Statut: ${lead.statut || 'À traiter'}`, 20, 120)
    
    // Pied de page
    doc.setFontSize(10)
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} par LeadQualif IA`, 20, 280)
    
    // Télécharger le PDF
    doc.save(`fiche-prospect-${lead.nom.replace(/\s+/g, '-')}.pdf`)
    
    // Logger l'action
    logAction('pdf', 'Fiche PDF téléchargée')
  }

  // 4. Gestion Modale & Activités
  const openModal = (lead) => {
    setSelectedLead(lead)
    setActiveTab('details')
    setGeneratedAd('') // Reset IA
    setIsModalOpen(true)
    fetchActivities(lead.id)
  }

  async function fetchActivities(leadId) {
    const { data } = await supabase.from('activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
    setActivities(data || [])
  }

  async function logAction(type, desc) {
    if (!selectedLead) return;
    await supabase.from('activities').insert([{ lead_id: selectedLead.id, type, description: desc }])
    fetchActivities(selectedLead.id) // Rafraîchir l'historique
  }

  // 5. IA Générative (Simulée JS)
  const generateAIAd = () => {
    if (!selectedLead) return;
    const text = `🔥 OPPORTUNITÉ À SAISIR !

Nous recherchons activement pour un client sérieux un bien type ${selectedLead.type_bien || 'Immobilier'}.
Budget validé : ${selectedLead.budget?.toLocaleString()} ${agencyProfile?.devise || '€'}.

Secteur recherché : ${selectedLead.secteur || 'Alentours'}.

Vous vendez ? Contactez-nous vite pour une estimation gratuite !`
    setGeneratedAd(text)
  }

  // 6. Vérifier si le lead est récent (moins de 24h)
  const isRecentLead = (lead) => {
    if (!lead.created_at) return false;
    const createdDate = new Date(lead.created_at)
    const now = new Date()
    const diffHours = (now - createdDate) / (1000 * 60 * 60)
    return diffHours < 24
  }

  // 7. Mise à jour du statut
  const updateStatut = async (leadId, nouveauStatut) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ statut: nouveauStatut })
        .eq('id', leadId)
      
      if (error) {
        console.error('Erreur mise à jour statut:', error)
      } else {
        // Mettre à jour l'état local
        setLeads(leads.map(lead => 
          lead.id === leadId ? { ...lead, statut: nouveauStatut } : lead
        ))
        
        // Logger le changement de statut dans l'historique
        await supabase
          .from('activities')
          .insert([{
            lead_id: leadId,
            type: 'statut',
            description: `Statut passé à ${nouveauStatut}`,
            created_at: new Date().toISOString()
          }])
        
        // Si le lead est actuellement sélectionné, rafraîchir l'historique
        if (selectedLead && selectedLead.id === leadId) {
          fetchActivities(leadId)
        }
      }
    } catch (error) {
      console.error('Erreur updateStatut:', error)
    }
  }

  // 8. Fonction pour générer le lien d'estimation
  const getEstimationLink = () => {
    if (!agencyId) return '#'
    return `${window.location.origin}/estimation?aid=${agencyId}`
  }

  // 9. Fonction pour obtenir la couleur du statut
  const getStatutColor = (statut) => {
    switch(statut) {
      case 'À traiter': return 'bg-red-100 text-red-700'
      case 'Message laissé': return 'bg-yellow-100 text-yellow-700'
      case 'RDV Pris': return 'bg-blue-100 text-blue-700'
      case 'Offre en cours': return 'bg-purple-100 text-purple-700'
      case 'Vendu': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  // --- RENDU ---
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-slate-600">Chargement...</p></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 p-8">
        <header className="flex justify-between mb-8">
          <h2 className="text-2xl font-bold">Vos Prospects</h2>
          <div className="flex gap-3">
            <Link 
              to="/app/commercial"
              className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              📂 Espace Documents
            </Link>
            <Link 
              to="/app/settings"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              ⚙️ Paramètres
            </Link>
            <button 
              onClick={() => window.open(getEstimationLink(), '_blank')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              ➕ Nouvelle Estimation
            </button>
            <button onClick={() => supabase.auth.signOut()} className="text-red-500">Déconnexion</button>
          </div>
        </header>
        {/* Tableau */}
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-4 text-left">Nom</th>
                <th className="p-4 text-left">Budget</th>
                <th className="p-4 text-left">Statut</th>
                <th className="p-4 text-left">Score IA</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-bold">{lead.nom}</div>
                    <div className="text-sm text-gray-500">{lead.email}</div>
                  </td>
                  <td className="p-4 font-mono">{lead.budget?.toLocaleString()} {agencyProfile?.devise || '€'}</td>
                  <td className="p-4">
                    <select 
                      value={lead.statut || 'À traiter'}
                      onChange={(e) => updateStatut(lead.id, e.target.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border-0 cursor-pointer ${getStatutColor(lead.statut || 'À traiter')}`}
                    >
                      <option value="À traiter">À traiter</option>
                      <option value="Message laissé">Message laissé</option>
                      <option value="RDV Pris">RDV Pris</option>
                      <option value="Offre en cours">Offre en cours</option>
                      <option value="Vendu">Vendu</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                      {calculateScore(lead)}/10
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => openModal(lead)}
                      className="bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700 flex items-center gap-2"
                    >
                      👁️ Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE (Fiche Prospect) */}
      {isModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex overflow-hidden shadow-2xl">
            
            {/* Colonne Gauche : Infos */}
            <div className="w-2/3 p-8 overflow-y-auto border-r">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">{selectedLead.nom}</h2>
                  <p className="text-gray-500">Ajouté le {new Date(selectedLead.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  {isRecentLead(selectedLead) && (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                      🆕 Nouveau
                    </span>
                  )}
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black text-xl">✕</button>
                </div>
              </div>
              
              {/* Onglets */}
              <div className="flex gap-4 border-b mb-6">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={`pb-2 ${activeTab === 'details' ? 'border-b-2 border-blue-600 font-bold' : 'text-gray-500'}`}
                >
                  Détails Client
                </button>
                <button 
                  onClick={() => setActiveTab('marketing')}
                  className={`pb-2 ${activeTab === 'marketing' ? 'border-b-2 border-purple-600 font-bold text-purple-600' : 'text-gray-500'}`}
                >
                  ✨ Assistant IA
                </button>
              </div>
              
              {activeTab === 'details' ? (
                <div className="space-y-6">
                  {/* Informations principales avec icônes */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-600">💰</span>
                        <p className="text-xs text-gray-500 uppercase">Budget</p>
                      </div>
                      <p className="text-xl font-bold">{selectedLead.budget?.toLocaleString()} {agencyProfile?.devise || '€'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-600">📞</span>
                        <p className="text-xs text-gray-500 uppercase">Téléphone</p>
                      </div>
                      <p className="text-xl font-bold text-blue-600">{selectedLead.telephone || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-purple-600">🏠</span>
                        <p className="text-xs text-gray-500 uppercase">Type de bien</p>
                      </div>
                      <p className="text-lg font-bold">{selectedLead.type_bien || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-orange-600">📍</span>
                        <p className="text-xs text-gray-500 uppercase">Secteur</p>
                      </div>
                      <p className="text-lg font-bold">{selectedLead.secteur || '-'}</p>
                    </div>
                  </div>
                  
                  {/* Grille de boutons 2x2 */}
                  <div className="grid grid-cols-2 gap-4">
                    <a 
                      href={`tel:${selectedLead.telephone}`} 
                      onClick={() => logAction('appel', 'Appel téléphonique')}
                      className="bg-green-500 hover:bg-green-600 text-white py-4 rounded-lg text-center font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      📞 Appeler
                    </a>
                    <a 
                      href={`mailto:${selectedLead.email}`}
                      onClick={() => logAction('email', 'Email envoyé')}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg text-center font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      ✉️ Email
                    </a>
                    <a 
                      href={`https://wa.me/${cleanPhoneNumber(selectedLead.telephone)}`}
                      onClick={() => logAction('whatsapp', 'Message WhatsApp envoyé')}
                      target="_blank"
                      className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg text-center font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      💬 WhatsApp
                    </a>
                    <a 
                      href="https://calendly.com/"
                      onClick={() => logAction('rdv', 'Prise de RDV')}
                      target="_blank"
                      className="bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg text-center font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      📅 Prendre RDV
                    </a>
                  </div>
                  
                  {/* Bouton PDF en bas */}
                  <button 
                    onClick={() => generatePDF(selectedLead)}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-lg text-center font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    📄 Télécharger Fiche PDF
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                    <h3 className="font-bold text-purple-800 mb-2">Générateur d'Annonce Facebook/Insta</h3>
                    <p className="text-sm text-gray-600 mb-4">L'IA rédige une annonce de recherche basée sur ce prospect.</p>
                    <button 
                      onClick={generateAIAd}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 w-full transition-colors"
                    >
                      ✨ Générer l'annonce maintenant
                    </button>
                  </div>
                  {generatedAd && (
                    <textarea 
                      className="w-full h-40 p-4 border rounded-lg bg-gray-50 text-sm font-mono"
                      value={generatedAd}
                      readOnly
                    />
                  )}
                </div>
              )}
            </div>
            
            {/* Colonne Droite : Historique */}
            <div className="w-1/3 bg-gray-50 p-6 overflow-y-auto border-l">
              <h3 className="font-bold text-gray-500 uppercase text-xs mb-4">Historique d'activités</h3>
              <div className="space-y-4">
                {activities.length === 0 && <p className="text-sm text-gray-400 italic">Aucune activité.</p>}
                {activities.map(act => (
                  <div key={act.id} className="text-sm">
                    <div className="font-bold text-gray-800">
                      {act.type === 'appel' ? '📞 Appel' : 
                       act.type === 'email' ? '✉️ Email' :
                       act.type === 'whatsapp' ? '💬 WhatsApp' :
                       act.type === 'rdv' ? '📅 RDV' :
                       act.type === 'pdf' ? '📄 PDF' :
                       act.type === 'statut' ? '🔄 Changement Statut' :
                       '📝 Note'}
                    </div>
                    <div className="text-gray-600">{act.description}</div>
                    <div className="text-xs text-gray-400">{new Date(act.created_at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
