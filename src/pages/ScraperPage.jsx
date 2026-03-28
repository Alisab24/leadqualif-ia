/**
 * ScraperPage — LeadQualif Scraper Engine v3
 * Page /scraper — 3 onglets : Mes cibles / Créer une cible / Résultats en temps réel
 */
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

// ── Icônes SVG ──────────────────────────────────────────────────────────
const IconTarget  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
const IconPlus    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconChart   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
const IconPlay    = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><polygon points="5,3 19,12 5,21"/></svg>
const IconTrash   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
const IconInject  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19,12 12,19 5,12"/></svg>

// ── Constantes canaux ────────────────────────────────────────────────────
const CANAUX_FR = [
  { id: 'google_places',  label: 'Google Places',      emoji: '📍', cout: 'Gratuit',   gratuit: true },
  { id: 'api_entreprises',label: 'API Entreprises FR',  emoji: '🏢', cout: 'Gratuit',   gratuit: true },
  { id: 'pages_jaunes',   label: 'Pages Jaunes',        emoji: '📒', cout: 'Gratuit',   gratuit: true },
  { id: 'website',        label: 'Site web (scraper)',   emoji: '🌐', cout: 'Gratuit',   gratuit: true },
  { id: 'instagram',      label: 'Instagram Business',  emoji: '📸', cout: '~0.005€/lead', gratuit: false },
  { id: 'facebook',       label: 'Facebook Pages',      emoji: '👥', cout: 'Variable',  gratuit: false },
  { id: 'linkedin',       label: 'LinkedIn',            emoji: '💼', cout: '~0.01€/lead',  gratuit: false },
]
const CANAUX_EN = [
  { id: 'google_places',   label: 'Google Places',       emoji: '📍', cout: 'Free',     gratuit: true },
  { id: 'companies_house', label: 'Companies House UK',  emoji: '🏛️', cout: 'Free',     gratuit: true },
  { id: 'yelp',            label: 'Yelp Fusion',         emoji: '⭐', cout: 'Free',     gratuit: true },
  { id: 'opencorporates',  label: 'OpenCorporates',      emoji: '🌍', cout: 'Free',     gratuit: true },
  { id: 'website',         label: 'Website scraper',     emoji: '🌐', cout: 'Free',     gratuit: true },
  { id: 'linkedin',        label: 'LinkedIn',            emoji: '💼', cout: '~0.01$/lead', gratuit: false },
  { id: 'instagram',       label: 'Instagram Business',  emoji: '📸', cout: '~0.005$/lead',gratuit: false },
  { id: 'tiktok',          label: 'TikTok Business',     emoji: '🎵', cout: '~0.005$/lead',gratuit: false },
  { id: 'facebook',        label: 'Facebook Pages',      emoji: '👥', cout: 'Variable', gratuit: false },
]

const FREQUENCES = [
  { value: 'manual',  label: '🖱 Manuel uniquement' },
  { value: 'daily',   label: '📅 Quotidien' },
  { value: 'weekly',  label: '📆 Hebdomadaire' },
  { value: 'monthly', label: '🗓 Mensuel' },
]

const PAYS_FR = ['France', 'Belgique', 'Suisse', 'Maroc', 'Côte d\'Ivoire', 'Sénégal', 'Luxembourg', 'Tunisie']
const PAYS_EN = ['UK', 'USA', 'Canada', 'Australia', 'Switzerland', 'Belgium']

function scoreBadge(score) {
  if (score >= 71) return { label: 'Chaud', cls: 'bg-red-100 text-red-700' }
  if (score >= 41) return { label: 'Tiède', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Froid', cls: 'bg-blue-100 text-blue-700' }
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Composant principal ─────────────────────────────────────────────────
export default function ScraperPage() {
  const [tab, setTab] = useState('targets')
  const [user, setUser] = useState(null)
  const [agencyId, setAgencyId] = useState(null)

  // Données
  const [targets, setTargets] = useState([])
  const [presets, setPresets] = useState([])
  const [rawLeads, setRawLeads] = useState([])
  const [editingSources, setEditingSources] = useState(null) // target.id en édition sources

  // Formulaire nouvelle cible
  const [form, setForm] = useState({
    langue: 'fr',
    nom: '',
    preset: null,
    mots_cles: [],
    codes_naf: [],
    sic_codes: [],
    zones_geo: [],
    pays: [],
    canaux_actifs: ['google_places', 'website'],
    sources_actives: ['google_places'],
    frequence: 'manual',
  })
  const [kwInput, setKwInput] = useState('')
  const [zoneInput, setZoneInput] = useState('')

  // États UI
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState(null) // target_id en cours
  const [toast, setToast] = useState(null)
  const [filterSource, setFilterSource] = useState('all')
  const [filterScore, setFilterScore] = useState('all')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Chargement initial ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', data.user.id)
          .single()
        setAgencyId(profile?.agency_id || data.user.id)
      }
    })
    loadTargets()
    loadPresets()
    loadRawLeads()
  }, [])

  const loadTargets = async () => {
    const { data } = await supabase
      .from('scraper_targets')
      .select('*')
      .order('created_at', { ascending: false })
    setTargets(data || [])
  }

  const loadPresets = async () => {
    const { data } = await supabase
      .from('scraper_keywords_presets')
      .select('*')
      .order('nom')
    setPresets(data || [])
  }

  const loadRawLeads = async () => {
    const { data } = await supabase
      .from('raw_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setRawLeads(data || [])
  }

  // ── Appliquer preset ────────────────────────────────────────────────
  const applyPreset = (preset) => {
    const canaux = preset.canaux_recommandes || []
    setForm(f => ({
      ...f,
      preset,
      nom: preset.nom,
      mots_cles: preset.mots_cles || [],
      codes_naf: preset.codes_naf || [],
      sic_codes: preset.sic_codes || [],
      canaux_actifs: canaux,
      sources_actives: preset.sources_recommandees || [],
    }))
  }

  // ── Tag inputs ──────────────────────────────────────────────────────
  const addKeyword = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && kwInput.trim()) {
      e.preventDefault()
      const kw = kwInput.trim().replace(/,$/, '')
      if (!form.mots_cles.includes(kw)) {
        setForm(f => ({ ...f, mots_cles: [...f.mots_cles, kw] }))
      }
      setKwInput('')
    }
  }
  const removeKeyword = (kw) => setForm(f => ({ ...f, mots_cles: f.mots_cles.filter(k => k !== kw) }))

  const addZone = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && zoneInput.trim()) {
      e.preventDefault()
      const z = zoneInput.trim().replace(/,$/, '')
      if (!form.zones_geo.includes(z)) {
        setForm(f => ({ ...f, zones_geo: [...f.zones_geo, z] }))
      }
      setZoneInput('')
    }
  }
  const removeZone = (z) => setForm(f => ({ ...f, zones_geo: f.zones_geo.filter(x => x !== z) }))

  const toggleCanal = (id) => {
    setForm(f => {
      const canaux = f.canaux_actifs.includes(id)
        ? f.canaux_actifs.filter(c => c !== id)
        : [...f.canaux_actifs, id]
      // Synchro sources_actives avec les canaux de scraping (non-enrich)
      const sources = canaux.filter(c => ['google_places','api_entreprises','pages_jaunes','companies_house','yelp','opencorporates','facebook'].includes(c))
      return { ...f, canaux_actifs: canaux, sources_actives: sources }
    })
  }

  const togglePays = (pays) => {
    setForm(f => ({
      ...f,
      pays: f.pays.includes(pays) ? f.pays.filter(p => p !== pays) : [...f.pays, pays],
    }))
  }

  // ── Créer une target ────────────────────────────────────────────────
  const createTarget = async () => {
    if (!form.nom.trim()) return showToast('Entrez un nom pour la cible', 'error')
    if (form.mots_cles.length === 0) return showToast('Ajoutez au moins un mot-clé', 'error')

    setLoading(true)
    const { data, error } = await supabase.from('scraper_targets').insert({
      user_id: user.id,
      nom: form.nom,
      langue: form.langue,
      mots_cles: form.mots_cles,
      codes_naf: form.codes_naf,
      sic_codes: form.sic_codes,
      zones_geo: form.zones_geo,
      pays: form.pays,
      canaux_actifs: form.canaux_actifs,
      sources_actives: form.sources_actives,
      frequence: form.frequence,
      actif: true,
    }).select().single()

    setLoading(false)
    if (error) return showToast('Erreur lors de la création', 'error')

    showToast(`✅ Cible "${form.nom}" créée !`)
    setTargets(prev => [data, ...prev])
    setTab('targets')
    // Reset form
    setForm({ langue: 'fr', nom: '', preset: null, mots_cles: [], codes_naf: [], sic_codes: [], zones_geo: [], pays: [], canaux_actifs: ['google_places','website'], sources_actives: ['google_places'], frequence: 'manual' })

    // Lancer immédiatement
    launchTarget(data)
  }

  // ── Lancer une target ───────────────────────────────────────────────
  const launchTarget = async (target) => {
    setLaunching(target.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scraper-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_id: target.id, user_id: user?.id }),
      })
      const result = await res.json()
      if (result.success) {
        showToast(`🎯 ${result.inserted} leads trouvés pour "${target.nom}"`)
        loadTargets()
        loadRawLeads()
        setTab('results')
      } else {
        showToast(result.error || 'Erreur lors du scraping', 'error')
      }
    } catch (err) {
      showToast('Erreur de connexion', 'error')
    }
    setLaunching(null)
  }

  // ── Toggle actif ────────────────────────────────────────────────────
  const toggleTargetActif = async (target) => {
    await supabase.from('scraper_targets').update({ actif: !target.actif }).eq('id', target.id)
    setTargets(prev => prev.map(t => t.id === target.id ? { ...t, actif: !t.actif } : t))
  }

  // ── Supprimer target ────────────────────────────────────────────────
  const deleteTarget = async (target) => {
    if (!window.confirm(`Supprimer la cible "${target.nom}" ?`)) return
    await supabase.from('scraper_targets').delete().eq('id', target.id)
    setTargets(prev => prev.filter(t => t.id !== target.id))
    showToast('Cible supprimée')
  }

  // ── Toggle source sur une target existante ──────────────────────────
  const toggleTargetSource = async (target, sourceId) => {
    const allSources = ['google_places', 'api_entreprises', 'pages_jaunes', 'companies_house', 'yelp', 'opencorporates', 'facebook']
    const enrichSources = ['website', 'linkedin', 'instagram', 'tiktok']
    const currentCanaux = target.canaux_actifs || []
    const currentSources = target.sources_actives || []

    let newCanaux, newSources
    if (currentCanaux.includes(sourceId)) {
      newCanaux = currentCanaux.filter(c => c !== sourceId)
      newSources = newCanaux.filter(c => allSources.includes(c))
    } else {
      newCanaux = [...currentCanaux, sourceId]
      newSources = newCanaux.filter(c => allSources.includes(c))
    }

    await supabase.from('scraper_targets').update({
      canaux_actifs: newCanaux,
      sources_actives: newSources,
    }).eq('id', target.id)

    setTargets(prev => prev.map(t =>
      t.id === target.id ? { ...t, canaux_actifs: newCanaux, sources_actives: newSources } : t
    ))
    showToast(`Source ${currentCanaux.includes(sourceId) ? 'désactivée' : 'activée'} ✓`)
  }

  // ── Injecter dans pipeline ──────────────────────────────────────────
  const injectLead = async (lead) => {
    const resolvedAgencyId = agencyId || user?.id
    if (!resolvedAgencyId) {
      showToast('Impossible de trouver votre agence', 'error')
      return
    }

    // Calcul niveau_interet depuis score
    const score = lead.score_initial || 0
    const niveauInteret = score >= 71 ? 'CHAUD' : score >= 41 ? 'TIÈDE' : 'FROID'

    // Adresse combinée (api_entreprises renvoie ville séparé)
    const adresseCombinee = [lead.adresse, lead.ville].filter(Boolean).join(', ') || null

    // Message enrichi avec info scraper
    const notesScraper = [
      lead.ai_opener,
      `[Scraper Engine] Source: ${lead.source || 'auto'}`,
      lead.note_google ? `⭐ ${lead.note_google}/5 (${lead.nb_avis || 0} avis)` : null,
      lead.siren ? `SIREN: ${lead.siren}` : null,
    ].filter(Boolean).join('\n')

    // telephone_secondaire comme fallback si pas de tel principal (api_entreprises n'en donne pas)
    const telephoneFinal = lead.telephone || lead.telephone_secondaire || null

    const { error } = await supabase.from('leads').insert({
      agency_id:          resolvedAgencyId,
      nom:                lead.nom,
      email:              lead.email || null,
      telephone:          telephoneFinal,
      adresse:            adresseCombinee,
      site_web:           lead.site_web || null,
      secteur_activite:   lead.secteur_activite || null,
      score:              score,
      score_qualification: score,
      niveau_interet:     niveauInteret,
      statut:             'À traiter',           // statut pipeline valide
      message:            notesScraper || null,
      source:             'autre',               // valeur valide dans SOURCES_VALIDES
    })

    if (!error) {
      await supabase.from('raw_leads').update({ injecte_pipeline: true }).eq('id', lead.id)
      setRawLeads(prev => prev.map(l => l.id === lead.id ? { ...l, injecte_pipeline: true } : l))
      showToast('✅ Lead injecté dans le pipeline !')
    } else {
      console.error('[injectLead] Erreur:', error)
      showToast(`Erreur injection: ${error.message}`, 'error')
    }
  }

  // ── Filtres résultats ───────────────────────────────────────────────
  const filteredLeads = rawLeads.filter(l => {
    if (filterSource !== 'all' && l.source !== filterSource) return false
    if (filterScore === 'chaud' && (l.score_initial || 0) < 71) return false
    if (filterScore === 'tiede' && ((l.score_initial || 0) < 41 || (l.score_initial || 0) >= 71)) return false
    if (filterScore === 'froid' && (l.score_initial || 0) >= 41) return false
    return true
  })

  const sources = [...new Set(rawLeads.map(l => l.source).filter(Boolean))]
  const canaux = form.langue === 'fr' ? CANAUX_FR : CANAUX_EN
  const presetsFiltered = presets.filter(p => p.langue === form.langue)

  // ── Stats résultats ─────────────────────────────────────────────────
  const totalFound    = rawLeads.length
  const totalEnriched = rawLeads.filter(l => l.email || l.linkedin_url || l.instagram_url).length
  const totalInjected = rawLeads.filter(l => l.injecte_pipeline).length
  const totalChaud    = rawLeads.filter(l => (l.score_initial || 0) >= 71).length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🕷️ Scraper Engine <span className="text-xs font-normal text-slate-400 ml-1">v3</span></h1>
          <p className="text-xs text-slate-500 mt-0.5">Prospection automatique multi-sources & multi-canaux</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg font-medium">⚡ {totalFound} leads scrapés</span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">🔥 {totalChaud} chauds</span>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-6 pt-4 shrink-0">
        {[
          { key: 'targets', label: 'Mes cibles', icon: <IconTarget />, count: targets.length },
          { key: 'create',  label: 'Créer une cible', icon: <IconPlus /> },
          { key: 'results', label: 'Résultats', icon: <IconChart />, count: rawLeads.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white border border-b-white border-slate-200 text-slate-800 -mb-px relative z-10'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto border-t border-slate-200 bg-white">

        {/* ═══ ONGLET 1 — MES CIBLES ═══════════════════════════════ */}
        {tab === 'targets' && (
          <div className="p-6">
            {targets.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-lg font-medium text-slate-500">Aucune cible configurée</p>
                <p className="text-sm mt-1">Créez votre première cible pour démarrer le scraping automatique</p>
                <button
                  onClick={() => setTab('create')}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + Créer ma première cible
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {targets.map(target => (
                  <div key={target.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">{target.nom}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            target.langue === 'fr' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {target.langue === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            target.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {target.actif ? '● Actif' : '○ Inactif'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(target.mots_cles || []).slice(0, 4).map(kw => (
                            <span key={kw} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{kw}</span>
                          ))}
                          {(target.mots_cles || []).length > 4 && (
                            <span className="text-xs text-slate-400">+{target.mots_cles.length - 4}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>🎯 {target.nb_leads_total || 0} leads</span>
                          <span>⏱ {formatDate(target.derniere_execution)}</span>
                          <span>🔄 {FREQUENCES.find(f => f.value === target.frequence)?.label || target.frequence}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(target.canaux_actifs || []).map(c => {
                            const all = [...CANAUX_FR, ...CANAUX_EN]
                            const canal = all.find(x => x.id === c)
                            return canal ? (
                              <span key={c} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">{canal.emoji} {canal.label}</span>
                            ) : null
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle actif */}
                        <button
                          onClick={() => toggleTargetActif(target)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${target.actif ? 'bg-green-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${target.actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                        {/* Lancer */}
                        <button
                          onClick={() => launchTarget(target)}
                          disabled={launching === target.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {launching === target.id ? (
                            <span className="flex items-center gap-1"><span className="animate-spin w-3 h-3 border border-white/50 border-t-white rounded-full"/> Scraping...</span>
                          ) : (
                            <><IconPlay /> Lancer</>
                          )}
                        </button>
                        {/* Éditer sources */}
                        <button
                          onClick={() => setEditingSources(editingSources === target.id ? null : target.id)}
                          className={`p-1.5 rounded-lg transition-colors text-xs font-bold ${editingSources === target.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          title="Modifier les sources"
                        >⚙️</button>
                        {/* Supprimer */}
                        <button
                          onClick={() => deleteTarget(target)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>

                    {/* ── Panel édition sources ──────────────────────── */}
                    {editingSources === target.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-600 mb-2">⚙️ Sources actives — cliquer pour activer/désactiver :</p>
                        <div className="flex flex-wrap gap-2">
                          {(target.langue === 'fr' ? CANAUX_FR : CANAUX_EN).map(canal => {
                            const active = (target.canaux_actifs || []).includes(canal.id)
                            return (
                              <button
                                key={canal.id}
                                onClick={() => toggleTargetSource(target, canal.id)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                  active
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                                }`}
                              >
                                <span>{canal.emoji}</span>
                                <span>{canal.label}</span>
                                {active && <span className="opacity-70">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">💡 Activer "Google Places" pour obtenir des téléphones et sites web directement</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ ONGLET 2 — CRÉER UNE CIBLE ══════════════════════════ */}
        {tab === 'create' && (
          <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Nouvelle cible de scraping</h2>

            {/* Langue */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Langue du marché</label>
              <div className="flex gap-3">
                {[{ v: 'fr', label: '🇫🇷 Français — Marché FR/BE/CH/MA' }, { v: 'en', label: '🇬🇧 English — UK/USA/CA/AU' }].map(l => (
                  <button
                    key={l.v}
                    onClick={() => setForm(f => ({ ...f, langue: l.v, preset: null, mots_cles: [], canaux_actifs: ['google_places','website'], sources_actives: ['google_places'], pays: [] }))}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.langue === l.v
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset secteur */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Secteur (preset)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {presetsFiltered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className={`p-3 rounded-xl border-2 text-left text-sm transition-all ${
                      form.preset?.id === p.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{p.icone}</div>
                    <div className="font-medium text-slate-700 text-xs leading-tight">{p.nom.replace(/ FR$| EN$/, '')}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nom */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom de la cible *</label>
              <input
                type="text"
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ex : Agences immo Paris, Restaurants Lyon..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Mots-clés */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Mots-clés métier * <span className="font-normal text-slate-400 text-xs">(Entrée ou virgule pour ajouter)</span>
              </label>
              <div className="border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-400">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {form.mots_cles.map(kw => (
                    <span key={kw} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="hover:text-indigo-900 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <input
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={addKeyword}
                  placeholder="Tapez un mot-clé..."
                  className="w-full text-sm focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Zones géographiques */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Zones géographiques <span className="font-normal text-slate-400 text-xs">(codes postaux FR ou villes EN)</span>
              </label>
              <div className="border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-400">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {form.zones_geo.map(z => (
                    <span key={z} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                      {z}
                      <button onClick={() => removeZone(z)} className="hover:text-slate-900 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <input
                  value={zoneInput}
                  onChange={e => setZoneInput(e.target.value)}
                  onKeyDown={addZone}
                  placeholder={form.langue === 'fr' ? '75001, 69000, Lyon...' : 'London, Manchester, W1A 1AA...'}
                  className="w-full text-sm focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Pays */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pays cibles</label>
              <div className="flex flex-wrap gap-2">
                {(form.langue === 'fr' ? PAYS_FR : PAYS_EN).map(p => (
                  <button
                    key={p}
                    onClick={() => togglePays(p)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      form.pays.includes(p)
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Canaux */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Canaux actifs</label>
              <div className="grid gap-2">
                {canaux.map(c => (
                  <label key={c.id} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.canaux_actifs.includes(c.id)
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form.canaux_actifs.includes(c.id)}
                        onChange={() => toggleCanal(c.id)}
                        className="sr-only"
                      />
                      <span className="text-xl">{c.emoji}</span>
                      <div>
                        <div className="text-sm font-medium text-slate-700">{c.label}</div>
                        <div className={`text-xs ${c.gratuit ? 'text-green-600' : 'text-amber-600'}`}>{c.cout}</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      form.canaux_actifs.includes(c.id)
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-slate-300'
                    }`}>
                      {form.canaux_actifs.includes(c.id) && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Fréquence */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Fréquence d'exécution</label>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCES.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setForm(prev => ({ ...prev, frequence: f.value }))}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                      form.frequence === f.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimation */}
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-sm font-semibold text-slate-700 mb-2">📊 Estimation</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Leads estimés :</span> <strong className="text-slate-800">~{form.mots_cles.length * (form.zones_geo.length || 3) * 8} leads</strong></div>
                <div>
                  <span className="text-slate-500">Coût estimé :</span>{' '}
                  <strong className={form.canaux_actifs.some(c => !canaux.find(x => x.id === c)?.gratuit) ? 'text-amber-600' : 'text-green-600'}>
                    {form.canaux_actifs.some(c => !canaux.find(x => x.id === c)?.gratuit) ? '~3-15€/run' : 'Gratuit 🎉'}
                  </strong>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={createTarget}
              disabled={loading || !form.nom || form.mots_cles.length === 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full"/>Création...</>
              ) : (
                <>🚀 Créer et lancer le scraping</>
              )}
            </button>
          </div>
        )}

        {/* ═══ ONGLET 3 — RÉSULTATS ═════════════════════════════════ */}
        {tab === 'results' && (
          <div className="p-6">
            {/* Stats bandeau */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Trouvés',  value: totalFound,    color: 'bg-slate-100 text-slate-700' },
                { label: 'Enrichis', value: totalEnriched, color: 'bg-blue-50 text-blue-700' },
                { label: 'Chauds',   value: totalChaud,    color: 'bg-red-50 text-red-700' },
                { label: 'Injectés', value: totalInjected, color: 'bg-green-50 text-green-700' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="all">📍 Toutes sources</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filterScore}
                onChange={e => setFilterScore(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="all">🌡 Tous scores</option>
                <option value="chaud">🔥 Chaud (71+)</option>
                <option value="tiede">🌤 Tiède (41-70)</option>
                <option value="froid">❄️ Froid (0-40)</option>
              </select>
              <span className="text-sm text-slate-500 ml-auto">{filteredLeads.length} leads</span>
            </div>

            {/* Tableau */}
            {filteredLeads.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-4xl mb-3">📭</div>
                <p className="font-medium">Aucun lead scraped pour le moment</p>
                <p className="text-sm mt-1">Lancez une cible pour voir les résultats ici</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                  <colgroup>
                    <col style={{width:'20%'}}/>
                    <col style={{width:'12%'}}/>
                    <col style={{width:'14%'}}/>
                    <col style={{width:'12%'}}/>
                    <col style={{width:'9%'}}/>
                    <col style={{width:'9%'}}/>
                    <col style={{width:'10%'}}/>
                    <col style={{width:'14%'}}/>
                  </colgroup>
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Source</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Téléphone</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Score</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Langue</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Canaux</th>
                      <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map(lead => {
                      const badge = scoreBadge(lead.score_initial || 0)
                      return (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 overflow-hidden">
                            <div className="font-medium text-slate-800 truncate" title={lead.nom}>{lead.nom || '—'}</div>
                            <div className="text-xs text-slate-400 truncate" title={lead.ville}>{lead.ville || ''}</div>
                          </td>
                          <td className="px-3 py-2.5 overflow-hidden">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                              {lead.source === 'google_places' ? '📍' : lead.source === 'pages_jaunes' ? '📒' : lead.source === 'api_entreprises' ? '🏢' : lead.source === 'yelp' ? '⭐' : lead.source === 'companies_house' ? '🏛️' : '🌐'}
                              <span className="truncate">{lead.source || '?'}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 overflow-hidden">
                            <div className="text-xs text-slate-600 truncate">{lead.telephone || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 overflow-hidden">
                            <div className="text-xs text-slate-600 truncate" title={lead.email}>{lead.email || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${badge.cls}`}>
                              {lead.score_initial || 0}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              lead.langue === 'fr' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>{lead.langue === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                          </td>
                          <td className="px-3 py-2.5 overflow-hidden">
                            <div className="flex gap-0.5 flex-wrap">
                              {lead.email       && <span title="Email"     className="text-xs">📧</span>}
                              {lead.telephone   && <span title="Tél"       className="text-xs">📞</span>}
                              {lead.site_web    && <span title="Site web"  className="text-xs">🌐</span>}
                              {lead.linkedin_url && <span title="LinkedIn" className="text-xs">💼</span>}
                              {lead.instagram_url && <span title="Instagram" className="text-xs">📸</span>}
                              {lead.facebook_url  && <span title="Facebook"  className="text-xs">👥</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right overflow-hidden">
                            {lead.injecte_pipeline ? (
                              <span className="text-xs text-green-600 font-medium">✅ Injecté</span>
                            ) : (
                              <button
                                onClick={() => injectLead(lead)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                                title="Injecter dans le pipeline"
                              >
                                <IconInject /> Pipeline
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
