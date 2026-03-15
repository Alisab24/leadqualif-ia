import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ProfileManager from '../services/profileManager'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts'

// ── Constantes ────────────────────────────────────────────────────
const COLORS_STATUT  = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#f97316']
const COLORS_QUALIF  = ['#ef4444', '#f59e0b', '#10b981']
const COLORS_SOURCE  = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16']

// ── Utilitaire : parse un budget string/number en nombre ──────────
// Gère : nombre brut, fourchette "500-1500" (→ moyenne), chaîne "1 500 €"
// Aussi : "1500-3000€", "500 - 1 500 €/mois", "1500–3000 EUR", etc.
const parseBudget = (v) => {
  if (!v) return 0
  if (typeof v === 'number') return v
  const str = String(v).trim()
  // Nettoyer : retirer symboles monétaires, unités, texte en fin de chaîne
  const cleaned = str.replace(/[€$£]/g, '').replace(/\s*(EUR|USD|\/mois|par\s*mois)\s*/gi, '').trim()
  // Détecter une fourchette : "500-1500", "500 - 1500", "1 500–3 000"
  const rangeMatch = cleaned.match(/([\d][\d\s]*)\s*[-–]\s*([\d][\d\s]*)/)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1].replace(/\s/g, ''))
    const max = parseInt(rangeMatch[2].replace(/\s/g, ''))
    if (!isNaN(min) && !isNaN(max) && max > min) return Math.round((min + max) / 2)
  }
  // Nombre simple (retire tout sauf chiffres)
  const n = parseInt(str.replace(/[^0-9]/g, ''))
  return isNaN(n) ? 0 : n
}

// Labels lisibles pour les sources de trafic
const SOURCE_LABELS = {
  facebook_ads:   '🔵 Facebook Ads',
  google_ads:     '🔍 Google Ads',
  instagram:      '🟣 Instagram',
  linkedin:       '💼 LinkedIn',
  site_web:       '🌐 Site web',
  referral:       '🤝 Référence',
  bouche_a_oreille: '💬 Bouche à oreille',
  tiktok:         '🎵 TikTok',
  youtube:        '▶️ YouTube',
  email:          '📧 Email',
  sms:            '📱 SMS',
  autre:          '🔗 Autre',
  formulaire_ia:  '🤖 Formulaire IA',
}

// ── Helpers ────────────────────────────────────────────────────────
const getQualif = (lead) => {
  const score = lead.score || lead.score_ia || 0
  const rawNiveau = (lead.niveau_interet || '').toLowerCase()
    .replace('tiède', 'tiede').replace('tièd', 'tiede')
  if (rawNiveau === 'chaud') return 'chaud'
  if (rawNiveau === 'tiede') return 'tiede'
  if (rawNiveau === 'froid') return 'froid'
  if (lead.qualification) return lead.qualification
  if (score >= 70) return 'chaud'
  if (score >= 40) return 'tiede'
  return 'froid'
}

const fmtEuro = (v) =>
  (v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const fmtNum  = (v) => (v || 0).toLocaleString('fr-FR')

// Commission IMMO estimée
const calcCommission = (budget) => {
  if (!budget || budget <= 0) return 0
  if (budget < 100000) return 5000
  return Math.round(budget * 0.05)
}

// ── Composant KPI Card ─────────────────────────────────────────────
function KPICard({ icon, label, value, color = 'blue', sub, subColor }) {
  const colors = {
    blue:   'text-blue-600 bg-blue-50',
    green:  'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    pink:   'text-pink-600 bg-pink-50',
  }
  const [txt, bg] = (colors[color] || colors.blue).split(' ')
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-full p-2 ${bg}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      <p className={`text-3xl font-bold ${txt}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor || 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────
export default function Stats() {
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [leads, setLeads]           = useState([])
  const [profile, setProfile]       = useState(null)
  const [agencyType, setAgencyType] = useState('immobilier')
  const [pixels, setPixels]         = useState({ fb: '', gads: '', gLabel: '' })
  const [stats, setStats]           = useState({})
  const [showReport, setShowReport] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => { fetchStats() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStats()
    setRefreshing(false)
  }

  const handlePrintReport = () => {
    // ── Nom de fichier : _Rap_AGENCE_JJ-MM-AA ─────────────────
    const now       = new Date()
    const dd        = String(now.getDate()).padStart(2, '0')
    const mm        = String(now.getMonth() + 1).padStart(2, '0')
    const yy        = String(now.getFullYear()).slice(-2)
    const agenceName = (profile?.nom_agence || profile?.name || 'Agence')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')   // enlève espaces et caractères spéciaux
      .slice(0, 12)                 // max 12 caractères
    const filename  = `_Rap_${agenceName}_${dd}-${mm}-${yy}`

    // ── Style print ciblé ──────────────────────────────────────
    const style = document.createElement('style')
    style.id = '__report-print-style'
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #report-print-area,
        #report-print-area * { visibility: visible !important; }
        #report-print-area {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important;
          padding: 24px !important;
          background: white !important;
          z-index: 99999 !important;
        }
        @page { margin: 1cm; }
      }
    `
    document.head.appendChild(style)

    // Changer le titre → utilisé comme nom de fichier par le browser
    const originalTitle = document.title
    document.title = filename

    window.print()

    // Restaurer titre + supprimer style après impression
    const cleanup = () => {
      document.title = originalTitle
      document.getElementById('__report-print-style')?.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    // Fallback Safari (afterprint parfois absent)
    setTimeout(() => {
      document.title = originalTitle
      document.getElementById('__report-print-style')?.remove()
    }, 3000)
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

      // Récupérer le type d'agence et les pixels depuis la table profiles
      const { data: profileRaw } = await supabase
        .from('profiles')
        .select('type_agence, facebook_pixel_id, google_ads_id, google_ads_label')
        .eq('user_id', user.id)
        .maybeSingle()

      const type = profileRaw?.type_agence || 'immobilier'
      setAgencyType(type)
      setPixels({
        fb:     profileRaw?.facebook_pixel_id  || '',
        gads:   profileRaw?.google_ads_id      || '',
        gLabel: profileRaw?.google_ads_label   || '',
      })

      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (!leadsData) return
      setLeads(leadsData)

      const now = new Date()
      const thisMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      const leadsThisWeek  = leadsData.filter(l => new Date(l.created_at) >= startOfWeek).length
      const leadsThisMonth = leadsData.filter(l => new Date(l.created_at) >= thisMonth).length
      const leadsLastMonth = leadsData.filter(l => {
        const d = new Date(l.created_at)
        return d >= lastMonth && d <= endLastMonth
      }).length

      const gagneLeads   = leadsData.filter(l => l.statut === 'Gagné')
      const conversionRate = leadsData.length > 0
        ? Math.round((gagneLeads.length / leadsData.length) * 100) : 0

      const scores     = leadsData.map(l => l.score || l.score_ia || 0).filter(s => s > 0)
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      const hotLeads           = leadsData.filter(l => (l.score || l.score_ia || 0) >= 70).length
      const hotLeadsPercentage = leadsData.length > 0
        ? Math.round((hotLeads / leadsData.length) * 100) : 0

      // ── IMMO : commissions ────────────────────────────────
      const commissionRealisee   = gagneLeads.reduce((sum, l) => sum + calcCommission(l.budget), 0)
      const commissionPotentielle = leadsData
        .filter(l => l.statut !== 'Perdu')
        .reduce((sum, l) => sum + calcCommission(l.budget), 0)
      const commissionMoisEnCours = leadsData
        .filter(l => l.statut === 'Gagné' && new Date(l.updated_at || l.created_at) >= thisMonth)
        .reduce((sum, l) => sum + calcCommission(l.budget), 0)

      // ── SMMA : CA & budget marketing ─────────────────────
      const caGenere = gagneLeads.reduce((sum, l) => sum + parseBudget(l.budget_marketing || l.budget), 0)
      const budgetMarketing = leadsData
        .filter(l => l.statut === 'Gagné')
        .reduce((sum, l) => sum + parseBudget(l.budget_marketing || l.budget), 0)
      const caMoisEnCours = leadsData
        .filter(l => l.statut === 'Gagné' && new Date(l.updated_at || l.created_at) >= thisMonth)
        .reduce((sum, l) => sum + parseBudget(l.budget_marketing || l.budget), 0)

      // ── Données mensuelles (6 mois) ───────────────────────
      const monthlyData = []
      for (let i = 5; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        const monthLeads  = leadsData.filter(l => {
          const d = new Date(l.created_at)
          return d >= mStart && d <= mEnd
        })
        const gagneMonth  = monthLeads.filter(l => l.statut === 'Gagné')
        const hotMonth    = monthLeads.filter(l => (l.score || l.score_ia || 0) >= 70).length
        const commission  = gagneMonth.reduce((sum, l) => sum + calcCommission(l.budget), 0)
        const caSmma      = gagneMonth.reduce((sum, l) => sum + parseBudget(l.budget_marketing || l.budget), 0)

        monthlyData.push({
          month:      mStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          leads:      monthLeads.length,
          gagnes:     gagneMonth.length,
          chauds:     hotMonth,
          commission,
          ca_smma:    caSmma,
        })
      }

      // ── Répartition statut ────────────────────────────────
      const statusCount = {}
      leadsData.forEach(l => {
        const s = l.statut || 'À traiter'
        statusCount[s] = (statusCount[s] || 0) + 1
      })
      const statusDistribution = Object.entries(statusCount)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))

      // ── Qualification IA ──────────────────────────────────
      const qualifCount = { froid: 0, tiede: 0, chaud: 0 }
      leadsData.forEach(l => { qualifCount[getQualif(l)]++ })
      const qualificationDistribution = [
        { name: '🔴 Froid',  value: qualifCount.froid  },
        { name: '🟡 Tiède',  value: qualifCount.tiede  },
        { name: '🟢 Chaud',  value: qualifCount.chaud  },
      ]

      // ── Sources de trafic ─────────────────────────────────
      const sourceCount = {}
      leadsData.forEach(l => {
        const src = l.source || 'autre'
        sourceCount[src] = (sourceCount[src] || 0) + 1
      })
      const sourceDistribution = Object.entries(sourceCount)
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({
          key,
          name:  SOURCE_LABELS[key] || key,
          value,
          pct:   leadsData.length > 0 ? Math.round((value / leadsData.length) * 100) : 0
        }))

      // Source principale
      const topSource = sourceDistribution[0] || null

      // ── ROI par source ────────────────────────────────────
      const roiMap = {}
      leadsData.forEach(l => {
        const src = l.source || 'autre'
        if (!roiMap[src]) roiMap[src] = { leads: 0, gagnes: 0, revenue: 0 }
        roiMap[src].leads++
        if (l.statut === 'Gagné') {
          roiMap[src].gagnes++
          const rev = type === 'smma'
            ? parseBudget(l.budget_marketing || l.budget)
            : calcCommission(l.budget)
          roiMap[src].revenue += rev
        }
      })
      const roiDistribution = Object.entries(roiMap)
        .sort((a, b) => b[1].revenue - a[1].revenue || b[1].leads - a[1].leads)
        .map(([key, data]) => ({
          key,
          name:      SOURCE_LABELS[key] || key,
          leads:     data.leads,
          gagnes:    data.gagnes,
          revenue:   data.revenue,
          convRate:  data.leads > 0 ? Math.round((data.gagnes / data.leads) * 100) : 0,
        }))

      // ── Top 5 leads IMMO (par budget) ────────────────────
      const topLeads = [...leadsData]
        .filter(l => (l.budget || 0) > 0)
        .sort((a, b) => (b.budget || 0) - (a.budget || 0))
        .slice(0, 5)

      // ── SMMA : métriques pipeline ─────────────────────────
      const leadsActifs = leadsData.filter(l => l.statut !== 'Perdu' && l.statut !== 'Gagné')
      const leadsChaudsNonTraites = leadsData.filter(l =>
        (l.score || l.score_ia || 0) >= 70 && l.statut !== 'Gagné' && l.statut !== 'Perdu'
      )
      const gagnesAvecBudget = gagneLeads.filter(l => parseBudget(l.budget_marketing || l.budget) > 0)
      const retainerMoyen = gagnesAvecBudget.length > 0
        ? Math.round(gagnesAvecBudget.reduce((s, l) => s + parseBudget(l.budget_marketing || l.budget), 0) / gagnesAvecBudget.length)
        : 0
      // Top 5 leads SMMA par score IA (pas par budget → évite problèmes de parsing)
      const topSmmaLeads = [...leadsData]
        .sort((a, b) => (b.score || b.score_ia || 0) - (a.score || a.score_ia || 0))
        .slice(0, 5)
      // Répartition du pipeline par statut
      const pipelineStages = ['À traiter', 'En cours', 'Devis envoyé', 'Négociation', 'Gagné', 'Perdu']
      const pipelineFunnel = pipelineStages.map(stage => ({
        stage,
        count: leadsData.filter(l => (l.statut || 'À traiter') === stage).length,
      })).filter(s => s.count > 0)

      setStats({
        totalLeads: leadsData.length,
        leadsThisWeek,
        leadsThisMonth,
        leadsLastMonth,
        conversionRate,
        averageScore,
        hotLeadsPercentage,
        // IMMO
        commissionRealisee,
        commissionPotentielle,
        commissionMoisEnCours,
        // SMMA
        caGenere,
        budgetMarketing,
        caMoisEnCours,
        clientsActifs: gagneLeads.length,
        // Commun
        monthlyData,
        statusDistribution,
        qualificationDistribution,
        sourceDistribution,
        topSource,
        topLeads,
        roiDistribution,
        // SMMA pipeline
        leadsActifs: leadsActifs.length,
        leadsChaudsNonTraites: leadsChaudsNonTraites.length,
        retainerMoyen,
        topSmmaLeads,
        pipelineFunnel,
      })

    } catch (error) {
      console.error('Erreur chargement statistiques:', error)
    } finally {
      setLoading(false)
    }
  }

  const isSmma = agencyType === 'smma'

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement des statistiques…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">📊 Statistiques</h1>
            <p className="text-xs text-slate-400 truncate">
              {profile?.nom_agence || 'Votre agence'} ·{' '}
              {isSmma ? '📱 SMMA' : '🏠 Immobilier'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700
                         text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
            >
              <span>📄</span> Rapport PDF
            </button>
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
        </div>
      </header>

      {/* ── CONTENU scrollable ─────────────────────────── */}
      <main className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ═══════════ BANDEAU OBJECTIF ═══════════════ */}
        {isSmma ? (
          /* SMMA : résumé CA mensuel */
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">CA ce mois</p>
                <p className="text-4xl font-bold mt-1">{fmtEuro(stats.caMoisEnCours)}</p>
                <p className="text-purple-200 text-sm mt-2">
                  {stats.clientsActifs} client{stats.clientsActifs > 1 ? 's' : ''} actif{stats.clientsActifs > 1 ? 's' : ''} ·{' '}
                  Budget géré total : {fmtEuro(stats.budgetMarketing)}/mois
                </p>
              </div>
              <div className="text-right space-y-3">
                <div className="bg-white/15 rounded-xl px-4 py-3">
                  <p className="text-purple-100 text-xs font-medium">CA total généré</p>
                  <p className="text-2xl font-bold">{fmtEuro(stats.caGenere)}</p>
                </div>
                {stats.topSource && (
                  <p className="text-purple-200 text-xs">
                    📡 {stats.topSource.name} · source #1 ({stats.topSource.pct}%)
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* IMMO : résumé commission mensuelle */
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Commission ce mois</p>
                <p className="text-4xl font-bold mt-1">{fmtEuro(stats.commissionMoisEnCours)}</p>
                <p className="text-blue-200 text-sm mt-2">
                  {leads.filter(l => l.statut === 'Gagné').length} lead{leads.filter(l => l.statut === 'Gagné').length > 1 ? 's' : ''} gagné{leads.filter(l => l.statut === 'Gagné').length > 1 ? 's' : ''} ce mois
                </p>
              </div>
              <div className="text-right space-y-3">
                <div className="bg-white/15 rounded-xl px-4 py-3">
                  <p className="text-blue-100 text-xs font-medium">Commission potentielle</p>
                  <p className="text-2xl font-bold">{fmtEuro(stats.commissionPotentielle)}</p>
                </div>
                <p className="text-blue-200 text-xs">Si tous les leads actifs signent</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ KPI PRINCIPAUX ═══════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon="📊" label="Leads cette semaine"  value={fmtNum(stats.leadsThisWeek)} color="blue" />
          <KPICard
            icon="📈" label="Leads ce mois"
            value={fmtNum(stats.leadsThisMonth)} color="green"
            sub={stats.leadsThisMonth > stats.leadsLastMonth
              ? `↑ +${stats.leadsThisMonth - stats.leadsLastMonth} vs mois dernier`
              : `↓ −${stats.leadsLastMonth - stats.leadsThisMonth} vs mois dernier`}
            subColor={stats.leadsThisMonth >= stats.leadsLastMonth ? 'text-green-500' : 'text-red-500'}
          />
          <KPICard icon="🧠" label="Score IA moyen"   value={`${stats.averageScore}%`}       color="purple" sub="Intention d'achat" />
          <KPICard icon="🔥" label="Leads chauds"     value={`${stats.hotLeadsPercentage}%`} color="orange" sub="Score ≥ 70 %" />
        </div>

        {/* ═══════════ MÉTRIQUES FINANCIÈRES ════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isSmma ? (
            <>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500 font-medium">CA total généré</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{fmtEuro(stats.caGenere)}</p>
                <p className="text-xs text-slate-400 mt-1">Rétainers clients signés (cumulé)</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500 font-medium">Budget marketing géré / mois</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{fmtEuro(stats.budgetMarketing)}</p>
                <p className="text-xs text-slate-400 mt-1">{stats.clientsActifs} client{stats.clientsActifs > 1 ? 's' : ''} actif{stats.clientsActifs > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500 font-medium">Taux de closing</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.conversionRate}%</p>
                <p className="text-xs text-slate-400 mt-1">{leads.filter(l => l.statut === 'Gagné').length} clients signés / {stats.totalLeads} prospects</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500 font-medium">Commission réalisée</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{fmtEuro(stats.commissionRealisee)}</p>
                <p className="text-xs text-slate-400 mt-1">Leads Gagné × taux commission</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500 font-medium">Commission potentielle</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{fmtEuro(stats.commissionPotentielle)}</p>
                <p className="text-xs text-slate-400 mt-1">Si tous les leads actifs signent</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <p className="text-sm text-slate-500 font-medium">Taux de conversion</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.conversionRate}%</p>
                <p className="text-xs text-slate-400 mt-1">{leads.filter(l => l.statut === 'Gagné').length} leads gagnés / {stats.totalLeads} total</p>
              </div>
            </>
          )}
        </div>

        {/* ═══════════ GRAPHIQUES ════════════════════════ */}
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
                <Bar dataKey="leads"  fill="#3b82f6" name="Leads"  radius={[3, 3, 0, 0]} />
                <Bar dataKey="gagnes" fill="#10b981" name={isSmma ? 'Signés' : 'Gagnés'} radius={[3, 3, 0, 0]} />
                <Bar dataKey="chauds" fill="#f59e0b" name="Chauds" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sources de trafic — SMMA prioritaire, IMMO aussi */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">
              {isSmma ? '📡 Sources de trafic' : 'Qualification IA des leads'}
            </h2>
            {isSmma ? (
              /* SMMA : barres sources */
              stats.sourceDistribution?.length > 0 ? (
                <div className="space-y-2.5 mt-2">
                  {stats.sourceDistribution.map((src, i) => (
                    <div key={src.key} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-36 truncate">{src.name}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-4 relative overflow-hidden">
                        <div
                          className="h-4 rounded-full transition-all"
                          style={{
                            width: `${src.pct}%`,
                            background: COLORS_SOURCE[i % COLORS_SOURCE.length]
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-14 text-right">
                        {src.value} ({src.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                  Aucun lead avec source enregistrée
                </div>
              )
            ) : (
              /* IMMO : donut qualification */
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stats.qualificationDistribution}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {stats.qualificationDistribution?.map((_, i) => (
                      <Cell key={i} fill={COLORS_QUALIF[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} leads`, n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pipeline par statut */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Pipeline par statut</h2>
            <div className="space-y-2">
              {stats.statusDistribution?.map((item, i) => (
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

          {/* Revenus mensuels */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">
              {isSmma ? 'CA mensuel (€)' : 'Commission mensuelle (€)'}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={isSmma ? '#a855f7' : '#10b981'} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={isSmma ? '#a855f7' : '#10b981'} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v.toLocaleString()} €`, isSmma ? 'CA' : 'Commission']} />
                <Area
                  type="monotone"
                  dataKey={isSmma ? 'ca_smma' : 'commission'}
                  stroke={isSmma ? '#a855f7' : '#10b981'}
                  strokeWidth={2.5}
                  fill="url(#colorRev)"
                  dot={{ fill: isSmma ? '#a855f7' : '#10b981', r: 4 }}
                  name={isSmma ? 'CA €' : 'Commission €'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══════════ SOURCES DE TRAFIC SMMA détaillé ══ */}
        {isSmma && stats.sourceDistribution?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">📡 Détail sources de trafic</h2>
              <span className="text-xs text-slate-400">{stats.totalLeads} leads au total</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {stats.sourceDistribution.map((src, i) => (
                <div
                  key={src.key}
                  className="rounded-xl p-4 border text-center"
                  style={{ borderColor: COLORS_SOURCE[i % COLORS_SOURCE.length] + '44',
                           background:   COLORS_SOURCE[i % COLORS_SOURCE.length] + '11' }}
                >
                  <p className="text-2xl font-black" style={{ color: COLORS_SOURCE[i % COLORS_SOURCE.length] }}>
                    {src.value}
                  </p>
                  <p className="text-xs font-medium text-slate-600 mt-1 leading-tight">{src.name}</p>
                  <p className="text-xs text-slate-400">{src.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ QUALIF IA pour SMMA ══════════════ */}
        {isSmma && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Qualification IA des prospects</h2>
            <div className="grid grid-cols-3 gap-4">
              {stats.qualificationDistribution?.map((item, i) => (
                <div key={i} className="text-center p-4 rounded-xl"
                  style={{ background: [COLORS_QUALIF[i]] + '15', border: `1px solid ${COLORS_QUALIF[i]}33` }}
                >
                  <p className="text-3xl font-black" style={{ color: COLORS_QUALIF[i] }}>{item.value}</p>
                  <p className="text-sm font-medium text-slate-600 mt-1">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    {stats.totalLeads > 0 ? Math.round(item.value / stats.totalLeads * 100) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ PIXELS & TRACKING ════════════════ */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">📡 Pixels & Tracking publicitaire</h2>
            <a
              href="/settings"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
            >
              ⚙️ Configurer
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Facebook Pixel */}
            <div className={`rounded-xl p-4 border ${pixels.fb ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">🔵</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Facebook / Meta Pixel</p>
                  {pixels.fb
                    ? <p className="text-xs text-blue-600 font-mono">{pixels.fb}</p>
                    : <p className="text-xs text-slate-400">Non configuré</p>
                  }
                </div>
                <span className={`ml-auto px-2 py-0.5 text-xs font-bold rounded-full ${
                  pixels.fb ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {pixels.fb ? '✓ Actif' : '— Inactif'}
                </span>
              </div>
              {pixels.fb && (
                <p className="text-xs text-blue-500">
                  Le Pixel est injecté dans votre formulaire public. Les conversions sont tracées dans Meta Business Suite.
                </p>
              )}
              {!pixels.fb && (
                <p className="text-xs text-slate-400">
                  Ajoutez votre Pixel ID dans Paramètres → Formulaire IA → Tracking & Pixels.
                </p>
              )}
            </div>

            {/* Google Ads */}
            <div className={`rounded-xl p-4 border ${pixels.gads ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">🔍</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Google Ads Conversion</p>
                  {pixels.gads
                    ? <p className="text-xs text-yellow-700 font-mono">{pixels.gads}{pixels.gLabel ? ` / ${pixels.gLabel}` : ''}</p>
                    : <p className="text-xs text-slate-400">Non configuré</p>
                  }
                </div>
                <span className={`ml-auto px-2 py-0.5 text-xs font-bold rounded-full ${
                  pixels.gads ? 'bg-yellow-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {pixels.gads ? '✓ Actif' : '— Inactif'}
                </span>
              </div>
              {pixels.gads && (
                <p className="text-xs text-yellow-600">
                  Tag Google Ads injecté. Les soumissions de formulaire sont comptabilisées comme conversions dans Google Ads.
                </p>
              )}
              {!pixels.gads && (
                <p className="text-xs text-slate-400">
                  Ajoutez votre Conversion ID dans Paramètres → Formulaire IA → Tracking & Pixels.
                </p>
              )}
            </div>
          </div>

          {/* Résumé trafic payant vs organique */}
          {stats.sourceDistribution?.length > 0 && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Trafic payant vs organique</p>
              <div className="flex gap-6 flex-wrap">
                {(() => {
                  const payant  = (stats.sourceDistribution || []).filter(s => ['facebook_ads','google_ads','instagram','linkedin','tiktok','youtube'].includes(s.key))
                  const organique = (stats.sourceDistribution || []).filter(s => !['facebook_ads','google_ads','instagram','linkedin','tiktok','youtube'].includes(s.key))
                  const totalPayant   = payant.reduce((s, x) => s + x.value, 0)
                  const totalOrganique = organique.reduce((s, x) => s + x.value, 0)
                  const pctPayant = stats.totalLeads > 0 ? Math.round(totalPayant / stats.totalLeads * 100) : 0
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-bold text-slate-700">{totalPayant} leads</span>
                        <span className="text-xs text-slate-400">trafic payant ({pctPayant}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm font-bold text-slate-700">{totalOrganique} leads</span>
                        <span className="text-xs text-slate-400">trafic organique ({100 - pctPayant}%)</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ SMMA : PIPELINE & LEADS PRIORITAIRES ══════ */}
        {isSmma && (
          <div className="space-y-4">
            {/* KPI pipeline SMMA */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard icon="🔥" label="Leads chauds actifs" value={stats.leadsChaudsNonTraites ?? 0} color="orange" sub="Score IA ≥ 70, non conclus" />
              <KPICard icon="📂" label="En cours de traitement" value={stats.leadsActifs ?? 0} color="blue" sub="Hors Gagné / Perdu" />
              <KPICard icon="💰" label="Rétainer moyen" value={stats.retainerMoyen ? fmtEuro(stats.retainerMoyen) : '—'} color="green" sub="Clients signés" />
              <KPICard icon="✅" label="Clients signés" value={stats.clientsActifs ?? 0} color="purple" sub={`Taux ${stats.conversionRate ?? 0}%`} />
            </div>

            {/* Funnel pipeline */}
            {stats.pipelineFunnel?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 mb-4">📊 Répartition du pipeline</h2>
                <div className="flex gap-2 items-end flex-wrap">
                  {stats.pipelineFunnel.map((s, i) => {
                    const totalFunnel = stats.pipelineFunnel.reduce((acc, x) => acc + x.count, 0)
                    const pct = totalFunnel > 0 ? Math.round((s.count / totalFunnel) * 100) : 0
                    const stageColors = {
                      'À traiter': 'bg-slate-200 text-slate-700',
                      'En cours': 'bg-blue-100 text-blue-700',
                      'Devis envoyé': 'bg-indigo-100 text-indigo-700',
                      'Négociation': 'bg-orange-100 text-orange-700',
                      'Gagné': 'bg-green-100 text-green-700',
                      'Perdu': 'bg-red-100 text-red-700',
                    }
                    const cls = stageColors[s.stage] || 'bg-slate-100 text-slate-600'
                    return (
                      <div key={s.stage} className={`flex-1 min-w-[100px] rounded-xl p-3 text-center ${cls}`}>
                        <p className="text-2xl font-bold">{s.count}</p>
                        <p className="text-xs font-medium mt-0.5">{s.stage}</p>
                        <p className="text-xs opacity-70">{pct}%</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Top leads par score IA */}
            {stats.topSmmaLeads?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 mb-4">🏆 Top leads par score IA</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Client</th>
                        <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Score IA</th>
                        <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Qualification</th>
                        <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                        <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                        <th className="pb-3 text-right text-xs font-semibold text-slate-500 uppercase">Budget déclaré</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.topSmmaLeads.map((lead, i) => {
                        const q = getQualif(lead)
                        const badgeClass = q === 'chaud' ? 'bg-green-100 text-green-700'
                          : q === 'tiede' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        const score = lead.score || lead.score_ia || 0
                        const rawBudget = lead.budget_marketing || lead.budget
                        return (
                          <tr key={lead.id}>
                            <td className="py-3 text-sm font-medium text-slate-800">
                              <span className="text-slate-400 mr-2">#{i + 1}</span>{lead.nom}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-700">{score}</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badgeClass}`}>
                                {q === 'chaud' ? '🟢 Chaud' : q === 'tiede' ? '🟡 Tiède' : '🔴 Froid'}
                              </span>
                            </td>
                            <td className="py-3 text-xs text-slate-500">{lead.statut || '—'}</td>
                            <td className="py-3 text-xs text-slate-500">
                              {SOURCE_LABELS[lead.source] || lead.source || '—'}
                            </td>
                            <td className="py-3 text-right text-xs text-slate-500">
                              {rawBudget ? String(rawBudget) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ IMMO : TOP LEADS PAR BUDGET ════════════ */}
        {!isSmma && stats.topLeads?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">🏆 Top leads par budget</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Lead</th>
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Score IA</th>
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
                        <td className="py-3 text-xs text-slate-500">{lead.statut || '—'}</td>
                        <td className="py-3 text-right text-sm font-bold text-slate-800">
                          {fmtEuro(lead.budget || 0)}
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-green-600">
                          {fmtEuro(calcCommission(lead.budget))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════ ROI PAR SOURCE ═══════════════════ */}
        {stats.roiDistribution?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">
                💰 ROI par source de trafic
              </h2>
              <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                {isSmma ? 'CA rétainer' : 'Commission estimée'} des leads Gagnés
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                    <th className="pb-3 text-center text-xs font-semibold text-slate-500 uppercase">Leads</th>
                    <th className="pb-3 text-center text-xs font-semibold text-slate-500 uppercase">{isSmma ? 'Signés' : 'Gagnés'}</th>
                    <th className="pb-3 text-center text-xs font-semibold text-slate-500 uppercase">Taux closing</th>
                    <th className="pb-3 text-right text-xs font-semibold text-slate-500 uppercase">{isSmma ? 'CA généré' : 'Commission est.'}</th>
                    <th className="pb-3 text-right text-xs font-semibold text-slate-500 uppercase">Part du CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    const totalRevenue = stats.roiDistribution.reduce((s, r) => s + r.revenue, 0)
                    return stats.roiDistribution.map((row, i) => {
                      const pct = totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 100) : 0
                      return (
                        <tr key={row.key} className="hover:bg-slate-50">
                          <td className="py-3 text-sm font-medium text-slate-800">{row.name}</td>
                          <td className="py-3 text-center text-sm text-slate-600">{row.leads}</td>
                          <td className="py-3 text-center text-sm font-semibold text-green-600">{row.gagnes}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              row.convRate >= 50 ? 'bg-green-100 text-green-700'
                              : row.convRate >= 20 ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                              {row.convRate}%
                            </span>
                          </td>
                          <td className="py-3 text-right text-sm font-bold text-slate-800">
                            {fmtEuro(row.revenue)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: COLORS_SOURCE[i % COLORS_SOURCE.length]
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
                <tfoot className="border-t-2 border-slate-200">
                  <tr>
                    <td className="pt-3 text-sm font-bold text-slate-800">Total</td>
                    <td className="pt-3 text-center text-sm font-bold text-slate-800">{stats.totalLeads}</td>
                    <td className="pt-3 text-center text-sm font-bold text-green-700">{leads.filter(l => l.statut === 'Gagné').length}</td>
                    <td className="pt-3 text-center text-sm font-bold text-indigo-700">{stats.conversionRate}%</td>
                    <td className="pt-3 text-right text-sm font-bold text-green-700">
                      {fmtEuro(stats.roiDistribution.reduce((s, r) => s + r.revenue, 0))}
                    </td>
                    <td className="pt-3 text-right text-xs font-semibold text-slate-400">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════ RAPPORT MENSUEL ══════════════════ */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4">Rapport mensuel</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Mois', 'Leads', isSmma ? 'Signés' : 'Gagnés', 'Chauds', isSmma ? 'CA (€)' : 'Commission (€)', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.monthlyData?.map((m, i) => {
                  const rev = isSmma ? m.ca_smma : m.commission
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.month}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.leads}</td>
                      <td className="px-4 py-3 text-sm text-green-600 font-semibold">{m.gagnes}</td>
                      <td className="px-4 py-3 text-sm text-orange-600 font-semibold">{m.chauds}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{fmtEuro(rev)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                          rev > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {rev > 0 ? '✅ Actif' : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      </main>

      {/* ══════════════════════════════════════════════
          MODAL RAPPORT MENSUEL PDF
      ══════════════════════════════════════════════ */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">📊 Rapport mensuel</h2>
                <p className="text-xs text-slate-400">
                  {profile?.nom_agence || 'Votre agence'} ·{' '}
                  {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReport}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  🖨️ Imprimer / PDF
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="px-3 py-2 text-slate-400 hover:text-slate-600 text-xl leading-none"
                >×</button>
              </div>
            </div>

            {/* Contenu rapport — scrollable */}
            <div ref={reportRef} id="report-print-area" className="overflow-auto p-6 space-y-5">

              {/* Résumé KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Leads ce mois',   value: stats.leadsThisMonth,    icon: '📊', color: '#3b82f6' },
                  { label: isSmma ? 'Signés'  : 'Gagnés', value: leads.filter(l => l.statut === 'Gagné').length, icon: '✅', color: '#10b981' },
                  { label: 'Leads chauds',    value: `${stats.hotLeadsPercentage}%`, icon: '🔥', color: '#f59e0b' },
                  { label: 'Taux closing',    value: `${stats.conversionRate}%`, icon: '🎯', color: '#8b5cf6' },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4 text-center border"
                    style={{ borderColor: k.color + '33', background: k.color + '11' }}>
                    <p className="text-2xl">{k.icon}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Revenu */}
              <div className="rounded-xl border border-slate-100 p-5 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">
                  {isSmma ? 'Chiffre d\'affaires' : 'Commissions'}
                </p>
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <p className="text-xs text-slate-400">Ce mois</p>
                    <p className="text-xl font-black text-green-600">
                      {fmtEuro(isSmma ? stats.caMoisEnCours : stats.commissionMoisEnCours)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total cumulé</p>
                    <p className="text-xl font-black text-indigo-600">
                      {fmtEuro(isSmma ? stats.caGenere : stats.commissionRealisee)}
                    </p>
                  </div>
                  {!isSmma && (
                    <div>
                      <p className="text-xs text-slate-400">Potentiel pipeline</p>
                      <p className="text-xl font-black text-blue-600">
                        {fmtEuro(stats.commissionPotentielle)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tableau mensuel 6 mois */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Activité 6 derniers mois</p>
                <table className="min-w-full text-sm border border-slate-100 rounded-xl overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Mois', 'Leads', isSmma ? 'Signés' : 'Gagnés', 'Chauds', isSmma ? 'CA' : 'Commission'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.monthlyData?.map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-slate-800">{m.month}</td>
                        <td className="px-3 py-2 text-slate-600">{m.leads}</td>
                        <td className="px-3 py-2 font-semibold text-green-600">{m.gagnes}</td>
                        <td className="px-3 py-2 font-semibold text-orange-500">{m.chauds}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{fmtEuro(isSmma ? m.ca_smma : m.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ROI par source */}
              {stats.roiDistribution?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">ROI par source</p>
                  <table className="min-w-full text-sm border border-slate-100 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Source', 'Leads', isSmma ? 'Signés' : 'Gagnés', 'Closing', isSmma ? 'CA généré' : 'Commission'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.roiDistribution.map((row) => (
                        <tr key={row.key}>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                          <td className="px-3 py-2 text-slate-600">{row.leads}</td>
                          <td className="px-3 py-2 font-semibold text-green-600">{row.gagnes}</td>
                          <td className="px-3 py-2 text-slate-600">{row.convRate}%</td>
                          <td className="px-3 py-2 font-bold text-slate-800">{fmtEuro(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pied de rapport */}
              <div className="text-center pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Rapport généré par <strong>LeadQualif IA</strong> ·{' '}
                  {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
