import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import ProfileManager from '../services/profileManager'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line
} from 'recharts'

const OBJECTIF_MENSUEL = 10000 // € — objectif 10 000€/mois

// Couleurs pour les graphiques
const COLORS_STATUT = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#f97316']
const COLORS_QUALIF = ['#ef4444', '#f59e0b', '#10b981']

// Helper qualification
const getQualif = (lead) => {
  const score = lead.score || lead.score_ia || 0
  if (lead.qualification) return lead.qualification
  if (score >= 70) return 'chaud'
  if (score >= 40) return 'tiede'
  return 'froid'
}

export default function Stats() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [leads, setLeads] = useState([])
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsThisWeek: 0,
    leadsThisMonth: 0,
    leadsLastMonth: 0,
    conversionRate: 0,
    averageScore: 0,
    hotLeadsPercentage: 0,
    commissionRealisee: 0,
    commissionPotentielle: 0,
    monthlyData: [],
    statusDistribution: [],
    qualificationDistribution: [],
    topLeads: [],
    objectifProgress: 0,
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const calcCommission = (budget) => {
    if (!budget || budget <= 0) return 0
    if (budget < 100000) return 5000
    return Math.round(budget * 0.05)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStats()
    setRefreshing(false)
  }

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profileResult = await ProfileManager.getUserProfile(user.id, {
        createIfMissing: true,
        useFallback: true,
        required: ['agency_id'],
      })

      if (!profileResult.success) return

      const p = profileResult.profile
      const agencyId = ProfileManager.getSafeAgencyId(p)
      if (!agencyId) return

      setProfile(p)

      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (!leadsData) return
      setLeads(leadsData)

      const now = new Date()
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      const leadsThisWeek = leadsData.filter(l => new Date(l.created_at) >= startOfWeek).length
      const leadsThisMonth = leadsData.filter(l => new Date(l.created_at) >= thisMonth).length
      const leadsLastMonth = leadsData.filter(l => {
        const d = new Date(l.created_at)
        return d >= lastMonth && d <= endLastMonth
      }).length

      // ✅ CORRECTION: 'Gagné' (pas 'Vendu')
      const gagneLeads = leadsData.filter(l => l.statut === 'Gagné')
      const conversionRate = leadsData.length > 0 ? Math.round((gagneLeads.length / leadsData.length) * 100) : 0

      // Score IA — utilise score OU score_ia
      const scores = leadsData.map(l => l.score || l.score_ia || 0).filter(s => s > 0)
      const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      const hotLeads = leadsData.filter(l => (l.score || l.score_ia || 0) >= 70).length
      const hotLeadsPercentage = leadsData.length > 0 ? Math.round((hotLeads / leadsData.length) * 100) : 0

      // Commission réalisée (leads Gagné)
      const commissionRealisee = gagneLeads.reduce((sum, l) => sum + calcCommission(l.budget), 0)

      // Commission potentielle (tous les leads actifs hors Perdu)
      const commissionPotentielle = leadsData
        .filter(l => l.statut !== 'Perdu')
        .reduce((sum, l) => sum + calcCommission(l.budget), 0)

      // Progression vers objectif mensuel
      const commissionMoisEnCours = leadsData
        .filter(l => l.statut === 'Gagné' && new Date(l.updated_at || l.created_at) >= thisMonth)
        .reduce((sum, l) => sum + calcCommission(l.budget), 0)
      const objectifProgress = Math.min(100, Math.round((commissionMoisEnCours / OBJECTIF_MENSUEL) * 100))

      // Données mensuelles (6 mois)
      const monthlyData = []
      for (let i = 5; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        const monthLeads = leadsData.filter(l => {
          const d = new Date(l.created_at)
          return d >= mStart && d <= mEnd
        })
        const gagneMonth = monthLeads.filter(l => l.statut === 'Gagné')
        const hotMonth = monthLeads.filter(l => (l.score || l.score_ia || 0) >= 70).length

        monthlyData.push({
          month: mStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          leads: monthLeads.length,
          gagnes: gagneMonth.length,
          chauds: hotMonth,
          commission: gagneMonth.reduce((sum, l) => sum + calcCommission(l.budget), 0),
        })
      }

      // Répartition statut
      const statusCount = {}
      leadsData.forEach(l => {
        const s = l.statut || 'À traiter'
        statusCount[s] = (statusCount[s] || 0) + 1
      })
      const statusDistribution = Object.entries(statusCount)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))

      // Répartition qualification IA
      const qualifCount = { froid: 0, tiede: 0, chaud: 0 }
      leadsData.forEach(l => { qualifCount[getQualif(l)]++ })
      const qualificationDistribution = [
        { name: '🔴 Froid', value: qualifCount.froid },
        { name: '🟡 Tiède', value: qualifCount.tiede },
        { name: '🟢 Chaud', value: qualifCount.chaud },
      ]

      // Top 5 leads par budget
      const topLeads = [...leadsData]
        .filter(l => l.budget > 0)
        .sort((a, b) => (b.budget || 0) - (a.budget || 0))
        .slice(0, 5)

      setStats({
        totalLeads: leadsData.length,
        leadsThisWeek,
        leadsThisMonth,
        leadsLastMonth,
        conversionRate,
        averageScore,
        hotLeadsPercentage,
        commissionRealisee,
        commissionPotentielle,
        commissionMoisEnCours,
        monthlyData,
        statusDistribution,
        qualificationDistribution,
        topLeads,
        objectifProgress,
      })

    } catch (error) {
      console.error('Erreur chargement statistiques:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des statistiques…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">

      {/* ── HEADER fixe ───────────────────── */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">📊 Statistiques</h1>
            <p className="text-xs text-slate-400 truncate">
              Performance de {profile?.nom_agence || 'votre agence'}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg
                       text-sm text-slate-600 hover:bg-slate-50 shadow-sm
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
            {refreshing ? 'Actualisation…' : 'Rafraîchir'}
          </button>
        </div>
      </header>

      {/* ── CONTENU scrollable ────────────────── */}
      <main className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* === OBJECTIF MENSUEL === */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-blue-100 text-sm font-medium">Objectif mensuel</p>
              <p className="text-3xl font-bold">
                {(stats.commissionMoisEnCours || 0).toLocaleString()} €
                <span className="text-blue-200 text-lg font-normal"> / {OBJECTIF_MENSUEL.toLocaleString()} €</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{stats.objectifProgress}%</p>
              <p className="text-blue-200 text-sm">atteint ce mois</p>
            </div>
          </div>
          <div className="w-full bg-blue-500/40 rounded-full h-3">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${stats.objectifProgress}%` }}
            />
          </div>
          <p className="text-blue-200 text-xs mt-2">
            Il manque {Math.max(0, OBJECTIF_MENSUEL - (stats.commissionMoisEnCours || 0)).toLocaleString()} € pour atteindre 10 000€/mois
          </p>
        </div>

        {/* KPI Principaux */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon="📊" label="Leads cette semaine" value={stats.leadsThisWeek} color="blue" />
          <KPICard
            icon="📈"
            label="Leads ce mois"
            value={stats.leadsThisMonth}
            color="green"
            sub={
              stats.leadsThisMonth > stats.leadsLastMonth
                ? `↑ +${stats.leadsThisMonth - stats.leadsLastMonth} vs mois dernier`
                : `↓ −${stats.leadsLastMonth - stats.leadsThisMonth} vs mois dernier`
            }
            subColor={stats.leadsThisMonth >= stats.leadsLastMonth ? 'text-green-500' : 'text-red-500'}
          />
          <KPICard icon="🧠" label="Score IA moyen" value={`${stats.averageScore}%`} color="purple" sub="Intention d'achat" />
          <KPICard icon="🔥" label="Leads chauds" value={`${stats.hotLeadsPercentage}%`} color="orange" sub="Score ≥ 70%" />
        </div>

        {/* Commission */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Commission réalisée</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stats.commissionRealisee.toLocaleString()} €</p>
            <p className="text-xs text-slate-400 mt-1">Leads Gagné × taux commission</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Commission potentielle</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{stats.commissionPotentielle.toLocaleString()} €</p>
            <p className="text-xs text-slate-400 mt-1">Si tous les leads actifs signent</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Taux de conversion</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.conversionRate}%</p>
            <p className="text-xs text-slate-400 mt-1">{leads.filter(l => l.statut === 'Gagné').length} leads gagnés / {stats.totalLeads} total</p>
          </div>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Activité mensuelle */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Activité mensuelle (6 mois)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="#3b82f6" name="Leads" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gagnes" fill="#10b981" name="Gagnés" radius={[3, 3, 0, 0]} />
                <Bar dataKey="chauds" fill="#f59e0b" name="Chauds" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Qualification IA */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Qualification IA des leads</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats.qualificationDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {stats.qualificationDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS_QUALIF[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} leads`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {stats.qualificationDistribution.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS_QUALIF[i] }} />
                  {item.name}: <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par statut */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Pipeline par statut</h2>
            <div className="space-y-2">
              {stats.statusDistribution.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28 truncate">{item.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 relative overflow-hidden">
                    <div
                      className="h-4 rounded-full transition-all"
                      style={{
                        width: `${stats.totalLeads > 0 ? (item.value / stats.totalLeads * 100) : 0}%`,
                        background: COLORS_STATUT[i % COLORS_STATUT.length]
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-6 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Commission mensuelle */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Commission mensuelle (€)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v.toLocaleString()} €`, 'Commission']} />
                <Line
                  type="monotone"
                  dataKey="commission"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 4 }}
                  name="Commission €"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Leads */}
        {stats.topLeads?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">🏆 Top leads par budget</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Lead</th>
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Qualification</th>
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                    <th className="pb-3 text-right text-xs font-semibold text-slate-500 uppercase">Budget</th>
                    <th className="pb-3 text-right text-xs font-semibold text-slate-500 uppercase">Commission est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.topLeads.map((lead, i) => {
                    const q = getQualif(lead)
                    const badgeClass = q === 'chaud' ? 'bg-green-100 text-green-700'
                      : q === 'tiede' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                    return (
                      <tr key={lead.id}>
                        <td className="py-3 text-sm font-medium text-slate-800">
                          <span className="text-slate-400 mr-2">#{i + 1}</span>{lead.nom}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badgeClass}`}>
                            {q === 'chaud' ? '🟢 Chaud' : q === 'tiede' ? '🟡 Tiède' : '🔴 Froid'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-xs text-slate-500">{lead.statut || '—'}</span>
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-slate-800">
                          {(lead.budget || 0).toLocaleString('fr-FR')} €
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-green-600">
                          {calcCommission(lead.budget).toLocaleString('fr-FR')} €
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rapport mensuel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4">Rapport mensuel</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Mois', 'Leads', 'Gagnés', 'Chauds', 'Commission', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.monthlyData.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.month}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{m.leads}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-semibold">{m.gagnes}</td>
                    <td className="px-4 py-3 text-sm text-orange-600 font-semibold">{m.chauds}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{m.commission.toLocaleString()} €</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                        m.commission >= OBJECTIF_MENSUEL ? 'bg-green-100 text-green-700'
                        : m.commission > 0 ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>
                        {m.commission >= OBJECTIF_MENSUEL ? '✅ Objectif atteint'
                          : m.commission > 0 ? '⚡ En cours'
                          : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      </main>
    </div>
  )
}

// Composant KPI Card réutilisable
function KPICard({ icon, label, value, color, sub, subColor }) {
  const colors = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100',
    indigo: 'text-indigo-600 bg-indigo-100',
  }
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-full p-2 ${colors[color]?.split(' ')[1]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      <p className={`text-3xl font-bold ${colors[color]?.split(' ')[0]}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor || 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}
