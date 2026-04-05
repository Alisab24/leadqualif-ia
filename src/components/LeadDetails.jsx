/**
 * LeadDetails — Fiche complète d'un lead
 * Design unifié avec le Dashboard (slate palette)
 * Route : /lead/:id  |  Rendu dans <Layout>
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import { aiService } from '../services/ai'
import DocumentGenerator from './DocumentGenerator'
import { tPipelineLabel, tScore } from '../i18n'

/* ─── Helpers WhatsApp ────────────────────────────────────── */
const toWAPhone = (raw = '') => {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  return (d.startsWith('0') && d.length === 10) ? '33' + d.substring(1) : d;
};
const buildWAUrl = (phone) => {
  const p = toWAPhone(phone);
  return p ? `https://web.whatsapp.com/send?phone=${p}` : null;
};
const IconWA = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const IconPhone = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17">
    <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd"/>
  </svg>
);
const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17">
    <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/>
    <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>
  </svg>
);
const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17">
    <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd"/>
  </svg>
);

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
  if (s >= 70) return { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: tScore(s) }
  if (s >= 40) return { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: tScore(s) }
  return         { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-800',    label: tScore(s) }
}

const QUALIFICATION_COLOR = {
  chaud:    'bg-green-100  text-green-800  border-green-200',
  tiede:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  froid:    'bg-red-100    text-red-800    border-red-200',
  CHAUD:    'bg-green-100  text-green-800  border-green-200',
  TIEDE:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  FROID:    'bg-red-100    text-red-800    border-red-200',
  // Variants avec accent (DB peut stocker 'TIÈDE' ou 'tiède')
  'tiède':  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'TIÈDE':  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Tiède':  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Chaud':  'bg-green-100  text-green-800  border-green-200',
  'Froid':  'bg-red-100    text-red-800    border-red-200',
}

/** Recommandation dynamique selon le score réel du lead */
const getSmartRecommendation = (lead) => {
  const score = lead.score || lead.score_ia || lead.score_qualification || 0
  const niveau = (lead.niveau_interet || '').toUpperCase()
  const statut = lead.statut || ''
  if (statut === 'Gagné') return '✅ Client signé. Préparer le onboarding et le premier rapport de performance.'
  if (statut === 'Perdu') return '❌ Lead perdu. Analyser la raison pour améliorer le processus commercial.'
  if (statut === 'Devis envoyé') return '📄 Devis envoyé. Relancer sous 48h si pas de réponse. Proposer un appel de clarification.'
  if (statut === 'Négociation') return '🤝 En négociation. Rester disponible, proposer un ajustement de l\'offre si besoin.'
  if (score >= 80 || niveau === 'CHAUD') return '🔥 Lead très chaud. Contacter immédiatement — intention claire. Proposer un appel ou une démo aujourd\'hui.'
  if (score >= 65) return '🟢 Lead chaud. Contacter dans les 24h. Envoyer un devis personnalisé.'
  if (score >= 45 || niveau === 'TIÈDE' || niveau === 'TIEDE') return '🟡 Lead tiède. Contacter sous 48h. Nourrir avec des témoignages ou une étude de cas pertinente.'
  if (score >= 25) return '🟠 Lead froid mais qualifiable. Relancer avec un email de présentation.'
  return '❄️ Lead froid ou peu qualifié. Ajouter au suivi longue durée et automatiser les relances.'
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
  const { t } = useTranslation()

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

  // ─── Onglet Messages WhatsApp ─────────────────────────────
  const [waMsgs,      setWaMsgs]      = useState([])
  const [waLoading,   setWaLoading]   = useState(false)
  const [waSending,   setWaSending]   = useState(false)
  const [waReply,     setWaReply]     = useState('')
  const [waUnread,    setWaUnread]    = useState(0)
  const waMsgEndRef = useRef(null)

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

      // profil agence — requête sur user_id pour obtenir le profil exact du propriétaire
      if (data.agency_id) {
        const { data: prof } = await supabase
          .from('profiles').select('*').eq('user_id', data.agency_id).single()
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
      const scoreLabel = result?.score_qualification ?? result?.score ?? lead.score ?? lead.score_ia ?? 0
      const niveau = result?.niveau_interet_final || result?.niveau_interet || evaluation?.niveau_interet || 'FROID'
      const resume = result?.resume || evaluation?.raison_classification || ''
      // Recommandation dynamique basée sur le score IA réel
      const enrichedLead = { ...lead, score: scoreLabel, score_ia: scoreLabel, niveau_interet: niveau }
      const smartRec = getSmartRecommendation(enrichedLead)
      const suggestion = resume ? `${smartRec}\n\n📝 Analyse IA : ${resume}` : smartRec

      setAiSuggestion(suggestion)
      await supabase.from('leads').update({
        resume_ia: resume || smartRec,
        suggestion_ia: smartRec,
        score_qualification: scoreLabel,
        score: scoreLabel,
        niveau_interet: niveau,
      }).eq('id', id)
    } catch (err) {
      console.error('fetchAI error:', err)
      setAiSuggestion(getSmartRecommendation(lead))
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

  // ─── Messages WhatsApp ───────────────────────────────────
  const fetchWaMessages = useCallback(async () => {
    if (!id) return
    setWaLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true })
      .limit(100)
    const msgs = data || []
    setWaMsgs(msgs)
    setWaUnread(msgs.filter(m => m.direction === 'inbound' && !m.read_at).length)
    setWaLoading(false)
    // Marquer les entrants comme lus
    const unreadIds = msgs.filter(m => m.direction === 'inbound' && !m.read_at).map(m => m.id)
    if (unreadIds.length > 0) {
      await supabase.from('conversations').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      setWaUnread(0)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    // Subscription Realtime pour les nouveaux messages
    const channel = supabase.channel(`wa-lead-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `lead_id=eq.${id}`,
      }, (payload) => {
        setWaMsgs(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        if (payload.new.direction === 'inbound') {
          if (activeTab === 'messages') {
            // Auto-read
            supabase.from('conversations').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id)
          } else {
            setWaUnread(n => n + 1)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, activeTab])

  useEffect(() => {
    // Scroll vers le bas quand les messages changent
    if (activeTab === 'messages') {
      waMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [waMsgs, activeTab])

  const sendWaMessage = async () => {
    if (!waReply.trim() || waSending) return
    const text = waReply.trim()
    setWaReply('')
    setWaSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ leadId: id, message: text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur envoi')
      }
    } catch (err) {
      alert(`❌ ${err.message}`)
      setWaReply(text) // Restaurer le texte
    } finally {
      setWaSending(false)
    }
  }

  // ─── Changer onglet ──────────────────────────────────────
  const switchTab = (key) => {
    setActiveTab(key)
    if (key === 'historique' && crmHistory.length === 0) fetchHistory()
    if (key === 'ia' && !aiSuggestion) fetchAI()
    if (key === 'messages') fetchWaMessages()
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

  // Même logique que Dashboard.getScoreBadge — score_qualification → score_ia → score
  const score   = lead.score_qualification || lead.score_ia || lead.score || 0
  const rawNiveau = (lead.niveau_interet || '').toLowerCase()
    .replace('tiède', 'tiede').replace('tièd', 'tiede')
  const VALID_N = ['chaud', 'tiede', 'froid']
  const effectiveNiveau = (VALID_N.includes(rawNiveau) ? rawNiveau : null) || (score >= 70 ? 'chaud' : score >= 40 ? 'tiede' : 'froid')
  const ss = effectiveNiveau === 'chaud'
    ? { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  label: tScore(100) }
    : effectiveNiveau === 'tiede'
    ? { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: tScore(50) }
    : { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-800',    label: tScore(0) }
  // Normaliser pour trouver la couleur : 'TIÈDE' → 'tiede', 'CHAUD' → 'chaud', etc.
  const niveauNorm = (lead.niveau_interet || '').toLowerCase()
    .replace('tiède', 'tiede').replace('tièd', 'tiede')
  const qualCls = QUALIFICATION_COLOR[niveauNorm] || QUALIFICATION_COLOR[lead.niveau_interet] || 'bg-slate-100 text-slate-700 border-slate-200'
  const agencyId = agencyProfile?.agency_id || agencyProfile?.id
  const agencyType = agencyProfile?.type_agence || null

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
            {lead.telephone && (
              <button
                onClick={() => {
                  const url = buildWAUrl(lead.telephone);
                  if (url) window.open(url, '_blank');
                  logCrm('whatsapp', 'Message WhatsApp envoyé');
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100
                           text-green-700 rounded-lg text-xs font-semibold transition-colors border border-green-100"
                title={`WhatsApp · ${lead.telephone}`}
              >
                <IconWA /><span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}
            <button
              onClick={() => {
                window.open(`tel:${lead.telephone}`, '_blank');
                logCrm('call', 'Appel téléphonique');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100
                         text-blue-600 rounded-lg text-xs font-semibold transition-colors border border-blue-100"
              title="Appeler"
            >
              <IconPhone /><span className="hidden sm:inline">Appeler</span>
            </button>
            <button
              onClick={() => {
                window.open(`mailto:${lead.email}`, '_blank');
                logCrm('email', 'Email envoyé');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100
                         text-orange-600 rounded-lg text-xs font-semibold transition-colors border border-orange-100"
              title="Email"
            >
              <IconMail /><span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => {
                const url = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com';
                window.open(url, '_blank');
                logCrm('rdv', 'RDV proposé via Calendly');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100
                         text-purple-600 rounded-lg text-xs font-semibold transition-colors border border-purple-100"
              title="Proposer un RDV"
            >
              <IconCalendar /><span className="hidden sm:inline">RDV</span>
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
          { key: 'messages',   label: `💬 Messages${waUnread > 0 ? ` (${waUnread})` : ''}` },
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

            {/* Recommandation IA — dynamique par score, ou résultat du bouton Analyser */}
            {(() => {
              const GENERIC_FROID = 'Ajouter à la liste de suivi longue durée. Peut devenir intéressant plus tard.'
              const stored = typeof lead.suggestion_ia === 'string' ? lead.suggestion_ia.trim() : ''
              const isGeneric = !stored || stored === GENERIC_FROID
              const displayRec = (typeof aiSuggestion === 'string' && aiSuggestion.trim())
                || (!isGeneric ? stored : null)
                || getSmartRecommendation(lead)
              const isLive = typeof aiSuggestion === 'string' && aiSuggestion.trim()
              const score = lead.score || lead.score_ia || lead.score_qualification || 0
              return (
                <section className={`border rounded-xl p-5 ${isLive ? 'bg-purple-50 border-purple-200' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-bold uppercase tracking-wide ${isLive ? 'text-purple-700' : 'text-indigo-700'}`}>
                      💡 Recommandation IA
                    </p>
                    {!isLive && (
                      <span className="text-xs text-indigo-400 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                        Score {score}/100
                      </span>
                    )}
                  </div>
                  {(() => {
                    const parts = displayRec.split('\n\n📝 Analyse IA : ')
                    return (
                      <>
                        <p className={`text-sm leading-relaxed font-medium ${isLive ? 'text-purple-800' : 'text-indigo-800'}`}>{parts[0]}</p>
                        {parts[1] && (
                          <p className={`text-xs mt-3 leading-relaxed opacity-80 ${isLive ? 'text-purple-700' : 'text-indigo-700'}`}>
                            📝 {parts[1]}
                          </p>
                        )}
                      </>
                    )
                  })()}
                </section>
              )
            })()}

            {/* Résumé IA distinct — affiché seulement s'il apporte du contenu nouveau */}
            {typeof lead.resume_ia === 'string' && lead.resume_ia.trim() &&
              !aiSuggestion && lead.resume_ia !== lead.suggestion_ia && (
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

        {/* ═══ ONGLET MESSAGES WHATSAPP ══════════════════ */}
        {activeTab === 'messages' && (
          <div className="max-w-2xl mx-auto flex flex-col h-full" style={{ minHeight: '500px' }}>
            {/* Thread */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3 space-y-2">
              {waLoading && (
                <div className="text-center text-slate-400 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2" />
                  <p className="text-sm">Chargement des messages…</p>
                </div>
              )}
              {!waLoading && waMsgs.length === 0 && (
                <div className="text-center text-slate-400 py-12">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-sm font-medium">Aucun message WhatsApp</p>
                  <p className="text-xs mt-1">Les messages échangés avec ce lead apparaîtront ici.</p>
                </div>
              )}
              {waMsgs.map((msg) => {
                const isOut = msg.direction === 'outbound'
                const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                const day  = new Date(msg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                      isOut
                        ? 'bg-green-500 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${isOut ? 'text-green-100' : 'text-slate-400'} text-right`}>
                        {day} {time}
                        {isOut && (
                          <span className="ml-1">
                            {msg.status === 'delivered' || msg.status === 'sent' ? ' ✓✓' : ' ✓'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={waMsgEndRef} />
            </div>

            {/* Zone de saisie */}
            {lead.telephone ? (
              <div className="flex-none bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-end gap-2">
                <textarea
                  value={waReply}
                  onChange={e => setWaReply(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendWaMessage()
                    }
                  }}
                  placeholder="Écrire un message WhatsApp… (Entrée pour envoyer)"
                  rows={2}
                  disabled={waSending}
                  className="flex-1 resize-none text-sm border border-slate-200 rounded-xl px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                />
                <button
                  onClick={sendWaMessage}
                  disabled={!waReply.trim() || waSending}
                  className="shrink-0 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white
                             rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  {waSending ? '⏳' : '➤'}
                </button>
              </div>
            ) : (
              <div className="flex-none bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-sm text-amber-700">
                  ⚠️ Ce lead n'a pas de numéro de téléphone. Ajoutez-en un pour envoyer des messages WhatsApp.
                </p>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}

export default LeadDetails
