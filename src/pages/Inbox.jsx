/**
 * Inbox — Messagerie unifiée WhatsApp + Email
 * Canal temps réel via Supabase Realtime.
 * Agent IA semi-auto : suggestion de réponse qualificatrice.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7)  return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function fmtFull(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function avatar(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const CHANNEL_LABEL = { whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS' }
const CHANNEL_ICON  = { whatsapp: '💬', email: '📧', sms: '📱' }

// ═════════════════════════════════════════════════════════════════════════════
export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // ── État ──────────────────────────────────────────────────────────────────
  const [agencyId,          setAgencyId]          = useState(null)
  const [agencyName,        setAgencyName]         = useState('')
  const [twilioConfigured,  setTwilioConfigured]   = useState(null)
  const [userId,            setUserId]             = useState(null)
  const [threads,           setThreads]            = useState([])
  const [messages,          setMessages]           = useState([])
  const [activeLead,        setActiveLead]         = useState(null)
  const [loadingThreads,    setLoadingThreads]     = useState(true)
  const [loadingMessages,   setLoadingMessages]    = useState(false)
  const [sending,           setSending]            = useState(false)
  const [reply,             setReply]              = useState('')
  const [emailSubject,      setEmailSubject]       = useState('')
  const [search,            setSearch]             = useState('')
  const [filter,            setFilter]             = useState('all')     // 'all' | 'unread'
  const [channelFilter,     setChannelFilter]      = useState('all')     // 'all' | 'whatsapp' | 'email'
  const [toast,             setToast]              = useState(null)
  const [aiSuggesting,      setAiSuggesting]       = useState(false)

  const messagesEndRef = useRef(null)
  const replyRef       = useRef(null)

  const preselectedLeadId = searchParams.get('lead')

  // Canal actif dérivé du dernier message du thread
  const activeChannel = useMemo(() => {
    if (messages.length > 0) return messages[messages.length - 1].channel || 'whatsapp'
    return activeLead?.channel || 'whatsapp'
  }, [messages, activeLead])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, nom_agence')
        .eq('user_id', user.id)
        .single()

      if (profile?.nom_agence) setAgencyName(profile.nom_agence)
      const aid = profile?.agency_id
      if (aid) {
        setAgencyId(aid)
        const { data: settings } = await supabase
          .from('agency_settings')
          .select('twilio_account_sid, twilio_whatsapp_number')
          .eq('agency_id', aid)
          .maybeSingle()
        setTwilioConfigured(!!(settings?.twilio_account_sid && settings?.twilio_whatsapp_number))
      }
    }
    init()
  }, [])

  // ── Charger les threads (tous canaux) ─────────────────────────────────────
  const loadThreads = useCallback(async () => {
    if (!agencyId) return
    setLoadingThreads(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, lead_id, channel, direction, content, subject, created_at, read_at,
          thread_status, sender_name,
          leads!lead_id ( id, nom, telephone, email, adresse )
        `)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (error) { console.error('[Inbox] loadThreads:', error); return }

      // Dédupliquer : garder le dernier message par lead_id × channel
      const byLeadChannel = new Map()
      for (const msg of (data || [])) {
        const key = `${msg.lead_id}|${msg.channel}`
        if (!byLeadChannel.has(key)) byLeadChannel.set(key, msg)
      }

      // Non-lus
      const { data: unreadData } = await supabase
        .from('conversations')
        .select('lead_id, channel')
        .eq('agency_id', agencyId)
        .eq('direction', 'inbound')
        .is('read_at', null)

      const unreadByLead = {}
      for (const row of (unreadData || [])) {
        const key = row.lead_id
        unreadByLead[key] = (unreadByLead[key] || 0) + 1
      }

      const threadList = [...byLeadChannel.values()].map(msg => ({
        lead_id:       msg.lead_id,
        lead_nom:      msg.leads?.nom || `+${msg.from_number || 'Inconnu'}`,
        lead_tel:      msg.leads?.telephone || '',
        lead_email:    msg.leads?.email || '',
        channel:       msg.channel || 'whatsapp',
        last_msg:      msg.subject ? `📧 ${msg.subject}` : msg.content,
        last_ts:       msg.created_at,
        direction:     msg.direction,
        thread_status: msg.thread_status || (msg.direction === 'inbound' ? 'pending' : 'open'),
        unread:        unreadByLead[msg.lead_id] || 0,
      }))

      // Trier par date décroissante
      threadList.sort((a, b) => new Date(b.last_ts) - new Date(a.last_ts))
      setThreads(threadList)

      if (preselectedLeadId && !activeLead) {
        const found = threadList.find(t => t.lead_id === preselectedLeadId)
        if (found) selectThread(found)
      }
    } finally {
      setLoadingThreads(false)
    }
  }, [agencyId, preselectedLeadId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadThreads() }, [loadThreads])

  // ── Charger les messages du thread actif (tous canaux) ────────────────────
  const loadMessages = useCallback(async (leadId) => {
    if (!leadId || !agencyId) return
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })

      if (error) { console.error('[Inbox] loadMessages:', error); return }
      setMessages(data || [])

      // Marquer comme lus
      await supabase
        .from('conversations')
        .update({ read_at: new Date().toISOString() })
        .eq('agency_id', agencyId)
        .eq('lead_id', leadId)
        .eq('direction', 'inbound')
        .is('read_at', null)

      setThreads(prev => prev.map(t =>
        t.lead_id === leadId ? { ...t, unread: 0 } : t
      ))
    } finally {
      setLoadingMessages(false)
    }
  }, [agencyId])

  // ── Sélectionner un thread ────────────────────────────────────────────────
  const selectThread = useCallback((thread) => {
    setActiveLead(thread)
    loadMessages(thread.lead_id)
    setSearchParams(thread.lead_id ? { lead: thread.lead_id } : {})
    setReply('')
    setEmailSubject(thread.channel === 'email' ? `Re: ` : '')
    setTimeout(() => replyRef.current?.focus(), 100)
  }, [loadMessages, setSearchParams])

  // ── Scroll auto ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!agencyId) return
    const channel = supabase
      .channel(`inbox:${agencyId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'conversations', filter: `agency_id=eq.${agencyId}`,
      }, (payload) => {
        const newMsg = payload.new
        setActiveLead(prev => {
          if (prev?.lead_id === newMsg.lead_id) {
            setMessages(m => {
              if (m.some(x => x.id === newMsg.id)) return m
              return [...m, newMsg]
            })
            if (newMsg.direction === 'inbound') {
              supabase.from('conversations')
                .update({ read_at: new Date().toISOString() })
                .eq('id', newMsg.id).then(() => {})
            }
          } else if (newMsg.direction === 'inbound') {
            setThreads(prev2 => prev2.map(t =>
              t.lead_id === newMsg.lead_id
                ? { ...t, unread: t.unread + 1, last_msg: newMsg.subject ? `📧 ${newMsg.subject}` : newMsg.content, last_ts: newMsg.created_at }
                : t
            ))
          }
          return prev
        })
        loadThreads()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agencyId, loadThreads])

  // ── Envoyer un message ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!reply.trim() || !activeLead?.lead_id || sending) return
    if (activeChannel === 'email' && !emailSubject.trim()) {
      setToast({ msg: 'Objet de l\'email requis', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    setSending(true)
    const msg = reply.trim()
    setReply('')

    const tempId = `tmp-${Date.now()}`
    const tempMsg = {
      id: tempId, lead_id: activeLead.lead_id, agency_id: agencyId,
      channel: activeChannel, direction: 'outbound',
      content: msg, subject: activeChannel === 'email' ? emailSubject : undefined,
      status: 'sending', created_at: new Date().toISOString(), read_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const body = activeChannel === 'email'
        ? { action: 'send-email',    leadId: activeLead.lead_id, subject: emailSubject, message: msg }
        : { action: 'send-whatsapp', leadId: activeLead.lead_id, message: msg }

      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur envoi')

      if (data.message_id || data.conv_id) {
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, id: data.message_id || data.conv_id, status: data.status || 'sent' } : m
        ))
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        loadMessages(activeLead.lead_id)
      }

      setThreads(prev => prev.map(t =>
        t.lead_id === activeLead.lead_id
          ? { ...t, last_msg: activeChannel === 'email' ? `📧 ${emailSubject}` : msg, last_ts: new Date().toISOString(), direction: 'outbound' }
          : t
      ))
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setReply(msg)
      setToast({ msg: err.message, type: 'error' })
      setTimeout(() => setToast(null), 3500)
    } finally {
      setSending(false)
    }
  }

  // ── Suggestion IA (Agent 2 Qualificateur — mode semi-auto) ────────────────
  const handleSuggestAI = async () => {
    if (!activeLead?.lead_id || aiSuggesting) return
    setAiSuggesting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'suggest-response', leadId: activeLead.lead_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur génération IA')
      if (data.suggestion) {
        setReply(data.suggestion)
        setTimeout(() => replyRef.current?.focus(), 50)
      }
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
      setTimeout(() => setToast(null), 3500)
    } finally {
      setAiSuggesting(false)
    }
  }

  // ── Marquer conversation résolue / rouvrir ────────────────────────────────
  const markResolved = async (leadId) => {
    await supabase.from('conversations').update({ thread_status: 'resolved' })
      .eq('agency_id', agencyId).eq('lead_id', leadId)
    setThreads(prev => prev.map(t => t.lead_id === leadId ? { ...t, thread_status: 'resolved' } : t))
    setActiveLead(prev => prev ? { ...prev, thread_status: 'resolved' } : prev)
  }

  const markOpen = async (leadId) => {
    await supabase.from('conversations').update({ thread_status: 'open' })
      .eq('agency_id', agencyId).eq('lead_id', leadId)
    setThreads(prev => prev.map(t => t.lead_id === leadId ? { ...t, thread_status: 'open' } : t))
    setActiveLead(prev => prev ? { ...prev, thread_status: 'open' } : prev)
  }

  // ── Filtrer les threads ───────────────────────────────────────────────────
  const filteredThreads = threads.filter(t => {
    if (filter === 'unread' && t.unread === 0) return false
    if (channelFilter !== 'all' && t.channel !== channelFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return t.lead_nom?.toLowerCase().includes(q) || t.lead_tel?.includes(q) || t.lead_email?.includes(q)
    }
    return true
  })

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0)

  // Regrouper les messages par date (pour séparateurs)
  const groupedMessages = useMemo(() => {
    const groups = []
    let lastDate = null
    for (const msg of messages) {
      const dateStr = new Date(msg.created_at).toDateString()
      if (dateStr !== lastDate) {
        groups.push({ type: 'date', date: msg.created_at, key: `date-${msg.created_at}` })
        lastDate = dateStr
      }
      groups.push({ type: 'msg', msg, key: msg.id })
    }
    return groups
  }, [messages])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-0px)] flex overflow-hidden bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ══ SIDEBAR gauche ══════════════════════════════════════════════════ */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">

        {/* En-tête sidebar */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h1 className="text-base font-bold text-slate-800">Messagerie</h1>
              {totalUnread > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
          </div>

          {/* Onglets canaux */}
          <div className="flex gap-1 mb-2">
            {[
              { val: 'all',      label: 'Tous',      icon: '📨' },
              { val: 'whatsapp', label: 'WhatsApp',  icon: '💬' },
              { val: 'email',    label: 'Email',     icon: '📧' },
            ].map(({ val, label, icon }) => (
              <button
                key={val}
                onClick={() => setChannelFilter(val)}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                  channelFilter === val
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>

          {/* Recherche */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un contact…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {/* Filtre lu/non lu */}
          <div className="flex gap-1 mt-2">
            {[['all', 'Tous'], ['unread', 'Non lus']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  filter === val ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {label}{val === 'unread' && totalUnread > 0 && ` (${totalUnread})`}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des threads */}
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm font-medium text-slate-500">
                {search || filter === 'unread' || channelFilter !== 'all' ? 'Aucun résultat' : 'Aucune conversation'}
              </p>
              {!search && filter === 'all' && channelFilter === 'all' && (
                <p className="text-xs text-slate-400 mt-1">Les messages apparaîtront ici.</p>
              )}
            </div>
          ) : (
            filteredThreads.map(thread => {
              const isActive = activeLead?.lead_id === thread.lead_id
              const chIcon   = CHANNEL_ICON[thread.channel] || '💬'
              const isEmail  = thread.channel === 'email'
              return (
                <button
                  key={`${thread.lead_id}-${thread.channel}`}
                  onClick={() => selectThread(thread)}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors border-b border-slate-50
                    ${isActive
                      ? isEmail ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'bg-green-50 border-l-2 border-l-green-500'
                      : 'hover:bg-slate-50'
                    }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative
                    ${isActive
                      ? isEmail ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                    }`}>
                    {avatar(thread.lead_nom)}
                    <span className="absolute -bottom-0.5 -right-0.5 text-[11px] leading-none">{chIcon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${thread.unread > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {thread.lead_nom}
                      </p>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {thread.thread_status === 'pending'  && <span className="w-2 h-2 rounded-full bg-orange-400" title="Réponse requise" />}
                        {thread.thread_status === 'resolved' && <span className="w-2 h-2 rounded-full bg-slate-300" title="Résolu" />}
                        <span className="text-[10px] text-slate-400">{fmtTime(thread.last_ts)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate max-w-[140px] ${thread.unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {thread.direction === 'outbound' && <span className={`mr-1 ${isEmail ? 'text-blue-500' : 'text-green-600'}`}>Vous:</span>}
                        {thread.last_msg}
                      </p>
                      {thread.unread > 0 && (
                        <span className="bg-orange-400 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {thread.unread > 9 ? '9+' : thread.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ══ ZONE CONVERSATION droite ═════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeLead ? (
          <>
            {/* En-tête conversation */}
            <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${activeChannel === 'email' ? 'bg-blue-500' : 'bg-green-500'}`}>
                {avatar(activeLead.lead_nom)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-800">{activeLead.lead_nom}</p>
                  {/* Badge canal */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    activeChannel === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {CHANNEL_ICON[activeChannel]} {CHANNEL_LABEL[activeChannel] || activeChannel}
                  </span>
                  {/* Badge statut */}
                  {activeLead.thread_status === 'pending'  && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🔴 Réponse requise</span>}
                  {activeLead.thread_status === 'open'     && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">🟢 En cours</span>}
                  {activeLead.thread_status === 'resolved' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">✅ Résolu</span>}
                </div>
                <p className="text-xs text-slate-400">
                  {activeChannel === 'email' ? activeLead.lead_email : activeLead.lead_tel || 'WhatsApp'}
                </p>
              </div>

              {activeLead.thread_status !== 'resolved' ? (
                <button onClick={() => markResolved(activeLead.lead_id)}
                  className="text-xs font-semibold text-slate-500 hover:text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors border border-slate-200 hover:border-green-200">
                  ✓ Résolu
                </button>
              ) : (
                <button onClick={() => markOpen(activeLead.lead_id)}
                  className="text-xs font-semibold text-slate-500 hover:text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors border border-slate-200">
                  ↩ Rouvrir
                </button>
              )}

              {activeLead.lead_id && (
                <a href={`/lead/${activeLead.lead_id}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                  Fiche →
                </a>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-slate-50">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm text-slate-400">Aucun message pour l'instant.</p>
                </div>
              ) : (
                <>
                  {groupedMessages.map(item => {
                    if (item.type === 'date') {
                      return (
                        <div key={item.key} className="text-center my-3">
                          <span className="bg-slate-200 text-slate-500 text-xs px-3 py-1 rounded-full">
                            {new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )
                    }
                    const { msg } = item
                    const isOut   = msg.direction === 'outbound'
                    const isEmail = msg.channel === 'email'

                    return (
                      <div key={item.key} className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1`}>
                        {isEmail ? (
                          /* ── Email bubble ── */
                          <div className={`max-w-[75%] rounded-2xl shadow-sm border text-sm overflow-hidden
                            ${isOut ? 'bg-blue-50 border-blue-200 rounded-br-sm' : 'bg-white border-slate-200 rounded-bl-sm'}`}>
                            {msg.subject && (
                              <div className={`px-4 pt-3 pb-1.5 border-b ${isOut ? 'border-blue-200' : 'border-slate-100'}`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wide mb-0.5 ${isOut ? 'text-blue-500' : 'text-slate-400'}`}>
                                  📧 Objet
                                </p>
                                <p className="text-xs font-semibold text-slate-700">{msg.subject}</p>
                              </div>
                            )}
                            <div className="px-4 py-3">
                              <p className="leading-relaxed whitespace-pre-wrap break-words text-slate-800">{msg.content}</p>
                              {isOut && msg.sender_name && (
                                <p className="text-[10px] text-blue-400 mt-1">{msg.sender_name}</p>
                              )}
                              <p className={`text-[10px] mt-1.5 text-right ${isOut ? 'text-blue-400' : 'text-slate-400'}`}>
                                {fmtTime(msg.created_at)}
                                {isOut && <span className="ml-1">{msg.status === 'sending' ? ' ⏳' : msg.status === 'failed' ? ' ✗' : ' ✓'}</span>}
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* ── WhatsApp bubble ── */
                          <div
                            title={fmtFull(msg.created_at)}
                            className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm
                              ${isOut ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'}`}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                            {isOut && msg.sender_name && (
                              <p className="text-[10px] text-green-100 mb-0.5">{msg.sender_name}</p>
                            )}
                            <p className={`text-[10px] mt-1 text-right ${isOut ? 'text-green-100' : 'text-slate-400'}`}>
                              {fmtTime(msg.created_at)}
                              {isOut && (
                                <span className="ml-1">
                                  {msg.status === 'sending' ? ' ⏳' : msg.status === 'read' ? ' ✓✓' : msg.status === 'delivered' ? ' ✓✓' : msg.status === 'failed' ? ' ✗' : ' ✓'}
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* ── Zone de saisie ─────────────────────────────────────────── */}
            <div className="px-4 py-3 border-t border-slate-200 bg-white">
              {/* Objet email */}
              {activeChannel === 'email' && (
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Objet de l'email…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
                />
              )}

              <div className="flex items-end gap-2">
                <textarea
                  ref={replyRef}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={activeChannel === 'email' ? 'Corps de l\'email…' : 'Écrire un message… (Entrée pour envoyer)'}
                  rows={2}
                  className={`flex-1 px-4 py-2.5 text-sm border rounded-2xl resize-none focus:outline-none bg-slate-50 ${
                    activeChannel === 'email'
                      ? 'border-blue-200 focus:ring-2 focus:ring-blue-400'
                      : 'border-slate-200 focus:ring-2 focus:ring-green-400'
                  }`}
                />

                {/* Bouton suggestion IA */}
                <button
                  onClick={handleSuggestAI}
                  disabled={aiSuggesting || !activeLead?.lead_id}
                  title="Suggérer une réponse via Agent IA (mode semi-auto)"
                  className="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
                >
                  {aiSuggesting
                    ? <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    : <span className="text-base">🤖</span>
                  }
                </button>

                {/* Bouton envoyer */}
                <button
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                  title="Envoyer (Entrée)"
                  className={`w-10 h-10 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5 ${
                    activeChannel === 'email' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  }
                </button>
              </div>

              <p className="text-[10px] text-slate-400 mt-1 ml-1">
                {activeChannel === 'email'
                  ? `📧 Email · ${activeLead.lead_email || 'pas d\'adresse email'}`
                  : `💬 WhatsApp Business${agencyName ? ` · ${agencyName}` : ''}`
                }
                <span className="ml-2 text-indigo-400">· 🤖 pour suggestion IA</span>
              </p>
            </div>
          </>
        ) : (
          /* Écran vide */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
            {twilioConfigured === false ? (
              <div className="max-w-md w-full">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-5 mx-auto">
                  <span className="text-4xl">⚙️</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration WhatsApp requise</h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Pour envoyer et recevoir des messages WhatsApp, connectez votre compte Twilio dans les paramètres de messagerie.
                </p>
                <button
                  onClick={() => navigate('/settings?tab=messagerie')}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm shadow-md transition-colors mb-4"
                >
                  Configurer la messagerie WhatsApp
                </button>
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-left space-y-2.5">
                  {[
                    { n: 1, text: 'Créer un compte Twilio et activer WhatsApp' },
                    { n: 2, text: 'Coller le Account SID et Auth Token dans Paramètres → Messagerie' },
                    { n: 3, text: 'Configurer le webhook : votredomaine.com/api/webhooks/whatsapp' },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">{s.n}</span>
                      <p className="text-xs text-slate-600 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-lg font-bold text-slate-700 mb-2">Messagerie unifiée</h2>
                <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                  WhatsApp et Email centralisés. Sélectionnez une conversation pour répondre,
                  ou utilisez le bouton 🤖 pour laisser l'Agent IA suggérer une réponse qualificatrice.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
