import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// URL DE VOTRE CERVEAU IA SUR RENDER
const API_BACKEND_URL = 'https://leadqualif-backend.onrender.com/api'

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorStatus, setErrorStatus] = useState(null)
  const location = useLocation()
  
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
        console.log("[DASHBOARD] Tentative de connexion à Render...")
        const response = await fetch(`${API_BACKEND_URL}/leads-chauds`)
        
        if (!response.ok) throw new Error(`Erreur: ${response.status}`)
        
        const result = await response.json()
        
        // CORRECTION ICI : On utilise les clés envoyées par le backend (nom, email, score_ia)
        if (result.status === 'success' && result.data.leads_chauds) {
          const leadsFormates = result.data.leads_chauds.map(lead => ({
            id: lead.id,
            nom: lead.nom || 'Sans nom',
            email: lead.email || 'Pas d\'email',
            score_qualification: (lead.score_ia || 0) * 10, // On remet sur 100 pour vos calculs
            urgence: lead.score_ia >= 9 ? 'chaud' : lead.score_ia >= 8 ? 'tiède' : 'froid',
            created_at: new Date().toISOString()
          }))
          setLeads(leadsFormates)
          setErrorStatus(null)
        }
      } catch (err) {
        console.error('[DASHBOARD] Erreur Render:', err.message)
        setErrorStatus("Le serveur est en cours de réveil sur Render (30s)...")
      } finally {
        setLoading(false)
      }
    }
    fetchLeadsChauds()
  }, [])

  // 2. CALCULS DES STATS
  const total = leads.length
  const leadsChaudsCount = leads.filter(l => l.score_qualification >= 80).length
  
  const leadsAffiches = leads.map(lead => ({
    id: lead.id,
    nom: lead.nom,
    score: Math.round(lead.score_qualification / 10),
    urgence: lead.urgence === 'chaud' ? 'Élevée' : lead.urgence === 'tiède' ? 'Moyenne' : 'Faible',
    scoreOriginal: lead.score_qualification
  })).sort((a, b) => b.scoreOriginal - a.scoreOriginal)

  // 3. LOGIQUE ANNONCE IA (SIMULÉE)
  const handleAnnonceSubmit = (e) => {
    e.preventDefault()
    setAnnonceLoading(true)
    setTimeout(() => {
      const texte = `🏠 Superbe bien à ${annonceForm.adresse}\n\nOpportunité rare à ${annonceForm.prix}. Ce bien de ${annonceForm.pieces_surface} avec un DPE ${annonceForm.dpe} est idéalement situé.\n\n${annonceForm.description}`
      setAnnonceGeneree(texte)
      setTempsEconomise(prev => prev + 1)
      setAnnonceLoading(false)
    }, 1000)
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f8f9fa] flex flex-col font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">LeadQualif IA <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded ml-2">SaaS LIVE</span></h1>
        <div className="flex gap-8">
          <Link to="/" className="text-gray-600 no-underline hover:text-blue-600">Dashboard</Link>
          <a href="/formulaire.html" className="text-gray-600 no-underline hover:text-blue-600">Lien Formulaire</a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARTE GAUCHE : LEADS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-blue-600 mb-4">Qualification des Leads (Render)</h2>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500">Leads Prioritaires (Score > 8)</p>
              <p className="text-6xl font-bold text-blue-600">{loading ? '...' : leadsChaudsCount}</p>
              {errorStatus && <p className="text-xs text-orange-500 mt-2">⚠️ {errorStatus}</p>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="py-3 font-medium">NOM</th>
                    <th className="py-3 font-medium">SCORE IA</th>
                    <th className="py-3 font-medium">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsAffiches.map(lead => (
                    <tr key={lead.id} className={`border-b border-gray-50 ${lead.score >= 8 ? 'bg-blue-50' : ''}`}>
                      <td className="py-4 font-medium">{lead.nom}</td>
                      <td className={`py-4 font-bold ${lead.score >= 8 ? 'text-blue-600' : ''}`}>{lead.score}/10</td>
                      <td className="py-4">
                        <button className="bg-white border border-gray-200 text-xs px-3 py-1 rounded shadow-sm hover:bg-gray-50">Détails</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && !loading && <p className="text-center py-10 text-gray-400">Aucun lead trouvé.</p>}
            </div>
          </div>

          {/* CARTE DROITE : PRODUCTION */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-blue-600 mb-4">Générateur d'Annonces IA</h2>
            <div className="mb-6">
              <p className="text-sm text-gray-500">Temps économisé ce mois</p>
              <p className="text-2xl font-bold text-blue-600">{tempsEconomise} heures</p>
            </div>

            <form onSubmit={handleAnnonceSubmit} className="space-y-4 max-w-sm">
              <input type="text" placeholder="Adresse" className="w-full p-2 border rounded" onChange={e => setAnnonceForm({...annonceForm, adresse: e.target.value})} required />
              <input type="text" placeholder="Prix" className="w-full p-2 border rounded" onChange={e => setAnnonceForm({...annonceForm, prix: e.target.value})} required />
              <input type="text" placeholder="Pièces / Surface" className="w-full p-2 border rounded" onChange={e => setAnnonceForm({...annonceForm, pieces_surface: e.target.value})} required />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
                {annonceLoading ? 'IA en cours...' : 'Générer l\'annonce'}
              </button>
            </form>

            {annonceGeneree && (
              <div className="mt-6 p-4 bg-gray-50 rounded border border-blue-100 text-sm whitespace-pre-wrap">
                {annonceGeneree}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}