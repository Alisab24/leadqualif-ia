import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, Link } from 'react-router-dom'

export default function Dashboard() {
  // --- ÉTATS (MÉMOIRE) ---
  const [session, setSession] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [agencyId, setAgencyId] = useState(null)

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
      const { data: profile } = await supabase.from('profiles').select('agency_id').eq('user_id', userId).single()
      if (profile?.agency_id) {
        setAgencyId(profile.agency_id)
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

  // 2. Gestion Modale & Activités
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

  // 3. IA Générative (Simulée JS)
  const generateAIAd = () => {
    if (!selectedLead) return;
    const text = `🔥 OPPORTUNITÉ À SAISIR !

Nous recherchons activement pour un client sérieux un bien type ${selectedLead.type_bien || 'Immobilier'}.
Budget validé : ${selectedLead.budget?.toLocaleString()}€.

Secteur recherché : ${selectedLead.secteur || 'Alentours'}.

Vous vendez ? Contactez-nous vite pour une estimation gratuite !`
    setGeneratedAd(text)
  }

  // --- RENDU ---
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-slate-600">Chargement...</p></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 p-8">
        <header className="flex justify-between mb-8">
          <h2 className="text-2xl font-bold">Vos Prospects</h2>
          <button onClick={() => supabase.auth.signOut()} className="text-red-500">Déconnexion</button>
        </header>
        {/* Tableau */}
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-4 text-left">Nom</th>
                <th className="p-4 text-left">Budget</th>
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
                  <td className="p-4 font-mono">{lead.budget?.toLocaleString()} €</td>
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
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black text-xl">✕</button>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-xs text-gray-500 uppercase">Budget</p>
                      <p className="text-xl font-bold">{selectedLead.budget?.toLocaleString()} €</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-xs text-gray-500 uppercase">Téléphone</p>
                      <p className="text-xl font-bold text-blue-600">{selectedLead.telephone || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <a 
                      href={`tel:${selectedLead.telephone}`} 
                      onClick={() => logAction('appel', 'Appel téléphonique')}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded text-center font-bold"
                    >
                      📞 Appeler
                    </a>
                    <a 
                      href={`mailto:${selectedLead.email}`}
                      onClick={() => logAction('email', 'Email envoyé')}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded text-center font-bold"
                    >
                      ✉️ Email
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-purple-50 p-6 rounded border border-purple-100">
                    <h3 className="font-bold text-purple-800 mb-2">Générateur d'Annonce Facebook/Insta</h3>
                    <p className="text-sm text-gray-600 mb-4">L'IA rédige une annonce de recherche basée sur ce prospect.</p>
                    <button 
                      onClick={generateAIAd}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 w-full"
                    >
                      ✨ Générer l'annonce maintenant
                    </button>
                  </div>
                  {generatedAd && (
                    <textarea 
                      className="w-full h-40 p-4 border rounded bg-gray-50 text-sm font-mono"
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
                    <div className="font-bold text-gray-800">{act.type === 'appel' ? '📞 Appel' : '📝 Note'}</div>
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
