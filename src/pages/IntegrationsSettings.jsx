/**
 * IntegrationsSettings — /settings/integrations
 * Connexion OAuth Email (Gmail / Outlook) et Calendrier (Google / Microsoft)
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

/* ── Composants UI ──────────────────────────────────────────────────────── */
const Badge = ({ ok, label }) => ok
  ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">✅ {label}</span>
  : <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">⚪ Non connecté</span>

const ProviderCard = ({ icon, name, badge, email, onConnect, onDisconnect, loading, children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-bold text-slate-800">{name}</p>
          {email && <p className="text-xs text-slate-500 mt-0.5">{email}</p>}
        </div>
      </div>
      {badge}
    </div>
    {children}
    <div className="flex gap-2">
      <button onClick={onConnect} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
        {loading ? '⏳' : '🔗'} {email ? 'Reconnecter' : 'Connecter'}
      </button>
      {email && (
        <button onClick={onDisconnect} disabled={loading}
          className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          Déconnecter
        </button>
      )}
    </div>
  </div>
)

const EventRow = ({ event }) => {
  const start = event.start ? new Date(event.start) : null
  const dateStr = start ? start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
  const timeStr = start ? start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-indigo-600 leading-none">{start?.getDate()}</span>
        <span className="text-[9px] text-indigo-400">{start?.toLocaleDateString('fr-FR', { month: 'short' })}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{event.title || 'Sans titre'}</p>
        <p className="text-xs text-slate-400">{dateStr} · {timeStr}</p>
      </div>
    </div>
  )
}

/* ── Composant principal ────────────────────────────────────────────────── */
export default function IntegrationsSettings() {
  const navigate           = useNavigate()
  const [searchParams]     = useSearchParams()

  const [loading, setLoading]         = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [toast, setToast]             = useState(null)

  const [emailIntegrations, setEmailIntegrations]       = useState([])
  const [calendarIntegrations, setCalendarIntegrations] = useState([])
  const [upcomingEvents, setUpcomingEvents]             = useState([])
  const [eventsProvider, setEventsProvider]             = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  /* ── Charger le statut des intégrations ─────────────────────────────── */
  const loadStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }

    try {
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ action: 'get-status' }),
      })
      const data = await res.json()
      setEmailIntegrations(data.email || [])
      setCalendarIntegrations(data.calendar || [])
    } catch (e) {
      console.error('[Integrations] load:', e)
    }

    // Charger les prochains RDV
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/calendar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body:    JSON.stringify({ action: 'get-upcoming', limit: 5 }),
      })
      const data = await res.json()
      setUpcomingEvents(data.events || [])
      setEventsProvider(data.provider)
    } catch {}

    setLoading(false)
  }, [navigate])

  useEffect(() => {
    loadStatus()

    // Gérer les redirections OAuth
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')
    if (connected) showToast(`✅ ${connected === 'google' ? 'Google' : 'Microsoft'} connecté avec succès !`)
    if (error)     showToast(`❌ Erreur : ${decodeURIComponent(error)}`, 'error')
  }, [loadStatus, searchParams])

  /* ── Lancer OAuth ─────────────────────────────────────────────────────── */
  const connectProvider = async (provider) => {
    setActionLoading(provider)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // Encoder le token dans le state pour le callback
      const state = btoa(JSON.stringify({ token: session.access_token, nonce: Math.random().toString(36).slice(2) }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      // Rediriger vers l'OAuth
      window.location.href = `/api/auth?action=${provider}-init&state=${encodeURIComponent(state)}`
    } catch (e) {
      showToast(`❌ ${e.message}`, 'error')
      setActionLoading('')
    }
  }

  /* ── Déconnecter ──────────────────────────────────────────────────────── */
  const disconnectProvider = async (provider) => {
    if (!confirm(`Déconnecter ${provider === 'google' ? 'Google' : 'Microsoft'} ?`)) return
    setActionLoading(`disconnect-${provider}`)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ action: 'disconnect', provider, type: 'both' }),
      })
      showToast(`${provider === 'google' ? 'Google' : 'Microsoft'} déconnecté.`)
      loadStatus()
    } catch (e) {
      showToast(`❌ ${e.message}`, 'error')
    } finally {
      setActionLoading('')
    }
  }

  /* ── Getters ──────────────────────────────────────────────────────────── */
  const getEmail = (provider) => emailIntegrations.find(i => i.provider === provider)
  const getCal   = (provider) => calendarIntegrations.find(i => i.provider === provider)

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-slate-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-3" />
        <p className="text-sm">Chargement…</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100 text-lg">×</button>
        </div>
      )}

      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">←</button>
            <div>
              <h1 className="text-base font-bold text-slate-900">🔌 Intégrations</h1>
              <p className="text-xs text-slate-400">Connectez votre email et votre calendrier</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Bandeau info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-sm text-indigo-700">
            <span className="text-xl shrink-0">ℹ️</span>
            <div>
              <p className="font-semibold mb-1">Connexion OAuth sécurisée</p>
              <p className="text-xs text-indigo-600">Vos emails seront envoyés <strong>depuis votre vraie boîte</strong> (apparaissent dans "Envoyés"). Les RDV créés sont synchronisés avec votre calendrier. Aucun mot de passe stocké.</p>
            </div>
          </div>

          {/* ── Section Email ──────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">📧 Email</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gmail */}
              <ProviderCard
                icon="📨" name="Gmail"
                badge={<Badge ok={!!getEmail('google')} label={getEmail('google')?.email || 'Connecté'} />}
                email={getEmail('google')?.email}
                onConnect={() => connectProvider('google')}
                onDisconnect={() => disconnectProvider('google')}
                loading={actionLoading === 'google' || actionLoading === 'disconnect-google'}
              >
                <p className="text-xs text-slate-400">
                  Les emails partent depuis votre adresse Gmail. Scopes : Send + Read.
                </p>
              </ProviderCard>

              {/* Outlook */}
              <ProviderCard
                icon="📬" name="Outlook / Microsoft 365"
                badge={<Badge ok={!!getEmail('microsoft')} label={getEmail('microsoft')?.email || 'Connecté'} />}
                email={getEmail('microsoft')?.email}
                onConnect={() => connectProvider('microsoft')}
                onDisconnect={() => disconnectProvider('microsoft')}
                loading={actionLoading === 'microsoft' || actionLoading === 'disconnect-microsoft'}
              >
                <p className="text-xs text-slate-400">
                  Via Microsoft Graph API. Scopes : Mail.Send + Mail.Read.
                </p>
              </ProviderCard>
            </div>
          </section>

          {/* ── Section Calendrier ──────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">📅 Calendrier</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Google Calendar */}
              <ProviderCard
                icon="🗓️" name="Google Calendar"
                badge={<Badge ok={!!getCal('google')} label="Connecté" />}
                email={getCal('google') ? 'Google Calendar actif' : null}
                onConnect={() => connectProvider('google')}
                onDisconnect={() => disconnectProvider('google')}
                loading={actionLoading === 'google' || actionLoading === 'disconnect-google'}
              >
                <p className="text-xs text-slate-400">
                  Lecture des disponibilités + création d'événements. La connexion Gmail inclut automatiquement le calendrier.
                </p>
              </ProviderCard>

              {/* Outlook Calendar */}
              <ProviderCard
                icon="📋" name="Outlook Calendar"
                badge={<Badge ok={!!getCal('microsoft')} label="Connecté" />}
                email={getCal('microsoft') ? 'Outlook Calendar actif' : null}
                onConnect={() => connectProvider('microsoft')}
                onDisconnect={() => disconnectProvider('microsoft')}
                loading={actionLoading === 'microsoft' || actionLoading === 'disconnect-microsoft'}
              >
                <p className="text-xs text-slate-400">
                  Via Microsoft Graph. Scopes : Calendars.ReadWrite. La connexion Outlook inclut le calendrier.
                </p>
              </ProviderCard>
            </div>
          </section>

          {/* ── Prochains RDV ──────────────────────────────────────────── */}
          {(eventsProvider || upcomingEvents.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                🗓️ Prochains RDV — {eventsProvider === 'google' ? 'Google Calendar' : 'Outlook'}
              </h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Aucun RDV à venir dans les 7 prochains jours.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {upcomingEvents.map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Guide de configuration OAuth ─────────────────────────── */}
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-amber-800">⚙️ Configuration requise</h3>
            <p className="text-xs text-amber-700">
              Pour activer les boutons ci-dessus, configurez ces variables dans <strong>Vercel → Settings → Environment Variables</strong> :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-xl border border-amber-100 p-3">
                <p className="font-bold text-slate-700 mb-2">🔵 Google OAuth</p>
                <p className="text-slate-500 mb-1">console.cloud.google.com → Credentials → OAuth 2.0</p>
                <code className="block text-indigo-700">GOOGLE_CLIENT_ID</code>
                <code className="block text-indigo-700">GOOGLE_CLIENT_SECRET</code>
                <p className="text-slate-400 mt-2">Redirect URI : <br/><code>https://www.leadqualif.com/api/auth?action=google-callback</code></p>
              </div>
              <div className="bg-white rounded-xl border border-amber-100 p-3">
                <p className="font-bold text-slate-700 mb-2">🟣 Microsoft OAuth</p>
                <p className="text-slate-500 mb-1">portal.azure.com → App registrations → Certificates</p>
                <code className="block text-indigo-700">MICROSOFT_CLIENT_ID</code>
                <code className="block text-indigo-700">MICROSOFT_CLIENT_SECRET</code>
                <p className="text-slate-400 mt-2">Redirect URI : <br/><code>https://www.leadqualif.com/api/auth?action=microsoft-callback</code></p>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
