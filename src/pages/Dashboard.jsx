import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, Link } from 'react-router-dom'
import jsPDF from 'jspdf'

// Header component
function Header({ title, showPipelineToggle, viewMode, setViewMode }) {
  return (
    <div className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-4">
          {showPipelineToggle && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Vue Liste
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Vue Pipeline
              </button>
            </div>
          )}
          <Link
            to="/estimation"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Nouvelle Estimation
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  // --- ÉTATS (MÉMOIRE) ---
  const [session, setSession] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [agencyId, setAgencyId] = useState(null)
  const [agencyProfile, setAgencyProfile] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' ou 'kanban'

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

  // Pipeline Kanban view
  const PipelineView = () => {
    const statuses = ['À traiter', 'Message laissé', 'RDV Pris', 'Offre', 'Vendu']
    
    const updateLeadStatus = async (leadId, newStatus) => {
      try {
        const { error } = await supabase
          .from('leads')
          .update({ statut: newStatus })
          .eq('id', leadId)
        
        if (error) throw error
        
        // Update local state
        setLeads(leads.map(lead => 
          lead.id === leadId ? { ...lead, statut: newStatus } : lead
        ))
        
        // Log activity
        await logAction('statut', `Statut changé vers: ${newStatus}`)
      } catch (error) {
        console.error('Erreur mise à jour statut:', error)
      }
    }
    
    const getStatusColor = (status) => {
      const colors = {
        'À traiter': 'bg-gray-100 text-gray-800',
        'Message laissé': 'bg-blue-100 text-blue-800',
        'RDV Pris': 'bg-yellow-100 text-yellow-800',
        'Offre': 'bg-purple-100 text-purple-800',
        'Vendu': 'bg-green-100 text-green-800'
      }
      return colors[status] || 'bg-gray-100 text-gray-800'
    }
    
    return (
      <div className="p-8">
        <div className="flex gap-6 overflow-x-auto pb-4">
          {statuses.map(status => (
            <div key={status} className="flex-shrink-0 w-80">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-gray-700">{status}</h3>
                <span className="text-sm text-gray-500">
                  {leads.filter(l => l.statut === status).length} prospects
                </span>
              </div>
              
              <div className="space-y-3 min-h-96">
                {leads
                  .filter(lead => lead.statut === status)
                  .map(lead => (
                    <div key={lead.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{lead.nom}</h4>
                          <p className="text-sm text-gray-600">{lead.email}</p>
                          {lead.telephone && (
                            <p className="text-sm text-gray-600">{lead.telephone}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.statut)}`}>
                          {lead.statut}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="text-sm">
                          {lead.budget && (
                            <span className="font-bold text-blue-600">{lead.budget}</span>
                          )}
                          {lead.score_ia && (
                            <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                              Score: {lead.score_ia}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const currentIndex = statuses.indexOf(status)
                              if (currentIndex > 0) {
                                updateLeadStatus(lead.id, statuses[currentIndex - 1])
                              }
                            }}
                            disabled={statuses.indexOf(status) === 0}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Statut précédent"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => {
                              const currentIndex = statuses.indexOf(status)
                              if (currentIndex < statuses.length - 1) {
                                updateLeadStatus(lead.id, statuses[currentIndex + 1])
                              }
                            }}
                            disabled={statuses.indexOf(status) === statuses.length - 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Statut suivant"
                          >
                            →
                          </button>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedLead(lead)
                          setIsModalOpen(true)
                        }}
                        className="mt-3 w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Voir les détails →
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Fonction pour logger les actions
  const logAction = async (type, desc) => {
    if (!selectedLead) return;
    await supabase.from('activities').insert([{ lead_id: selectedLead.id, type, description: desc }])
    // Rafraîchir l'historique si nécessaire
    if (selectedLead) {
      const { data } = await supabase.from('activities').select('*').eq('lead_id', selectedLead.id).order('created_at', { ascending: false })
      setActivities(data || [])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title={viewMode === 'kanban' ? 'Pipeline des Ventes' : 'Dashboard'}
        showPipelineToggle={true}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      ) : viewMode === 'kanban' ? (
        <PipelineView />
      ) : (
        <div className="p-8">

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
      )}
      
      {/* Modal */}
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
