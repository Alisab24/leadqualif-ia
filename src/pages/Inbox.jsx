/**
 * Inbox — Messagerie WhatsApp bidirectionnelle
 *
 * Liste des conversations + fil de messages en temps réel via Supabase Realtime.
 * Envoi via /api/whatsapp/send.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
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

// ═════════════════════════════════════════════════════════════════════════════
export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // ── État ──────────────────────────────────────────────────────────────────
  const [agencyId,        setAgencyId]        = useState(null)
  const [twilioConfigured, setTwilioConfigured] = useState(null) // null=loading, false=non configuré, true=ok
  const [userId,          setUserId]          = useState(null)
  const [threads,         setThreads]         = useState([])   // résumé par lead
  const [messages,        setMessages]        = useState([])   // messages du thread actif
  const [activeLead,      setActiveLead]      = useState(null) // lead sélectionné
  const [loadingThreads,  setLoadingThreads]  = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending,         setSending]         = useState(false)
  const [reply,           setReply]           = useState('')
  const [search,          setSearch]          = useState('')
  const [filter,          setFilter]          = useState('all') // 'all' | 'unread'
  const [toast,           setToast]           = useState(null)

  const messagesEndRef = useRef(null)
  const replyRef       = useRef(null)

  // Lead pré-sélectionné via ?lead=UUID
  const preselectedLeadId = searchParams.get('lead')

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', user.id)
        .single()

      const aid = profile?.agency_id
      if (aid) {
        setAgencyId(aid)
        // Vérifier si Twilio est configuré (agency_settings OU vars globales Vercel)
        const { data: settings } = await supabase
          .from('agency_settings')
          .select('twilio_account_sid, twilio_whatsapp_number')
          .eq('agency_id', aid)
          .maybeSingle()

        const hasLocalConfig = !!(settings?.twilio_account_sid && settings?.twilio_whatsapp_number)
        // On considère aussi configuré si les vars Vercel globales sont présentes
        // (on ne peut pas les lire côté client, donc on essaie de charger les threads
        //  et si ça marche c'est que c'est ok — mais on se fie à agency_settings pour l'UX)
        setTwilioConfigured(hasLocalConfig)
      }
    }
    init()
  }, [])

  // ── Charger les threads (dernier message par lead) ────────────────────────
  const loadThreads = useCallback(async () => {
    if (!agencyId) return
    setLoadingThreads(true)
    try {
      // Récupérer la dernière conversation par lead_id
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, lead_id, direction, content, created_at, read_at,
          leads!lead_id ( id, nom, telephone, adresse )
        `)
        .eq('agency_id', agencyId)
        .eq('channel', 'whatsapp')
        .order('created_at', { ascending: false })

      if (error) { console.error('[Inbox] loadThreads:', error); return }

      // Dédupliquer : garder seulement le dernier message par lead_id
      const byLead = new Map()
      for (const msg of (data || [])) {
        const key = msg.lead_id || msg.id
        if (!byLead.has(key)) byLead.set(key, msg)
      }

      // Calculer les non-lus par lead
      const { data: unreadData } = await supabase
        .from('conversations')
        .select('lead_id')
        .eq('agency_id', agencyId)
        .eq('direction', 'inbound')
        .is('read_at', null)

      const unreadByLead = {}
      for (const row of (unreadData || [])) {
        unreadByLead[row.lead_id] = (unreadByLead[row.lead_id] || 0) + 1
      }

      const threadList = [...byLead.values()].map(msg => ({
        lead_id:     msg.lead_id,
        lead_nom:    msg.leads?.nom    || `+${msg.from_number || 'Inconnu'}`,
        lead_tel:    msg.leads?.telephone || '',
        last_msg:    msg.content,
        last_ts:     msg.created_at,
        direction:   msg.direction,
        unread:      unreadByLead[msg.lead_id] || 0,
      }))

      // Trier par date décroissante
      threadList.sort((a, b) => new Date(b.last_ts) - new Date(a.last_ts))
      setThreads(threadList)

      // Auto-sélectionner si ?lead= passé en URL
      if (preselectedLeadId && !activeLead) {
        const found = threadList.find(t => t.lead_id === preselectedLeadId)
        if (found) selectThread(found)
      }
    } finally {
      setLoadingThreads(false)
    }
  }, [agencyId, preselectedLeadId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadThreads() }, [loadThreads])

  // ── Charger les messages du thread actif ──────────────────────────────────
  const loadMessages = useCallback(async (leadId) => {
    if (!leadId || !agencyId) return
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('lead_id', leadId)
        .eq('channel', 'whatsapp')
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

      // Mettre à jour le compteur local
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
    setTimeout(() => replyRef.current?.focus(), 100)
  }, [loadMessages, setSearchParams])

  // ── Scroll auto vers le bas ───────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!agencyId) return

    const channel = supabase
      .channel(`inbox:${agencyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'conversations',
          filter: `agency_id=eq.${agencyId}`,
        },
        (payload) => {
          const newMsg = payload.new

          // Mettre à jour les messages si c'est le thread actif
          setActiveLead(prev => {
            if (prev?.lead_id === newMsg.lead_id) {
              setMessages(m => {
                // Éviter les doublons
                if (m.some(x => x.id === newMsg.id)) return m
                return [...m, newMsg]
              })
              // Marquer comme lu si c'est un entrant
              if (newMsg.direction === 'inbound') {
                supabase
                  .from('conversations')
                  .update({ read_at: new Date().toISOString() })
                  .eq('id', newMsg.id)
                  .then(() => {})
              }
            } else if (newMsg.direction === 'inbound') {
              // Incrémenter le badge non-lu du thread concerné
              setThreads(prev2 => prev2.map(t =>
                t.lead_id === newMsg.lead_id
                  ? { ...t, unread: t.unread + 1, last_msg: newMsg.content, last_ts: newMsg.created_at }
                  : t
              ))
            }
            return prev
          })

          // Rafraîchir la liste des threads (pour remonter le thread en tête)
          loadThreads()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [agencyId, loadThreads])

  // ── Envoyer un message ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!reply.trim() || !activeLead?.lead_id || sending) return
    setSending(true)
    const msg = reply.trim()
    setReply('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/send', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ leadId: activeLead.lead_id, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur envoi')
      // Le message apparaîtra via Realtime (insert dans conversations)
    } catch (err) {
      console.error('[Inbox] send error:', err)
      setReply(msg) // remettre le message en cas d'erreur
      setToast({ msg: err.message, type: 'error' })
      setTimeout(() => setToast(null), 3500)
    } finally {
      setSending(false)
    }
  }

  // ── Filtrer les threads ───────────────────────────────────────────────────
  const filteredThreads = threads.filter(t => {
    if (filter === 'unread' && t.unread === 0) return false
    if (search) {
      const q = search.toLowerCase()
      return t.lead_nom?.toLowerCase().includes(q) || t.lead_tel?.includes(q)
    }
    return true
  })

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0)

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

      {/* ══ SIDEBAR gauche : liste des threads ══════════════════════════════ */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">

        {/* En-tête sidebar */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h1 className="text-base font-bold text-slate-800">Inbox WhatsApp</h1>
              {totalUnread > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
          </div>

          {/* Recherche */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un contact…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
          />

          {/* Filtre lu/non lu */}
          <div className="flex gap-1 mt-2">
            {[['all', 'Tous'], ['unread', 'Non lus']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  filter === val
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {label}
                {val === 'unread' && totalUnread > 0 && ` (${totalUnread})`}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des threads */}
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm font-medium text-slate-500">
                {search || filter === 'unread' ? 'Aucun résultat' : 'Aucune conversation'}
              </p>
              {!search && filter === 'all' && (
                <p className="text-xs text-slate-400 mt-1">
                  Les messages WhatsApp entrants apparaîtront ici.
                </p>
              )}
            </div>
          ) : (
            filteredThreads.map(thread => {
              const isActive = activeLead?.lead_id === thread.lead_id
              return (
                <button
                  key={thread.lead_id}
                  onClick={() => selectThread(thread)}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors border-b border-slate-50
                    ${isActive ? 'bg-green-50 border-l-2 border-l-green-500' : 'hover:bg-slate-50'}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${isActive ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {avatar(thread.lead_nom)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${thread.unread > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {thread.lead_nom}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                        {fmtTime(thread.last_ts)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate max-w-[160px] ${thread.unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {thread.direction === 'outbound' && <span className="text-green-600 mr-1">Vous:</span>}
                        {thread.last_msg}
                      </p>
                      {thread.unread > 0 && (
                        <span className="bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
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
            <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {avatar(activeLead.lead_nom)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{activeLead.lead_nom}</p>
                <p className="text-xs text-slate-400">{activeLead.lead_tel || 'WhatsApp'}</p>
              </div>
              {activeLead.lead_id && (
                <a
                  href={`/lead/${activeLead.lead_id}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Voir fiche →
                </a>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-slate-50">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm text-slate-400">Aucun message pour l'instant.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isOut = msg.direction === 'outbound'
                    const showDate = i === 0 ||
                      new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center my-3">
                            <span className="bg-slate-200 text-slate-500 text-xs px-3 py-1 rounded-full">
                              {new Date(msg.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                          <div
                            title={fmtFull(msg.created_at)}
                            className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm
                              ${isOut
                                ? 'bg-green-500 text-white rounded-br-sm'
                                : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'
                              }`}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={`text-[10px] mt-1 text-right ${isOut ? 'text-green-100' : 'text-slate-400'}`}>
                              {fmtTime(msg.created_at)}
                              {isOut && (
                                <span className="ml-1">
                                  {msg.status === 'read'      ? ' ✓✓' :
                                   msg.status === 'delivered' ? ' ✓✓' :
                                   msg.status === 'sent'      ? ' ✓'  :
                                   msg.status === 'failed'    ? ' ✗'  : ''}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Zone de saisie */}
            <div className="px-4 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={replyRef}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
                  rows={2}
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-400 bg-slate-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                  className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
                  title="Envoyer (Entrée)"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-1">
                Envoi via WhatsApp Business · Twilio
              </p>
            </div>
          </>
        ) : (
          /* Écran vide ou configuration requise */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">

            {/* ── Twilio PAS configuré → écran de setup ── */}
            {twilioConfigured === false ? (
              <div className="max-w-md w-full">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-5 mx-auto">
                  <span className="text-4xl">⚙️</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration WhatsApp requise</h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Pour envoyer et recevoir des messages WhatsApp, connectez votre compte Twilio dans les paramètres de messagerie.
                </p>

                {/* CTA principal */}
                <button
                  onClick={() => navigate('/settings?tab=messagerie')}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5
                             bg-green-600 hover:bg-green-700 text-white rounded-xl
                             font-semibold text-sm shadow-md shadow-green-200 transition-colors mb-4"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Configurer la messagerie WhatsApp
                </button>

                {/* Étapes résumées */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-left space-y-2.5">
                  {[
                    { n: 1, text: 'Créer un compte Twilio et activer WhatsApp' },
                    { n: 2, text: 'Coller le Account SID et Auth Token dans Paramètres → Messagerie' },
                    { n: 3, text: `Configurer le webhook : leadqualif.com/api/webhooks/whatsapp` },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center
                                       justify-center font-bold text-[10px] shrink-0 mt-0.5">{s.n}</span>
                      <p className="text-xs text-slate-600 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Twilio configuré mais aucun thread sélectionné */
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <h2 className="text-lg font-bold text-slate-700 mb-2">Inbox WhatsApp</h2>
                <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                  Sélectionnez une conversation à gauche pour afficher les messages,
                  ou attendez qu'un nouveau message arrive.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
