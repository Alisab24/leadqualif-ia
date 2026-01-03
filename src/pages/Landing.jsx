import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [session, setSession] = useState(null)
  const [leads, setLeads] = useState([])
  const [agencyId, setAgencyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // 1. Vérifier la session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) {
        navigate('/login')
      } else {
        fetchAgencyData(session.user.id)
      }
    })

    // Écouter les changements de connexion
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) navigate('/login')
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  // 2. Récupérer l'Agence et les Leads
  async function fetchAgencyData(userId) {
    try {
      setLoading(true)
      
      // A. Trouver l'ID de l'agence via le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', userId)
        .single()

      if (profileError) throw profileError
      if (!profile?.agency_id) throw new Error("Aucune agence liée à ce compte.")

      setAgencyId(profile.agency_id)

      // B. Charger les leads de cette agence
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError
      setLeads(leadsData || [])

    } catch (err) {
      console.error('Erreur chargement:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- AFFICHAGE ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl animate-pulse">Chargement de votre espace...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-red-600">
        <h2 className="text-2xl font-bold">Problème détecté</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-gray-200 rounded">Réessayer</button>
      </div>
    )
  }

  // Lien d'estimation unique
  const linkEstimation = `${window.location.origin}/estimation?aid=${agencyId}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre du haut */}
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-900">LeadQualif Manager</h1>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="text-sm text-red-500 hover:text-red-700"
        >
          Déconnexion
        </button>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        
        {/* Bloc Lien d'estimation */}
        <div className="bg-white p-6 rounded-lg shadow mb-8 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-2">Votre Lien de Capture</h2>
          <p className="text-gray-600 mb-2 text-sm">Envoyez ce lien à vos clients ou mettez-le sur vos réseaux sociaux :</p>
          <div className="flex gap-2">
            <input 
              readOnly 
              value={linkEstimation} 
              className="flex-1 p-2 bg-gray-100 rounded border text-sm font-mono"
            />
            <button 
              onClick={() => navigator.clipboard.writeText(linkEstimation)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Copier
            </button>
          </div>
        </div>

        {/* Liste des Leads */}
        <h2 className="text-2xl font-bold mb-4">Vos Leads Récents ({leads.length})</h2>
        
        {leads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded shadow">
            <p className="text-gray-500 text-lg">Aucun lead pour le moment.</p>
            <p className="text-sm text-gray-400">Partagez votre lien pour recevoir vos premières estimations !</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score IA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{lead.nom}</div>
                      <div className="text-sm text-gray-500">{lead.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {lead.budget ? lead.budget.toLocaleString() + ' €' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lead.score_ia > 7 ? 'bg-green-100 text-green-800' : 
                        lead.score_ia > 4 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {lead.score_ia}/10
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.statut_crm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}