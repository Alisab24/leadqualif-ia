import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export default function Stats() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCommission: 0,
    leadsThisMonth: 0,
    leadsLastMonth: 0,
    conversionRate: 0,
    monthlyData: [],
    statusDistribution: []
  })

  // Couleurs pour les graphiques
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('agency_id').eq('user_id', user.id).single()
      if (!profile?.agency_id) return

      // Récupérer tous les leads de l'agence
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false })

      if (!leads) return

      // Calculer les statistiques
      const now = new Date()
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      const leadsThisMonth = leads.filter(lead => new Date(lead.created_at) >= thisMonth).length
      const leadsLastMonth = leads.filter(lead => {
        const date = new Date(lead.created_at)
        return date >= lastMonth && date <= endLastMonth
      }).length

      const convertedLeads = leads.filter(lead => lead.statut === 'Vendu').length
      const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0

      // Calculer la commission totale
      const totalCommission = leads.reduce((sum, lead) => {
        const budget = lead.budget || 0
        if (budget < 100000) return sum + 5000
        return sum + Math.round(budget * 0.05)
      }, 0)

      // Préparer les données mensuelles (6 derniers mois)
      const monthlyData = []
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        
        const monthLeads = leads.filter(lead => {
          const date = new Date(lead.created_at)
          return date >= monthDate && date <= monthEnd
        })

        const monthCommission = monthLeads.reduce((sum, lead) => {
          const budget = lead.budget || 0
          if (budget < 100000) return sum + 5000
          return sum + Math.round(budget * 0.05)
        }, 0)

        monthlyData.push({
          month: monthDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          leads: monthLeads.length,
          commission: monthCommission
        })
      }

      // Répartition par statut
      const statusCount = {}
      leads.forEach(lead => {
        const status = lead.statut || 'À traiter'
        statusCount[status] = (statusCount[status] || 0) + 1
      })

      const statusDistribution = Object.entries(statusCount).map(([status, count]) => ({
        name: status,
        value: count
      }))

      setStats({
        totalCommission,
        leadsThisMonth,
        leadsLastMonth,
        conversionRate,
        monthlyData,
        statusDistribution
      })

    } catch (error) {
      console.error('Erreur chargement statistiques:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePotential = (budget) => {
    if (!budget) return 0
    if (budget < 100000) return 5000
    return Math.round(budget * 0.05)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Statistiques Agence</h1>
          <p className="text-slate-600">Vue d'ensemble de vos performances et de votre activité</p>
        </div>

        {/* Résumé Business */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Commission Totale */}
          <div className="bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Commission Totale Identifiée</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.totalCommission.toLocaleString()} €
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>

          {/* Volume de Leads */}
          <div className="bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Volume de Leads</p>
                <p className="text-3xl font-bold text-blue-600">{stats.leadsThisMonth}</p>
                <div className="flex items-center mt-2">
                  {stats.leadsThisMonth > stats.leadsLastMonth ? (
                    <span className="text-green-600 text-sm font-medium">↑ +{stats.leadsThisMonth - stats.leadsLastMonth}</span>
                  ) : (
                    <span className="text-red-600 text-sm font-medium">↓ {stats.leadsLastMonth - stats.leadsThisMonth}</span>
                  )}
                  <span className="text-slate-500 text-sm ml-2">vs mois dernier</span>
                </div>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <span className="text-2xl">📈</span>
              </div>
            </div>
          </div>

          {/* Taux de Transformation */}
          <div className="bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-6 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Taux de Transformation</p>
                <p className="text-3xl font-bold text-purple-600">{stats.conversionRate}%</p>
                <p className="text-slate-500 text-sm mt-2">Leads signés / Leads totaux</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <span className="text-2xl">🎯</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graphiques Visuels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Graphique en barres - Leads par mois */}
          <div className="bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-6 border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Leads par mois (6 derniers mois)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="#3b82f6" name="Leads" />
                <Bar dataKey="commission" fill="#10b981" name="Commission (€)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Graphique circulaire - Répartition par statut */}
          <div className="bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-6 border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Répartition par Statut</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rapport Mensuel Automatique */}
        <div className="bg-white rounded-2xl shadow-lg shadow-blue-900/5 p-6 border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Rapport Mensuel</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mois</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chiffre Potentiel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Succès</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.monthlyData.map((month, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{month.leads}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{month.commission.toLocaleString()} €</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        month.leads > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {month.leads > 0 ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
