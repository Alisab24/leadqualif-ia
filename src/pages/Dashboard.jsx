import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// URL DE VOTRE CERVEAU IA SUR RENDER
const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorStatus, setErrorStatus] = useState(null)
  
  // États pour l'outil de production (Annonces)
  const [annonceForm, setAnnonceForm] = useState({
    adresse: '', pieces_surface: '', description: '', dpe: '', prix: ''
  })
  const [annonceLoading, setAnnonceLoading] = useState(false)
  const [annonceGeneree, setAnnonceGeneree] = useState(null)
  const [tempsEconomise, setTempsEconomise] = useState(5)

  // 1. CHARGEMENT DES DONNÉES DEPUIS RENDER
  useEffect(() => {
    const fetchLeadsChauds = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BACKEND_URL}/leads-chauds`)
        if (!response.ok) throw new Error(`Erreur: ${response.status}`)
        
        const result = await response.json()
        
        if (result.status === 'success' && result.data.leads_chauds) {
          const leadsFormates = result.data.leads_chauds.map(lead => ({
            id: lead.id,
            nom: lead.nom || 'Sans nom',
            email: lead.email || 'Pas d\'email',
            score: lead.score_ia || 0,
            statut: lead.score_ia >= 9 ? 'Chaud' : lead.score_ia >= 5 ? 'Tiède' : 'Froid',
            budget: lead.budget || 0
          }))
          setLeads(leadsFormates)
          setErrorStatus(null)
        }
      } catch (err) {
        console.error('[DASHBOARD] Erreur Render:', err.message)
        setErrorStatus("Connexion au cerveau IA en cours...")
      } finally {
        setLoading(false)
      }
    }
    fetchLeadsChauds()
  }, [])

  // 2. LOGIQUE MÉTIER
  const leadsChaudsCount = leads.filter(l => l.score >= 8).length
  
  // Tri des leads par score (les plus chauds en haut)
  const leadsAffiches = [...leads].sort((a, b) => b.score - a.score)

  // Simulation IA pour l'annonce
  const handleAnnonceSubmit = (e) => {
    e.preventDefault()
    setAnnonceLoading(true)
    setTimeout(() => {
      const texte = `✨ EXCLUSIVITÉ - ${annonceForm.adresse}\n\nDécouvrez ce bien d'exception proposé à ${annonceForm.prix}€.\nAvec ses ${annonceForm.pieces_surface}, il offre un cadre de vie idéal.\n\nPerformance énergétique : Classe ${annonceForm.dpe}.\n\n${annonceForm.description}\n\nContactez-nous pour une visite privée.`
      setAnnonceGeneree(texte)
      setTempsEconomise(prev => prev + 1) // On augmente le compteur de temps gagné
      setAnnonceLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* --- HEADER --- */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
          <h1 className="text-xl font-bold text-slate-800">LeadQualif <span className="text-blue-600">IA</span></h1>
          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">● Live</span>
        </div>
        <div className="flex gap-6 text-sm font-medium">
          <Link to="/" className="text-blue-600 border-b-2 border-blue-600 py-4 -my-4">Dashboard</Link>
          <a href="/formulaire.html" target="_blank" className="text-slate-500 hover:text-blue-600 transition py-4 -my-4">Voir le Formulaire</a>
        </div>
      </nav>

      {/* --- CONTENU PRINCIPAL --- */}
      <main className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* SECTION STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Carte KPI 1 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Leads Qualifiés (24h)</p>
                <h3 className="text-4xl font-bold text-slate-800">{loading ? '-' : leadsChaudsCount}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
              </div>
            </div>
            {errorStatus && <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">⚠️ {errorStatus}</p>}
          </div>

          {/* Carte KPI 2 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Temps Économisé</p>
                <h3 className="text-4xl font-bold text-emerald-600">{tempsEconomise}h</h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Calculé sur l'automatisation IA</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* TABLEAU DES LEADS (Prend 2/3 de la largeur) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Derniers Leads Reçus</h2>
              <button onClick={() => window.location.reload()} className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition">Actualiser</button>
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
                          {lead.score >= 8 && '🔥'} {lead.score}/10
                        </span>
                      </td>
                      <td className="p-4 text-right">
                         <button 
                           onClick={() => alert(`Client : ${lead.nom}\nEmail : ${lead.email}\nScore : ${lead.score}/10`)}
                           className="text-slate-400 hover:text-blue-600 font-medium transition"
                         >
                           Voir
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

          {/* GÉNÉRATEUR D'ANNONCE (Prend 1/3 de la largeur) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>✨</span> Rédacteur IA
            </h2>
            
            <form onSubmit={handleAnnonceSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Adresse</label>
                <input type="text" className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                  value={annonceForm.adresse} onChange={e => setAnnonceForm({...annonceForm, adresse: e.target.value})} placeholder="Ex: Paris 16ème" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Prix</label>
                  <input type="text" className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    value={annonceForm.prix} onChange={e => setAnnonceForm({...annonceForm, prix: e.target.value})} placeholder="Ex: 500k" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Surface</label>
                  <input type="text" className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    value={annonceForm.pieces_surface} onChange={e => setAnnonceForm({...annonceForm, pieces_surface: e.target.value})} placeholder="Ex: 3p 65m2" required />
                </div>
              </div>
              
              <button type="submit" disabled={annonceLoading} className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all transform active:scale-95 disabled:opacity-50">
                {annonceLoading ? 'Rédaction en cours...' : 'Générer l\'annonce'}
              </button>
            </form>

            {annonceGeneree && (
              <div className="mt-6 pt-6 border-t border-slate-100 animate-fade-in">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                  {annonceGeneree}
                </div>
                <button onClick={() => navigator.clipboard.writeText(annonceGeneree)} className="mt-2 text-xs text-blue-600 hover:underline w-full text-center">
                  Copier le texte
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}