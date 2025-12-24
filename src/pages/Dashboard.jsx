import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Clock, Users, Zap, CheckCircle, Search, RefreshCw, FileText } from 'lucide-react'

const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [annonceForm, setAnnonceForm] = useState({ adresse: '', pieces_surface: '', description: '', dpe: '', prix: '' })
  const [annonceGeneree, setAnnonceGeneree] = useState(null)
  const [tempsEconomise, setTempsEconomise] = useState(5)

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/leads-chauds`)
        const data = await res.json()
        if (data.status === 'success' && data.data.leads_chauds) {
          setLeads(data.data.leads_chauds.map(l => ({
            ...l, 
            score: l.score_ia || 0, // Harmonisation du nom
            nom: l.nom || 'Anonyme'
          })))
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetchLeads()
  }, [])

  const leadsChaudsCount = leads.filter(l => l.score >= 8).length
  const leadsTries = [...leads].sort((a, b) => b.score - a.score)

  const handleAnnonce = (e) => {
    e.preventDefault()
    setTimeout(() => {
      setAnnonceGeneree(`✨ À VENDRE - ${annonceForm.adresse}\nCe bien de ${annonceForm.pieces_surface} à ${annonceForm.prix}€ est une opportunité rare (DPE ${annonceForm.dpe}).\n${annonceForm.description}`)
      setTempsEconomise(t => t + 1)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* BARRE DE NAVIGATION (Largeur PC) */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><LayoutDashboard size={20} /></div>
            <h1 className="text-xl font-bold">LeadQualif <span className="text-blue-600">IA</span></h1>
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold ml-2 flex gap-1 items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> ONLINE
            </span>
          </div>
          <a href="/formulaire.html" target="_blank" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium px-4 py-2 hover:bg-slate-50 rounded-lg transition">
            <FileText size={18} /> Ouvrir Formulaire
          </a>
        </div>
      </nav>

      {/* CONTENU PRINCIPAL CENTRÉ */}
      <main className="max-w-7xl mx-auto p-8 space-y-8">
        
        {/* CARTES STATS (Grille 3 colonnes sur PC) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-slate-500 font-medium">Leads Qualifiés</p>
              <h3 className="text-4xl font-bold text-slate-800">{loading ? '-' : leadsChaudsCount}</h3>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={28} /></div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-slate-500 font-medium">Temps Gagné</p>
              <h3 className="text-4xl font-bold text-emerald-600">{tempsEconomise}h</h3>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><Clock size={28} /></div>
          </div>
          
          <div className="bg-slate-900 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-center items-center text-center">
            <p className="text-slate-400 text-sm mb-1">Status du Serveur</p>
            <p className="font-bold text-green-400 flex items-center gap-2"><CheckCircle size={16}/> Opérationnel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* TABLEAU DES LEADS (2/3 écran) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><Users className="text-blue-600"/> Liste des Leads</h2>
              <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><RefreshCw size={18}/></button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="p-4">Client</th>
                    <th className="p-4">Budget</th>
                    <th className="p-4">Score IA</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsTries.map(lead => {
                    const isHot = lead.score >= 8; // Lead Chaud
                    return (
                      <tr key={lead.id} className={`transition-colors ${isHot ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{lead.nom}</div>
                          <div className="text-slate-400 text-xs">{lead.email}</div>
                        </td>
                        <td className="p-4 font-medium text-slate-600">
                          {lead.budget > 0 ? lead.budget.toLocaleString() + ' €' : '-'}
                        </td>
                        <td className="p-4">
                          {/* BADGE DE SCORE */}
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                            isHot ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500' : 
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {isHot && <Zap size={12} fill="currentColor"/>} {lead.score}/10
                          </span>
                        </td>
                        <td className="p-4 text-right">
                           <button onClick={() => alert(JSON.stringify(lead, null, 2))} className="text-slate-400 hover:text-blue-600 font-medium text-xs border border-slate-200 px-3 py-1 rounded hover:bg-white transition">
                             Voir
                           </button>
                        </td>
                      </tr>
                    )
                  })}
                  {leads.length === 0 && !loading && <tr><td colSpan="4" className="p-8 text-center text-slate-400">Aucun lead pour l'instant...</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* GÉNÉRATEUR ANNONCES (1/3 écran) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-24">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap className="text-yellow-500" fill="currentColor"/> Rédacteur IA</h2>
            <form onSubmit={handleAnnonce} className="space-y-3">
              <input className="w-full p-3 bg-slate-50 rounded-xl text-sm border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
                placeholder="Adresse" value={annonceForm.adresse} onChange={e => setAnnonceForm({...annonceForm, adresse: e.target.value})} required/>
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prix" value={annonceForm.prix} onChange={e => setAnnonceForm({...annonceForm, prix: e.target.value})} />
                <input className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Surface" value={annonceForm.pieces_surface} onChange={e => setAnnonceForm({...annonceForm, pieces_surface: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg shadow-slate-200">Générer Annonce</button>
            </form>
            {annonceGeneree && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-slate-700 whitespace-pre-line border border-blue-100">
                {annonceGeneree}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}