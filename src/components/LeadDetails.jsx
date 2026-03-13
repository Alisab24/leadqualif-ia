/**
 * LeadDetails — Fiche complète d'un lead
 * Design unifié avec le Dashboard (slate palette)
 * Route : /lead/:id  |  Rendu dans <Layout>
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { aiService } from '../services/ai'
import DocumentGenerator from './DocumentGenerator'

/* ─── Utilitaires ─────────────────────────────────────────── */
const fmt = {
  date: (d) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      : '—',
  dateTime: (d) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })
      : '—',
  budget: (v) =>
    v ? Number(v).toLocaleString('fr-FR') + ' €' : '—',
}

const SCORE_STYLE = (s) => {
  if (s >= 70) return { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: 'Chaud 🔥' }
  if (s >= 40) return { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: 'Tiède 🌤' }
  return         { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-800',    label: 'Froid ❄️' }
}

const QUALIFICATION_COLOR = {
  chaud:    'bg-green-100  text-green-800  border-green-200',
  tiede:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  froid:    'bg-red-100    text-red-800    border-red-200',
  CHAUD:    'bg-green-100  text-green-800  border-green-200',
  TIEDE:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  FROID:    'bg-red-100    text-red-800    border-red-200',
}

const CRM_ICONS = {
  edit: '✏️', rdv: '📅', whatsapp: '💬', email: '📧',
  call: '📞', document: '📄', ia_suggestion: '🧠', note: '📝',
}

const initials = (name = '') =>
  name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

/* ─── Composant ───────────────────────────────────────────── */
const LeadDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [lead, setLead]                   = useState(null)
  const [agencyProfile, setAgencyProfile] = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  // IA
  const [aiSuggestion, setAiSuggestion]     = useState('')
  const [loadingAI, setLoadingAI]           = useState(false)

  // Historique CRM
  const [crmHistory, setCrmHistory]       = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Onglet actif
  const [activeTab, setActiveTab]         = useState('info')

  // ─── Chargement lead ──────────────────────────────────────
  useEffect(() => { if (id) loadLead() }, [id])

  const loadLead = async () => {
    try {
      setLoading(true); setError(null)
      const { data, error: e } = await supabase
        .from('leads').select('*').eq('id', id).single()
      if (e) throw e
      setLead(data)
      if (data.resume_ia)    setAiSuggestion(data.resume_ia)
      if (data.suggestion_ia) setAiSuggestion(data.suggestion_ia)

      // profil agence
      if (data.agency_id) {
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('agency_id', data.agency_id).single()
        setAgencyProfile(prof || { agency_id: data.agency_id })
      }
    } catch (err) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // ─── Historique CRM ──────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!id || loadingHistory) return
    setLoadingHistory(true)
    const { data } = await supabase
      .from('crm_events')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setCrmHistory(data || [])
    setLoadingHistory(false)
  }, [id])

  // ─── Suggestion IA ───────────────────────────────────────
  const fetchAI = async () => {
    if (!lead || loadingAI) return
    setLoadingAI(true)
    try {
      const result = await aiService.qualifyLead(lead)
      const evaluation = result?.evaluation_complete || result
      const actionImmediate = evaluation?.recommandations?.action_immediate
      const niveau = result?.niveau_interet_final || result?.niveau_interet || evaluation?.niveau_interet || 'FROID'
      const score = result?.score_qualification ?? result?.score ?? 0
      const resume = result?.resume || evaluation?.raison_classification || ''
      const recs = Array.isArray(result?.recommandations) ? result.recommandations : []
      const suggestion = actionImmediate
        || (recs.length > 0 ? recs.join(' ') : null)
        || (resume ? `${niveau} (${score}%) — ${resume}` : `Score : ${score}% — Niveau : ${niveau}`)

      setAiSuggestion(suggestion || '')
      await supabase.from('leads').update({
        resume_ia: suggestion,
        suggestion_ia: suggestion,
        score_qualification: score,
        niveau_interet: niveau,
      }).eq('id', id)
    } catch (err) {
      console.error('fetchAI error:', err)
    }
    setLoadingAI(false)
  }

  // ─── Log CRM ─────────────────────────────────────────────
  const logCrm = async (type, title, description = '') => {
    await supabase.from('crm_events').insert({
      lead_id: id, agency_id: lead?.agency_id,
      type, title, description,
    })
  }

  // ─── Changer onglet ──────────────────────────────────────
  const switchTab = (key) => {
    setActiveTab(key)
    if (key === 'historique' && crmHistory.length === 0) fetchHistory()
    if (key === 'ia' && !aiSuggestion) fetchAI()
  }

  // ─── États de chargement / erreur ────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-screen text-slate-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-sm">Chargement du lead…</p>
      </div>
    </div>
  )

  if (error || !lead) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-slate-700 font-semibold mb-1">{error || 'Lead introuvable'}</p>
        <button onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          ← Retour au Dashboard
        </button>
      </div>
    </div>
  )

  const score   = lead.score_qualification || 0
  // Aligner avec Dashboard : niveau_interet prime sur le calcul du score numérique
  const rawNiveau = (lead.niveau_interet || '').toLowerCase()
    .replace('tiède', 'tiede').replace('tièd', 'tiede')
  const effectiveNiveau = rawNiveau || (score >= 70 ? 'chaud' : score >= 40 ? 'tiede' : 'froid')
  const ss = effectiveNiveau === 'chaud'
    ? { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: 'Chaud 🔥' }
    : effectiveNiveau === 'tiede'
    ? { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: 'Tiède 🌤' }
    : { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-800',    label: 'Froid ❄️' }
  const niveau  = lead.niveau_interet?.toLowerCase()
  const qualCls = QUALIFICATION_COLOR[niveau] || 'bg-slate-100 text-slate-700 border-slate-200'
  const agencyId = agencyProfile?.agency_id || agencyProfile?.id
  const agencyType = agencyProfile?.type_agence || 'immobilier'

  /* ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">

          {/* Gauche : retour + identité */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors shrink-0"
              title="Retour au Dashboard"
            >
              ←
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                            flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials(lead.nom)}
            </div>

            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">{lead.nom}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${qualCls}`}>
                  {lead.niveau_interet || '—'}
                </span>
                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${ss.badge}`}>
                  Score {score}%
                </span>
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  lead.lead_role === 'proprietaire'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {lead.lead_role === 'proprietaire' ? '🔑 Propriétaire' : '🏠 Client'}
                </span>
              </div>
            </div>
          </div>

          {/* Droite : actions rapides */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                window.open(`https://wa.me/${lead.telephone?.replace(/\D/g, '')}`, '_blank')
                logCrm('whatsapp', 'Message WhatsApp envoyé')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100
                         text-green-700 rounded-lg text-xs font-semibold transition-colors"
              title="WhatsApp"
            >
              <span>💬</span><span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={() => {
                window.open(`tel:${lead.telephone}`, '_blank')
                logCrm('call', 'Appel téléphonique')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100
                         text-blue-700 rounded-lg text-xs font-semibold transition-colors"
              title="Appeler"
            >
              <span>📞</span><span className="hidden sm:inline">Appeler</span>
            </button>
            <button
              onClick={() => {
                window.open(`mailto:${lead.email}`, '_blank')
                logCrm('email', 'Email envoyé')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100
                         text-orange-700 rounded-lg text-xs font-semibold transition-colors"
              title="Email"
            >
              <span>📧</span><span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => {
                const url = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com'
                window.open(url, '_blank')
                logCrm('rdv', 'RDV proposé via Calendly')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100
                         text-purple-700 rounded-lg text-xs font-semibold transition-colors"
              title="Proposer un RDV"
            >
              <span>📅</span><span className="hidden sm:inline">RDV</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── ONGLETS ────────────────────────────────────────── */}
      <div className="flex-none flex border-b border-slate-200 bg-white px-6">
        {[
          { key: 'info',       label: '📋 Infos' },
          { key: 'historique', label: '🕐 Historique' },
          { key: 'ia',         label: '🧠 IA' },
          { key: 'documents',  label: '📄 Documents' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENU ────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto p-6">

        {/* ═══ ONGLET INFOS ═══════════════════════════════ */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">

            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-5">

              {/* Contact */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                  Coordonnées
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: '📧', label: 'Email',       value: lead.email },
                    { icon: '📞', label: 'Téléphone',   value: lead.telephone },
                    { icon: '💰', label: 'Budget',       value: fmt.budget(lead.budget), accent: true },
                    { icon: '🏠', label: 'Type de bien', value: lead.type_bien },
                    { icon: '📍', label: 'Localisation', value: lead.localisation_souhaitee },
                    { icon: '🌍', label: 'Source',       value: lead.source?.replace('_', ' ') },
                    { icon: '📅', label: 'Créé le',      value: fmt.date(lead.created_at) },
                    { icon: '🔄', label: 'Mis à jour',   value: fmt.date(lead.updated_at) },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className="text-base mt-0.5 shrink-0">{row.icon}</span>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">{row.label}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${
                          row.accent ? 'text-green-600' : 'text-slate-800'
                        }`}>{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Message / Besoins */}
              {lead.message && (
                <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                    💬 Message / Besoins
                  </h2>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {lead.message}
                  </p>
                </section>
              )}

              {/* Points forts / attention / recommandations */}
              {!!(lead.points_forts?.length || lead.points_attention?.length || lead.recommandations?.length) && (
                <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                    Analyse de qualification
                  </h2>
                  <div className="space-y-4">
                    {lead.points_forts?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-green-700 mb-2">✅ Points forts</p>
                        <ul className="space-y-1.5">
                          {lead.points_forts.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="text-green-500 shrink-0 mt-0.5">•</span>{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lead.points_attention?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-yellow-700 mb-2">⚠️ Points d'attention</p>
                        <ul className="space-y-1.5">
                          {lead.points_attention.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="text-yellow-500 shrink-0 mt-0.5">•</span>{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lead.recommandations?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-indigo-700 mb-2">💡 Recommandations</p>
                        <ul className="space-y-1.5">
                          {lead.recommandations.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="text-indigo-500 shrink-0 mt-0.5">→</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar métriques */}
            <div className="space-y-5">

              {/* Score gauge */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                  Score IA
                </h2>
                <div className={`rounded-xl p-4 ${ss.badge}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{ss.label}</span>
                    <span className="text-2xl font-bold">{score}%</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${ss.bar}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-xs mt-2 opacity-70">Score d'intention d'achat</p>
                </div>
              </section>

              {/* Métriques */}
              <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                  Métriques
                </h2>
                <div className="space-y-3">
                  {lead.niveau_interet && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Niveau d'intérêt</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${qualCls}`}>
                        {lead.niveau_interet}
                      </span>
                    </div>
                  )}
                  {lead.urgence && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Urgence</span>
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                        {lead.urgence}
                      </span>
                    </div>
                  )}
                  {lead.budget && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Budget</span>
                      <span className="text-xs font-bold text-green-600">{fmt.budget(lead.budget)}</span>
                    </div>
                  )}
                  {lead.statut && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Statut pipeline</span>
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {lead.statut}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Lien documents */}
              <button
                onClick={() => navigate(`/documents?lead=${id}`)}
                className="w-full flex items-center justify-center gap-2 p-3
                           bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700
                           text-sm font-semibold transition-colors border border-blue-100"
              >
                📂 Voir tous les documents du lead
              </button>
            </div>
          </div>
        )}

        {/* ═══ ONGLET HISTORIQUE ══════════════════════════ */}
        {activeTab === 'historique' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  🕐 Historique CRM
                </h2>
                <button
                  onClick={fetchHistory}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  🔄 Rafraîchir
                </button>
              </div>

              {loadingHistory && (
                <div className="text-center py-8 text-slate-400 text-sm">Chargement…</div>
              )}

              <div className="space-y-4">
                {crmHistory.map((ev, i) => (
                  <div key={ev.id || i} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm">
                      {CRM_ICONS[ev.type] || '⚡'}
                    </div>
                    <div className="flex-1 min-w-0 pb-4 border-b border-slate-50 last:border-0">
                      <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                      {ev.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{ev.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{fmt.dateTime(ev.created_at)}</p>
                    </div>
                  </div>
                ))}

                {/* Entrée de création toujours présente */}
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm">⚡</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Lead créé</p>
                    <p className="text-xs text-slate-400 mt-1">{fmt.date(lead.created_at)}</p>
                  </div>
                </div>

                {!loadingHistory && crmHistory.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Aucun événement CRM enregistré pour l'instant
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ONGLET IA ═══════════════════════════════════ */}
        {activeTab === 'ia' && (
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Score + bouton analyser */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  🧠 Analyse IA
                </h2>
                <button
                  onClick={fetchAI}
                  disabled={loadingAI}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white
                             rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {loadingAI ? '⏳ Analyse…' : '🔄 Analyser'}
                </button>
              </div>

              {/* Gauge */}
              <div className={`rounded-xl p-4 ${ss.badge}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{ss.label}</span>
                  <span className="text-3xl font-bold">{score}%</span>
                </div>
                <div className="w-full bg-white/60 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all ${ss.bar}`} style={{ width: `${score}%` }} />
                </div>
                <p className="text-xs mt-2 opacity-70">Score d'intention d'achat / conversion</p>
              </div>
            </section>

            {/* Suggestion IA — on vérifie que c'est une string non-vide */}
            {(() => {
              const txt = typeof aiSuggestion === 'string' && aiSuggestion.trim()
                ? aiSuggestion
                : typeof lead.suggestion_ia === 'string' && lead.suggestion_ia.trim()
                  ? lead.suggestion_ia
                  : null
              return txt ? (
                <section className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-purple-700 mb-3 uppercase tracking-wide">
                    💡 Recommandation IA
                  </p>
                  <p className="text-sm text-purple-800 leading-relaxed">{txt}</p>
                </section>
              ) : null
            })()}

            {/* Résumé IA distinct */}
            {typeof lead.resume_ia === 'string' && lead.resume_ia.trim() &&
              lead.resume_ia !== aiSuggestion && lead.resume_ia !== lead.suggestion_ia && (
              <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">
                  📝 Résumé IA
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{lead.resume_ia}</p>
              </section>
            )}

            {loadingAI && (
              <div className="text-center py-8 text-slate-400">
                <div className="animate-spin text-3xl mb-3">⚙️</div>
                <p className="text-sm">Analyse en cours…</p>
              </div>
            )}

            {!loadingAI && !(typeof aiSuggestion === 'string' && aiSuggestion.trim()) &&
              !(typeof lead.suggestion_ia === 'string' && lead.suggestion_ia.trim()) && (
              <p className="text-sm text-slate-400 text-center py-8">
                Cliquez sur "Analyser" pour générer une analyse IA de ce lead
              </p>
            )}
          </div>
        )}

        {/* ═══ ONGLET DOCUMENTS ═══════════════════════════ */}
        {activeTab === 'documents' && (
          <div className="max-w-4xl mx-auto">
            <DocumentGenerator
              lead={lead}
              agencyId={agencyId}
              agencyType={agencyType}
              onDocumentGenerated={(data) => {
                logCrm('document', 'Document généré', `Type : ${data?.type || 'Document'}`)
              }}
            />
          </div>
        )}

      </main>
    </div>
  )
}

export default LeadDetails
