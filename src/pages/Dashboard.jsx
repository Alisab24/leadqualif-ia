import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
// On importe les belles icônes ici
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Clock, 
  Users, 
  CheckCircle,
  RefreshCw,
  Search,
  Zap
} from 'lucide-react'

const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorStatus, setErrorStatus] = useState(null)
  
  const [annonceForm, setAnnonceForm] = useState({ adresse: '', pieces_surface: '', description: '', dpe: '', prix: '' })
  const [annonceLoading, setAnnonceLoading] = useState(false)
  const [annonceGeneree, setAnnonceGeneree] = useState(null)
  const [tempsEconomise, setTempsEconomise] = useState(5)

  useEffect(() => {
    const fetchLeadsChauds = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BACKEND_URL}/leads-chauds`)
        if (!response.ok) throw new Error(`Erreur: ${response.status}`)
        
        const result = await response.json()
        if (result.status === 'success' && result.data && result.data.leads_chauds) {
          const leadsFormates = result.data.leads_chauds.map(lead => ({
            id: lead.id,
            nom: lead.nom || 'Client Sans Nom',
            email: lead.email || 'Non renseigné',
            score: lead.score_ia || 0,
            budget: lead.budget || 0
          }))
          setLeads(leadsFormates)
          setErrorStatus(null)
        }
      } catch (err) {
        console.error('[DASHBOARD] Erreur:', err.message)
        setErrorStatus("Le cerveau IA se réveille... (patientez 30s)")
      } finally {
        setLoading(false)
      }
    }
    fetchLeadsChauds()
  }, [])

  const leadsChaudsCount = leads.filter(l => l.score >= 8).length
  const leadsAffiches = [...leads].sort((a, b) => b.score - a.score)

  const handleAnnonceSubmit = (e) => {
    e.preventDefault()
    setAnnonceLoading(true)
    setTimeout(() => {
      const texte = `✨ EXCLUSIVITÉ - ${annonceForm.adresse}\n\nDécouvrez ce bien d'exception proposé à ${annonceForm.prix}€.\nAvec ses ${annonceForm.pieces_surface}, il offre un cadre de vie idéal.\n\nPerformance énergétique : Classe ${annonceForm.dpe}.\n\n${annonceForm.description}\n\nContactez-nous pour une visite privée.`
      setAnnonceGeneree(texte)
      setTempsEconomise(prev => prev + 1)
      setAnnonceLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* --- HEADER --- */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <LayoutDashboard size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">LeadQualif <span className="text-blue-600">IA</span></h1>
          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live
          </span>
        </div>
        <div className="flex gap-4 text-sm font-medium items-center">
          <a href="/formulaire.html" target="_blank" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition px-3 py-2 rounded-lg hover:bg-blue-50">
            <FileText size={18} />
            <span>Formulaire</span>
          </a>
        </div>
      </nav>

      {/* --- CONTENU --- */}
      <main className="p-6 max-w-7xl mx-auto space-y-8">
        
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Leads Qualifiés</p>
              <h3 className="text-4xl font-bold text-slate-800">{loading ? '-' : leadsChaudsCount}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Temps Économisé</p>
              <h3 className="text-4xl font-bold text-emerald-600">{tempsEconomise}h</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Clock size={24} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* TABLEAU */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-blue-600"/> Derniers Leads
              </h2>
              <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition">
                <RefreshCw size={18} />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-4 font-semibold">Client</th>
                    <th className="p-4 font-semibold">Budget</th>
                    <th className="p-4 font-semibold">Score IA</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsAffiches.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{lead.nom}</p>
                        <p className="text-slate-400 text-xs">{lead.email}</p>
                      </td>
                      <td className="p-4 font-medium text-slate-600">
                        {lead.budget > 0 ? lead.budget.toLocaleString() + ' €' : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          lead.score >= 8 ? 'bg-purple-100 text-purple-700' : 
                          lead.score >= 5 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {lead.score >= 8 ? <Zap size={12} fill="currentColor" /> : null} {lead.score}/10
                        </span>
                      </td>
                      <td className="p-4 text-right">
                         <button 
                           onClick={() => alert(`Client : ${lead.nom}\nEmail : ${lead.email}\nScore : ${lead.score}/10`)}
                           className="flex items-center gap-1 ml-auto text-slate-400 hover:text-blue-600 font-medium transition"
                         >
                           <Search size={14} /> Détails
                         </button>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && !loading && (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-400 italic">En attente de nouveaux leads...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* GÉNÉRATEUR ANNONCE */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Zap size={20} className="text-yellow-500" fill="currentColor"/> Rédacteur IA
            </h2>
            
            <form onSubmit={handleAnnonceSubmit} className="space-y-4">
              <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                value={annonceForm.adresse} onChange={e => setAnnonceForm({...annonceForm, adresse: e.target.value})} placeholder="Adresse (ex: Paris 16)" required />
              
              <div className="grid grid-cols-2 gap-3">
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  value={annonceForm.prix} onChange={e => setAnnonceForm({...annonceForm, prix: e.target.value})} placeholder="Prix" required />
                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  value={annonceForm.pieces_surface} onChange={e => setAnnonceForm({...annonceForm, pieces_surface: e.target.value})} placeholder="Surface" required />
              </div>
              
              <button type="submit" disabled={annonceLoading} className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                {annonceLoading ? <RefreshCw size={18} className="animate-spin"/> : <CheckCircle size={18} />}
                {annonceLoading ? 'Rédaction...' : 'Générer l\'annonce'}
              </button>
            </form>

            {annonceGeneree && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-slate-700 whitespace-pre-line relative group">
                {annonceGeneree}
                <button onClick={() => navigator.clipboard.writeText(annonceGeneree)} className="absolute top-2 right-2 p-1 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition text-blue-600">
                  <CheckCircle size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}