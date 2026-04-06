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

  // ─── Onglet Messages (unifié : WhatsApp + Email + Notes) ─
  const [allMsgs,     setAllMsgs]     = useState([])
  const [waLoading,   setWaLoading]   = useState(false)
  const [waSending,   setWaSending]   = useState(false)
  const [waReply,     setWaReply]     = useState('')
  const [waUnread,    setWaUnread]    = useState(0)
  const [msgChannel,  setMsgChannel]  = useState('all') // 'all' | 'whatsapp' | 'email' | 'internal'
  const waMsgEndRef = useRef(null)

  // ─── Email composer ───────────────────────────────────────
  const [emailComposer,   setEmailComposer]   = useState(false)
  const [emailSubject,    setEmailSubject]    = useState('')
  const [emailBody,       setEmailBody]       = useState('')
  const [emailThreadId,   setEmailThreadId]   = useState(null)
  const [emailSending,    setEmailSending]    = useState(false)

  // ─── Notes internes ───────────────────────────────────────
  const [noteText,    setNoteText]    = useState('')
  const [noteSending, setNoteSending] = useState(false)

  // ─── Modal RDV ────────────────────────────────────────────
  const [rdvModal,      setRdvModal]      = useState(false)
  const [rdvDate,       setRdvDate]       = useState('')
  const [rdvTime,       setRdvTime]       = useState('09:00')
  const [rdvType,       setRdvType]       = useState('Appel découverte')
  const [rdvNotes,      setRdvNotes]      = useState('')
  const [rdvSaving,     setRdvSaving]     = useState(false)
  const [appointments,  setAppointments]  = useState([])

  // ─── Assignation équipe ───────────────────────────────────
  const [teamMembers,   setTeamMembers]   = useState([])
  const [assignSaving,  setAssignSaving]  = useState(false)

  // ─── Agent IA Auto-Contact ────────────────────────────────
  const [agentLoading,  setAgentLoading]  = useState(false)
  const [agentResult,   setAgentResult]   = useState(null)

  // ─── Chargement lead + équipe ────────────────────────────
  useEffect(() => { if (id) { loadLead(); fetchTeam() } }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Messages unifiés (tous canaux) ─────────────────────
  const fetchMessages = useCallback(async () => {
    if (!id) return
    setWaLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true })
      .limit(200)
    const msgs = data || []
    setAllMsgs(msgs)
    setWaUnread(msgs.filter(m => m.direction === 'inbound' && !m.read_at).length)
    setWaLoading(false)
    const unreadIds = msgs.filter(m => m.direction === 'inbound' && !m.read_at).map(m => m.id)
    if (unreadIds.length > 0) {
      await supabase.from('conversations').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      setWaUnread(0)
    }
  }, [id])

  // ─── Charger les RDVs ────────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', id)
      .order('scheduled_at', { ascending: true })
    setAppointments(data || [])
  }, [id])

  // ─── Charger les membres de l'équipe ─────────────────────
  const fetchTeam = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: myProfile } = await supabase.from('profiles').select('agency_id').eq('user_id', user.id).single()
    if (!myProfile?.agency_id) return
    const { data } = await supabase
      .from('profiles')
      .select('user_id, nom_complet, email, role')
      .eq('agency_id', myProfile.agency_id)
    setTeamMembers(data || [])
  }, [])

  const fetchWaMessages = fetchMessages // alias de compat

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
        setAllMsgs(prev => {
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
    if (activeTab === 'messages') {
      waMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [allMsgs, activeTab])

  const sendWaMessage = async () => {
    if (!waReply.trim() || waSending) return
    const text = waReply.trim()
    setWaReply('')
    setWaSending(true)
    const tempId = `tmp-${Date.now()}`
    setAllMsgs(prev => [...prev, {
      id: tempId, lead_id: id, direction: 'outbound', channel: 'whatsapp',
      content: text, status: 'sending', created_at: new Date().toISOString(), read_at: new Date().toISOString(),
    }])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ leadId: id, message: text }),
      })
      const resData = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(resData.error || 'Erreur envoi')
      setAllMsgs(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: resData.message_id || tempId, status: resData.status || 'sent' } : m
      ))
    } catch (err) {
      setAllMsgs(prev => prev.filter(m => m.id !== tempId))
      setWaReply(text)
      alert(`❌ ${err.message}`)
    } finally {
      setWaSending(false)
    }
  }

  // ─── Envoyer email ────────────────────────────────────────
  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim() || emailSending) return
    setEmailSending(true)
    const tempId = `tmp-email-${Date.now()}`
    setAllMsgs(prev => [...prev, {
      id: tempId, lead_id: id, direction: 'outbound', channel: 'email',
      subject: emailSubject.trim(), content: emailBody.trim(),
      status: 'sending', created_at: new Date().toISOString(), read_at: new Date().toISOString(),
    }])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ leadId: id, subject: emailSubject.trim(), message: emailBody.trim(), replyToThreadId: emailThreadId }),
      })
      const resData = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(resData.error || 'Erreur envoi email')
      setAllMsgs(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: resData.message_id || tempId, status: 'sent', email_thread_id: resData.thread_id } : m
      ))
      setEmailThreadId(resData.thread_id)
      setEmailComposer(false)
      setEmailBody('')
      logCrm('email', 'Email envoyé', emailSubject.trim())
    } catch (err) {
      setAllMsgs(prev => prev.filter(m => m.id !== tempId))
      alert(`❌ ${err.message}`)
    } finally {
      setEmailSending(false)
    }
  }

  // ─── Envoyer note interne ─────────────────────────────────
  const sendNote = async () => {
    if (!noteText.trim() || noteSending) return
    setNoteSending(true)
    const text = noteText.trim()
    setNoteText('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('nom_complet, agency_id').eq('user_id', user.id).single()
      const { data: conv, error: convErr } = await supabase.from('conversations').insert({
        lead_id:     id,
        agency_id:   profile?.agency_id,
        channel:     'whatsapp',
        direction:   'internal',
        content:     text,
        status:      'delivered',
        sender_name: profile?.nom_complet || 'Agent',
        read_at:     new Date().toISOString(),
      }).select().single()
      if (convErr) throw new Error(convErr.message)
      setAllMsgs(prev => [...prev, conv])
    } catch (err) {
      setNoteText(text)
      alert(`❌ ${err.message}`)
    } finally {
      setNoteSending(false)
    }
  }

  // ─── Créer un RDV ─────────────────────────────────────────
  const createRdv = async () => {
    if (!rdvDate || !rdvTime || rdvSaving) return
    setRdvSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const scheduledAt = new Date(`${rdvDate}T${rdvTime}`).toISOString()
      const res = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ leadId: id, scheduledAt, type: rdvType, notes: rdvNotes }),
      })
      const resData = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(resData.error || 'Erreur création RDV')
      setAppointments(prev => [...prev, resData.appointment])
      setRdvModal(false)
      setRdvDate(''); setRdvTime('09:00'); setRdvNotes('')
      logCrm('rdv', 'RDV créé', `${rdvType} le ${new Date(scheduledAt).toLocaleDateString('fr-FR')} à ${rdvTime}`)
      const { data: updated } = await supabase.from('leads').select('*').eq('id', id).single()
      if (updated) setLead(updated)
    } catch (err) {
      alert(`❌ ${err.message}`)
    } finally {
      setRdvSaving(false)
    }
  }

  // ─── Assigner le lead ─────────────────────────────────────
  const assignLead = async (userId) => {
    setAssignSaving(true)
    try {
      await supabase.from('leads').update({ assigned_to: userId || null }).eq('id', id)
      setLead(prev => ({ ...prev, assigned_to: userId || null }))
      logCrm('edit', 'Lead assigné', userId
        ? `Assigné à ${teamMembers.find(m => m.user_id === userId)?.nom_complet || 'un membre'}`
        : 'Désassigné')
    } finally {
      setAssignSaving(false)
    }
  }

  // ─── Agent IA : déclencher l'auto-contact ────────────────
  const triggerAgent = async () => {
    if (agentLoading) return
    if (!window.confirm('Envoyer un message WhatsApp généré par l\'agent IA à ce lead ?')) return
    setAgentLoading(true)
    setAgentResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/agents/auto-contact', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ leadId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erreur agent')
      setAgentResult(data)
      // Si envoyé → recharger les messages + le lead
      if (data.success) {
        fetchWaMessages()
        const { data: updated } = await supabase.from('leads').select('*').eq('id', id).single()
        if (updated) setLead(updated)
      }
    } catch (err) {
      setAgentResult({ error: err.message })
    } finally {
      setAgentLoading(false)
    }
  }

  // ─── Changer onglet ──────────────────────────────────────
  const switchTab = (key) => {
    setActiveTab(key)
    if (key === 'historique' && crmHistory.length === 0) fetchHistory()
    if (key === 'ia' && !aiSuggestion) fetchAI()
    if (key === 'messages') {
      fetchMessages()
      fetchAppointments()
      fetchTeam()
    }
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
    <>
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
              onClick={() => { fetchTeam(); setRdvModal(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100
                         text-purple-600 rounded-lg text-xs font-semibold transition-colors border border-purple-100"
              title="Créer un RDV natif"
            >
              <IconCalendar /><span className="hidden sm:inline">RDV</span>
            </button>
            {/* Assignation rapide */}
            <select
              value={lead.assigned_to || ''}
              onChange={e => assignLead(e.target.value || null)}
              disabled={assignSaving}
              className="hidden lg:block text-xs border border-slate-200 rounded-lg px-2 py-1.5
                         bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300
                         max-w-[130px] truncate disabled:opacity-50"
              title="Assigner ce lead"
            >
              <option value="">— Non assigné</option>
              {teamMembers.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.nom_complet || m.email}</option>
              ))}
            </select>
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
          { key: 'messages',   label: `💬 Messages${waUnread > 0 ? ` (${waUnread})` : ''}${lead?.auto_contacted_at ? ' 🤖' : ''}` },
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

        {/* ═══ ONGLET MESSAGES (unifié) ══════════════════ */}
        {activeTab === 'messages' && (() => {
          // Filtrer selon canal sélectionné
          const visibleMsgs = allMsgs.filter(m => {
            if (msgChannel === 'all') return true
            if (msgChannel === 'whatsapp') return m.channel === 'whatsapp' && m.direction !== 'internal'
            if (msgChannel === 'email')    return m.channel === 'email'
            if (msgChannel === 'internal') return m.direction === 'internal'
            return true
          })

          return (
          <div className="max-w-2xl mx-auto flex flex-col gap-3" style={{ minHeight: '500px' }}>

            {/* ── RDVs à venir ── */}
            {appointments.filter(a => a.status === 'confirmed' && new Date(a.scheduled_at) > new Date()).length > 0 && (
              <div className="flex-none flex gap-2 overflow-x-auto pb-1">
                {appointments
                  .filter(a => a.status === 'confirmed' && new Date(a.scheduled_at) > new Date())
                  .map(a => (
                    <div key={a.id} className="shrink-0 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                      <span className="text-sm">📅</span>
                      <div>
                        <p className="text-xs font-semibold text-purple-800">{a.type}</p>
                        <p className="text-[10px] text-purple-600">
                          {new Date(a.scheduled_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })} à{' '}
                          {new Date(a.scheduled_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* ── Switcher canal ── */}
            <div className="flex-none flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              {[
                { key: 'all',      label: '💬 Tous',      count: allMsgs.length },
                { key: 'whatsapp', label: '🟢 WhatsApp',  count: allMsgs.filter(m => m.channel === 'whatsapp' && m.direction !== 'internal').length },
                { key: 'email',    label: '📧 Email',     count: allMsgs.filter(m => m.channel === 'email').length },
                { key: 'internal', label: '🔒 Notes',     count: allMsgs.filter(m => m.direction === 'internal').length },
              ].map(ch => (
                <button key={ch.key}
                  onClick={() => setMsgChannel(ch.key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    msgChannel === ch.key
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {ch.label}
                  {ch.count > 0 && (
                    <span className={`text-[10px] px-1 rounded-full ${msgChannel === ch.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {ch.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Fil de messages ── */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-2" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {waLoading && (
                <div className="text-center text-slate-400 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2" />
                  <p className="text-sm">Chargement…</p>
                </div>
              )}
              {!waLoading && visibleMsgs.length === 0 && (
                <div className="text-center text-slate-400 py-12">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-sm font-medium">Aucun message</p>
                  <p className="text-xs mt-1">Les échanges avec ce lead apparaîtront ici.</p>
                </div>
              )}

              {visibleMsgs.map((msg) => {
                const isInternal = msg.direction === 'internal'
                const isOut      = msg.direction === 'outbound'
                const isEmail    = msg.channel === 'email'
                const isAgent    = msg.sender_name?.includes('Agent IA') || msg.sender_name?.startsWith('🤖')
                const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                const day  = new Date(msg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

                // ── Note interne (fond jaune centré) ──
                if (isInternal) return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="max-w-[85%] bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">🔒</span>
                        <span className="text-xs font-semibold text-yellow-800">{msg.sender_name || 'Note interne'}</span>
                        <span className="text-[10px] text-yellow-500 ml-auto">{day} {time}</span>
                      </div>
                      <p className="text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </div>
                )

                // ── Email ──
                if (isEmail) return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl shadow-sm border text-sm ${
                      isOut ? 'bg-blue-600 text-white border-blue-700 rounded-br-sm' : 'bg-white border-slate-200 rounded-bl-sm'
                    }`}>
                      <div className={`px-4 pt-3 pb-1 border-b ${isOut ? 'border-blue-500' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs opacity-80">📧</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isOut ? 'text-blue-100' : 'text-slate-400'}`}>Email</span>
                        </div>
                        <p className={`text-xs font-bold truncate ${isOut ? 'text-white' : 'text-slate-800'}`}>{msg.subject || '(sans objet)'}</p>
                      </div>
                      <div className="px-4 py-2.5">
                        <p className={`leading-relaxed whitespace-pre-wrap break-words ${isOut ? 'text-white' : 'text-slate-700'}`}>{msg.content}</p>
                        <div className={`flex items-center justify-between mt-2 ${isOut ? 'text-blue-200' : 'text-slate-400'}`}>
                          <p className="text-[10px]">{day} {time}</p>
                          {!isOut && (
                            <button
                              onClick={() => {
                                setEmailComposer(true)
                                setEmailSubject(`Re: ${msg.subject || ''}`)
                                setEmailThreadId(msg.email_thread_id)
                                setMsgChannel('email')
                              }}
                              className="text-[10px] underline hover:text-indigo-600 transition-colors"
                            >
                              ↩ Répondre
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )

                // ── WhatsApp (normal ou agent IA) ──
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className="flex flex-col gap-0.5 max-w-[75%]">
                      {isAgent && isOut && (
                        <p className="text-[10px] text-indigo-500 font-medium text-right mr-1">🤖 Agent IA</p>
                      )}
                      {!isOut && msg.sender_name && (
                        <p className="text-[10px] text-slate-400 font-medium ml-1">{msg.sender_name}</p>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        isOut
                          ? isAgent
                            ? 'bg-indigo-500 text-white rounded-br-sm'
                            : 'bg-green-500 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isOut ? 'text-white/60' : 'text-slate-400'} text-right`}>
                          {day} {time}
                          {isOut && <span className="ml-1">{msg.status === 'delivered' || msg.status === 'sent' ? ' ✓✓' : msg.status === 'sending' ? ' ⏳' : ' ✓'}</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={waMsgEndRef} />
            </div>

            {/* ── Agent IA banner ── */}
            {(msgChannel === 'all' || msgChannel === 'whatsapp') && (
              <div className="flex-none">
                {lead?.auto_contacted_at ? (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
                    <span className="text-sm">🤖</span>
                    <p className="text-xs text-indigo-700">
                      <strong>Auto-contact</strong> le{' '}
                      {new Date(lead.auto_contacted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </p>
                    <button onClick={async () => {
                      if (!window.confirm('Réinitialiser le statut auto-contact ?')) return
                      await supabase.from('leads').update({ auto_contacted_at: null }).eq('id', id)
                      const { data: u } = await supabase.from('leads').select('*').eq('id', id).single()
                      if (u) setLead(u)
                    }} className="ml-auto text-[10px] text-indigo-400 hover:text-indigo-600 underline">Réinitialiser</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button onClick={triggerAgent} disabled={agentLoading || lead?.do_not_contact}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100
                                 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-700
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {agentLoading ? <><span className="animate-spin">⏳</span> Génération…</> : <>🤖 Contacter par l'agent IA</>}
                    </button>
                    {agentResult && (
                      <div className={`text-xs px-3 py-1.5 rounded-lg ${
                        agentResult.success ? 'bg-green-50 text-green-700 border border-green-200' :
                        agentResult.skipped ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                                              'bg-red-50 text-red-600 border border-red-200'}`}>
                        {agentResult.success && `✅ "${agentResult.message_sent?.slice(0,80)}…"`}
                        {agentResult.skipped && `⏭ ${agentResult.reason}`}
                        {agentResult.error   && `❌ ${agentResult.error}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Composer Email (si canal email ou ouvert manuellement) ── */}
            {emailComposer && (
              <div className="flex-none bg-white rounded-xl border border-blue-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-blue-700">📧 Nouvel email</p>
                  <button onClick={() => setEmailComposer(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                </div>
                {!lead.email && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Ce lead n'a pas d'email enregistré.
                  </p>
                )}
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Objet de l'email…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <textarea
                  rows={4}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Corps de l'email…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEmailComposer(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200">
                    Annuler
                  </button>
                  <button onClick={sendEmail}
                    disabled={!emailSubject.trim() || !emailBody.trim() || emailSending || !lead.email}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {emailSending ? '⏳ Envoi…' : '📧 Envoyer'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Zone de saisie bas de page ── */}
            <div className="flex-none space-y-2">

              {/* WhatsApp composer */}
              {(msgChannel === 'all' || msgChannel === 'whatsapp') && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
                  {lead.telephone ? (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className="text-xs">🟢</span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">WhatsApp</span>
                        </div>
                        <textarea
                          value={waReply}
                          onChange={e => setWaReply(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendWaMessage() } }}
                          placeholder="Message WhatsApp… (Entrée pour envoyer, Maj+Entrée pour saut)"
                          rows={2}
                          disabled={waSending}
                          className="w-full resize-none text-sm border border-slate-200 rounded-xl px-3 py-2
                                     focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                        />
                      </div>
                      <button onClick={sendWaMessage} disabled={!waReply.trim() || waSending}
                        className="shrink-0 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
                        {waSending ? '⏳' : '➤'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 text-center py-1">⚠️ Pas de numéro de téléphone</p>
                  )}
                </div>
              )}

              {/* Email + Note boutons */}
              <div className="flex gap-2">
                {(msgChannel === 'all' || msgChannel === 'email') && (
                  <button onClick={() => { setEmailComposer(true); setMsgChannel('email') }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100
                               border border-blue-200 rounded-xl text-xs font-semibold text-blue-700 transition-colors">
                    📧 Nouveau email
                  </button>
                )}
                <button
                  onClick={() => {
                    const note = window.prompt('Note interne (visible uniquement par l\'équipe) :')
                    if (note?.trim()) { setNoteText(note.trim()); setTimeout(sendNote, 0) }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-yellow-50 hover:bg-yellow-100
                             border border-yellow-300 rounded-xl text-xs font-semibold text-yellow-700 transition-colors">
                  🔒 Note interne
                </button>
              </div>

            </div>
          </div>
          )
        })()}

      </main>
    </div>

    {/* ═══ MODAL RDV ══════════════════════════════════════ */}
    {rdvModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header modal */}
          <div className="bg-purple-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="text-lg">📅</span>
              <span className="font-bold text-base">Planifier un RDV</span>
            </div>
            <button onClick={() => setRdvModal(false)} className="text-white/80 hover:text-white text-xl">✕</button>
          </div>

          <div className="p-6 space-y-4">
            {/* Lead recap */}
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">{lead.nom}</p>
              {lead.email    && <p className="text-xs text-slate-500">{lead.email}</p>}
              {lead.telephone && <p className="text-xs text-slate-500">{lead.telephone}</p>}
            </div>

            {/* Type de RDV */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Type de RDV</label>
              <select value={rdvType} onChange={e => setRdvType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300">
                {['Appel découverte','Démo','Suivi','Autre'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Date + Heure */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Date</label>
                <input type="date" value={rdvDate} onChange={e => setRdvDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Heure</label>
                <select value={rdvTime} onChange={e => setRdvTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {Array.from({ length: 19 }, (_, i) => {
                    const h = Math.floor(i / 2) + 9
                    const m = i % 2 === 0 ? '00' : '30'
                    return `${String(h).padStart(2,'0')}:${m}`
                  }).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Notes (optionnel)</label>
              <textarea rows={2} value={rdvNotes} onChange={e => setRdvNotes(e.target.value)}
                placeholder="Informations complémentaires, lien Zoom, etc."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
            </div>

            {/* Confirmations automatiques */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">Confirmations automatiques :</p>
              <div className="space-y-0.5 text-xs text-purple-600">
                {lead.telephone && <p>✅ WhatsApp envoyé à {lead.telephone}</p>}
                {lead.email    && <p>✅ Email envoyé à {lead.email}</p>}
                {!lead.telephone && !lead.email && <p>⚠️ Aucun contact disponible</p>}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setRdvModal(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-semibold">
                Annuler
              </button>
              <button onClick={createRdv} disabled={!rdvDate || rdvSaving}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {rdvSaving ? '⏳ Création…' : '📅 Confirmer le RDV'}
              </button>
            </div>
          </div>
        </div>
      </div>
   )}
    </>         ← AJOUTER CETTE LIGNE
  )
}

export default LeadDetails
