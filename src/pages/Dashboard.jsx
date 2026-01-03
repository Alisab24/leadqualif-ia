import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('kanban') // 'list' ou 'kanban'

  // Modale simplifiée pour éviter les erreurs de build
  const [selectedLead, setSelectedLead] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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
                  <div key={lead.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group relative" onClick={() => openModal(lead)}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-800 truncate block w-2/3">{lead.nom}</span>
                      <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded font-bold border border-blue-100">
                        {calculateScore(lead)}/10
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mb-1">
                      {lead.budget ? lead.budget.toLocaleString() + ' €' : '-'}
                    </div>
                    <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                      <span>🏠</span> {lead.type_bien || 'Projet Immo'}
                    </div>
                    
                    <div className="flex justify-between items-center border-t pt-2 mt-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button 
                        disabled={STATUS_ORDER.indexOf(statut) === 0}
                        onClick={() => updateStatus(lead.id, STATUS_ORDER[STATUS_ORDER.indexOf(statut) - 1])}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-slate-800 disabled:opacity-0"
                      >
                        ◀
                      </button>
                      <button className="text-xs text-blue-500 font-bold hover:underline" onClick={() => openModal(lead)}>
                        Détails
                      </button>
                      <button 
                        disabled={STATUS_ORDER.indexOf(statut) === STATUS_ORDER.length - 1}
                        onClick={() => updateStatus(lead.id, STATUS_ORDER[STATUS_ORDER.indexOf(statut) + 1])}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-slate-800 disabled:opacity-0"
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
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase">Prospect</th>
                  <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase">Budget</th>
                  <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase">Statut</th>
                  <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{lead.nom}</td>
                    <td className="p-4 font-bold text-slate-600">{lead.budget?.toLocaleString()} €</td>
                    <td className="p-4">
                      <select 
                        value={lead.statut || 'À traiter'}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                      >
                        {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <button onClick={() => openModal(lead)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        Voir dossier
                      </button>
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
    </div>
  )
}
