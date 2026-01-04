import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('kanban') // 'list' ou 'kanban'

  // Modale simplifiée pour éviter les erreurs de build
  const [selectedLead, setSelectedLead] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  // Configuration du Pipeline
  const STATUS_ORDER = ['À traiter', 'Message laissé', 'RDV Pris', 'Offre en cours', 'Vendu', 'Perdu']

  // Couleurs des étiquettes
  const STATUS_COLORS = {
    'À traiter': 'bg-red-100 text-red-800 border-red-200',
    'Message laissé': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'RDV Pris': 'bg-blue-100 text-blue-800 border-blue-200',
    'Offre en cours': 'bg-purple-100 text-purple-800 border-purple-200',
    'Vendu': 'bg-green-100 text-green-800 border-green-200',
    'Perdu': 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Fonction pour copier le lien
  const copyEstimationLink = async () => {
    const url = window.location.origin + '/estimation'
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('Lien copié !')
      setTimeout(() => setCopyMessage(''), 2000)
    } catch (err) {
      console.error('Erreur copie:', err)
      setCopyMessage('Erreur')
      setTimeout(() => setCopyMessage(''), 2000)
    }
  }

  // 1. WhatsApp (Nettoie le numéro et ouvre l'app avec message pré-rempli)
  const openWhatsApp = (e, lead) => {
    e.stopPropagation(); // Empêche d'ouvrir la modale
    if (!lead.telephone) return alert("Pas de numéro de téléphone renseigné.");
    
    // Nettoyage basique du numéro (garde que les chiffres)
    const phone = lead.telephone.replace(/[^0-9]/g, '');
    const message = `Bonjour ${lead.nom}, je suis votre conseiller LeadQualif. J'ai bien reçu votre demande d'estimation. Avez-vous un moment pour échanger ?`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  // 2. Email (Ouvre le client mail avec Sujet et Corps pré-remplis)
  const openEmail = (e, lead) => {
    e.stopPropagation();
    if (!lead.email) return alert("Pas d'email renseigné.");

    const subject = `Votre projet immobilier - Estimation ${lead.type_bien || ''}`;
    const body = `Bonjour ${lead.nom},\n\nJe fais suite à votre estimation sur notre site.\n\nQuand seriez-vous disponible pour en discuter ?\n\nCordialement,`;

    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // 3. RDV (Ouvre Google Agenda pour créer un événement pré-rempli)
  const openCalendar = (e, lead) => {
    e.stopPropagation();
    const title = `RDV Client : ${lead.nom}`;
    const details = `Tel: ${lead.telephone}\nEmail: ${lead.email}\nBudget: ${lead.budget}€`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}`;

    window.open(url, '_blank');
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('agency_id').eq('user_id', user.id).single()
        if (profile?.agency_id) {
          const { data } = await supabase.from('leads').select('*').eq('agency_id', profile.agency_id).order('created_at', { ascending: false })
          setLeads(data || [])
        }
      }
    } catch (error) {
      console.error("Erreur chargement:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (leadId, newStatus) => {
    // Mise à jour immédiate (Optimistic UI)
    setLeads(leads.map(l => l.id === leadId ? { ...l, statut: newStatus } : l))

    // Sauvegarde en base
    await supabase.from('leads').update({ statut: newStatus }).eq('id', leadId)
    // Historique
    await supabase.from('activities').insert([{ 
      lead_id: leadId, 
      type: 'statut', 
      description: `Statut passé à ${newStatus}` 
    }])
  }

  const calculateScore = (lead) => {
    let score = 3
    if (lead.budget > 200000) score += 2
    if (lead.telephone) score += 3
    if (lead.email) score += 2
    return Math.min(score, 10)
  }

  const openModal = (lead) => {
    setSelectedLead(lead)
    setIsModalOpen(true)
  }

  if (loading) return "Chargement du Pipeline..."

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec toggle */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {viewMode === 'kanban' ? 'Pipeline des Ventes' : 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
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
            
            {/* Nouveau bloc d'actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                + Nouveau Lead
              </button>
              
              <div className="relative">
                <button
                  onClick={copyEstimationLink}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  title="Copier le lien d'estimation"
                >
                  📋
                </button>
                
                {/* Message de copie */}
                {copyMessage && (
                  <div className="absolute -top-8 right-0 bg-green-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                    {copyMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VUE PIPELINE (KANBAN) */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-8 items-start min-h-[500px] p-6">
          {STATUS_ORDER.map(statut => (
            <div key={statut} className="min-w-[280px] w-72 bg-slate-100 rounded-xl p-3 flex flex-col shrink-0">
              <div className={`font-bold uppercase text-xs mb-3 px-3 py-1.5 rounded-lg w-fit ${STATUS_COLORS[statut] || 'bg-gray-200'}`}>
                {statut} • {leads.filter(l => (l.statut || 'À traiter') === statut).length}
              </div>
              
              <div className="flex-1 space-y-3">
                {leads.filter(l => (l.statut || 'À traiter') === statut).map(lead => (
                  <div key={lead.id} onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }} className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-800 text-sm">{lead.nom}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${calculateScore(lead) >= 7 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                          Score: {calculateScore(lead)}/10
                        </span>
                        <span className="text-xs text-gray-500">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {lead.type_bien} • {lead.budget ? `${lead.budget.toLocaleString()}€` : 'Budget non défini'}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      📧 {lead.email} • 📞 {lead.telephone}
                    </p>
                    
                    {/* Actions Rapides */}
                    <div className="flex gap-2 mb-3 mt-2">
                      <button 
                        onClick={(e) => openWhatsApp(e, lead)}
                        className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Ouvrir WhatsApp"
                      >
                        💬 WhatsApp
                      </button>
                      
                      <button 
                        onClick={(e) => openCalendar(e, lead)}
                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Planifier RDV"
                      >
                        📅 RDV
                      </button>
                      
                      <button 
                        onClick={(e) => openEmail(e, lead)}
                        className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="Envoyer Email"
                      >
                        ✉ Email
                      </button>
                    </div>

                    <div className="border-t pt-2 flex justify-between items-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateStatus(lead.id, STATUS_ORDER[STATUS_ORDER.indexOf(statut) - 1]); }}
                        disabled={STATUS_ORDER.indexOf(statut) === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed text-sm"
                      >
                        ←
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateStatus(lead.id, STATUS_ORDER[STATUS_ORDER.indexOf(statut) + 1]); }}
                        disabled={STATUS_ORDER.indexOf(statut) === STATUS_ORDER.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed text-sm"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VUE LISTE (TABLEAU) */}
      {viewMode === 'list' && (
        <div className="p-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              {/* En-tête du tableau */}
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left font-bold text-gray-500">Prospect</th>
                  <th className="p-4 text-left font-bold text-gray-500">Budget</th>
                  <th className="p-4 text-left font-bold text-gray-500">Score IA</th> {/* Nouvelle Colonne */}
                  <th className="p-4 text-left font-bold text-gray-500">Statut</th>
                  <th className="p-4 text-left font-bold text-gray-500">Actions Rapides</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">
                      {lead.nom}
                      <div className="text-xs text-gray-400">{lead.type_bien}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{lead.budget?.toLocaleString()} €</td>
                    
                    {/* Colonne Score IA */}
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${calculateScore(lead) >= 7 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                        {calculateScore(lead)}/10
                      </span>
                    </td>
                    <td className="p-4">
                      <select 
                        value={lead.statut || 'À traiter'}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 text-xs rounded p-1"
                      >
                        {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    {/* Colonne Actions (Version Compacte) */}
                    <td className="p-4 flex gap-2">
                      <button onClick={(e) => openWhatsApp(e, lead)} className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200" title="WhatsApp">💬</button>
                      <button onClick={(e) => openCalendar(e, lead)} className="p-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200" title="RDV">📅</button>
                      <button onClick={(e) => openEmail(e, lead)} className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Email">✉</button>
                      <button onClick={() => openModal(lead)} className="p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" title="Voir Dossier">👁️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE SIMPLE */}
      {isModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform transition-all overflow-hidden">
             <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{selectedLead.nom}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
             </div>
             <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs text-blue-600 font-bold uppercase">Budget</p>
                        <p className="font-bold text-lg">{selectedLead.budget?.toLocaleString()} €</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-xs text-purple-600 font-bold uppercase">Projet</p>
                        <p className="font-bold">{selectedLead.type_bien || 'Non défini'}</p>
                    </div>
                </div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Contact</p>
                    <p>📧 {selectedLead.email || 'Pas d\'email'}</p>
                    <p>📞 {selectedLead.telephone || 'Pas de téléphone'}</p>
                    <p>📍 {selectedLead.adresse || 'Pas d\'adresse'}</p>
                </div>
             </div>
             <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Fermer</button>
                {selectedLead.telephone && (
                    <a href={`tel:${selectedLead.telephone}`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm">
                        📞 Appeler
                    </a>
                )}
             </div>
          </div>
        </div>
      )}

      {/* MODALE CRÉATION LEAD */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all overflow-hidden">
             <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Nouveau Lead</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
             </div>
             <div className="p-6">
                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Jean Dupont" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="jean@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                        <input type="tel" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="06 12 34 56 78" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type de bien</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option>Maison</option>
                            <option>Appartement</option>
                            <option>Terrain</option>
                        </select>
                    </div>
                </form>
             </div>
             <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annuler</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    Créer le Lead
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
