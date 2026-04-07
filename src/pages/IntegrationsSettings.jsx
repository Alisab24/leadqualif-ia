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

/* ── Table d'aide hébergeurs ────────────────────────────────────────────── */
const SMTP_PROVIDERS = [
  { name: 'OVH',         host: 'ssl0.ovh.net',          port: 465, enc: 'SSL' },
  { name: 'Ionos (1&1)', host: 'smtp.ionos.fr',          port: 587, enc: 'TLS' },
  { name: 'Infomaniak',  host: 'mail.infomaniak.com',    port: 587, enc: 'TLS' },
  { name: 'Gandi',       host: 'mail.gandi.net',         port: 587, enc: 'TLS' },
  { name: 'Hostinger',   host: 'smtp.hostinger.com',     port: 587, enc: 'TLS' },
]

/* ── Formulaire SMTP ────────────────────────────────────────────────────── */
const SmtpForm = ({ session, onSaved, onCancel, existing }) => {
  const [form, setForm]         = useState({
    host:        existing?.smtp_host        || '',
    port:        existing?.smtp_port        || '587',
    email:       existing?.smtp_user        || '',
    displayName: existing?.smtp_display_name|| '',
    password:    '',
    encryption:  existing?.smtp_encryption  || 'tls',
  })
  const [showPwd, setShowPwd]   = useState(false)
  const [testing, setTesting]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [testResult, setTestResult] = useState(null) // {success, message, error}

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTestResult(null) }

  const testSmtp = async () => {
    if (!form.host || !form.email || !form.password) {
      setTestResult({ success: false, error: 'Remplissez au moins : serveur, email et mot de passe' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res  = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ action: 'test-smtp', ...form }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (e) {
      setTestResult({ success: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  const saveSmtp = async () => {
    setSaving(true)
    try {
      const res  = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ action: 'save-smtp', ...form }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur lors de l\'enregistrement')
      onSaved()
    } catch (e) {
      setTestResult({ success: false, error: e.message })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">⚙️ Configuration SMTP manuelle</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Serveur */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Serveur SMTP</label>
          <input className={inputCls} placeholder="mail.monagence.com" value={form.host}
            onChange={e => set('host', e.target.value)} />
        </div>

        {/* Port + Chiffrement */}
        <div>
          <label className={labelCls}>Port</label>
          <select className={inputCls} value={form.port} onChange={e => set('port', e.target.value)}>
            <option value="25">25</option>
            <option value="465">465</option>
            <option value="587">587 (recommandé)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Chiffrement</label>
          <select className={inputCls} value={form.encryption} onChange={e => set('encryption', e.target.value)}>
            <option value="tls">TLS — STARTTLS (recommandé)</option>
            <option value="ssl">SSL (port 465)</option>
            <option value="none">Aucun</option>
          </select>
        </div>

        {/* Email */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Email expéditeur</label>
          <input className={inputCls} type="email" placeholder="contact@monagence.com" value={form.email}
            onChange={e => set('email', e.target.value)} />
        </div>

        {/* Nom affiché */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Nom affiché</label>
          <input className={inputCls} placeholder="Marie — Agence XYZ" value={form.displayName}
            onChange={e => set('displayName', e.target.value)} />
        </div>

        {/* Mot de passe */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Mot de passe</label>
          <div className="relative">
            <input className={`${inputCls} pr-10`} type={showPwd ? 'text' : 'password'}
              placeholder={existing ? '(inchangé si vide — resaisissez pour modifier)' : '••••••••'}
              value={form.password} onChange={e => set('password', e.target.value)} />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stocké chiffré (AES-256-GCM). Jamais retourné en clair.</p>
        </div>
      </div>

      {/* Résultat du test */}
      {testResult && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm
          ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span className="text-base shrink-0">{testResult.success ? '✅' : '❌'}</span>
          <span>{testResult.success ? testResult.message : testResult.error}</span>
        </div>
      )}

      {/* Boutons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={testSmtp} disabled={testing || saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {testing ? '⏳ Test en cours…' : '🔌 Tester la connexion'}
        </button>
        <button onClick={saveSmtp}
          disabled={saving || !testResult?.success}
          title={!testResult?.success ? 'Testez la connexion d\'abord' : ''}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-xl transition-colors">
          Annuler
        </button>
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
  const [showSmtpForm, setShowSmtpForm]                 = useState(false)
  const [currentSession, setCurrentSession]             = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  /* ── Charger le statut des intégrations ─────────────────────────────── */
  const loadStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    setCurrentSession(session)

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

    // Auto-refresh du statut toutes les 60 secondes
    const interval = setInterval(() => loadStatus(), 60_000)
    return () => clearInterval(interval)
  }, [loadStatus, searchParams])

  /* ── Lancer OAuth ─────────────────────────────────────────────────────── */
  const connectProvider = async (provider) => {
    setActionLoading(provider)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }

      // Le backend génère l'URL avec un state court (uid+nonce) — évite JWT dans l'URL
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ action: 'get-oauth-url', provider }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Impossible de générer l\'URL OAuth')

      // Rediriger vers Google/Microsoft
      window.location.href = data.url
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
  const getSmtp  = ()         => emailIntegrations.find(i => i.provider === 'smtp')

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
              <p className="font-semibold mb-1">3 modes de connexion email</p>
              <p className="text-xs text-indigo-600">
                <strong>OAuth Google/Microsoft</strong> — emails depuis votre vraie boîte, visibles dans "Envoyés". &nbsp;|&nbsp;
                <strong>SMTP manuel</strong> — pour OVH, Ionos, Infomaniak, etc. &nbsp;|&nbsp;
                Priorité : OAuth &gt; SMTP. Les RDV sont synchronisés avec votre calendrier.
              </p>
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

            {/* SMTP manuel */}
            {showSmtpForm && currentSession ? (
              <SmtpForm
                session={currentSession}
                existing={getSmtp()}
                onSaved={() => { setShowSmtpForm(false); showToast('✅ SMTP enregistré !'); loadStatus() }}
                onCancel={() => setShowSmtpForm(false)}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📮</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">SMTP manuel</p>
                      {getSmtp()
                        ? <p className="text-xs text-slate-500 mt-0.5">{getSmtp().smtp_host}:{getSmtp().smtp_port} — {getSmtp().smtp_user}</p>
                        : <p className="text-xs text-slate-400 mt-0.5">OVH, Ionos, Infomaniak, Gandi, Hostinger…</p>
                      }
                    </div>
                  </div>
                  {getSmtp()
                    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">✅ Configuré</span>
                    : <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">⚪ Non configuré</span>
                  }
                </div>
                <p className="text-xs text-slate-400">Pour les agences hébergées chez OVH, Ionos, Infomaniak, etc. Priorité : OAuth Google/Microsoft &gt; SMTP.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowSmtpForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors">
                    ⚙️ {getSmtp() ? 'Modifier' : 'Configurer manuellement'}
                  </button>
                  {getSmtp() && (
                    <button onClick={() => disconnectProvider('smtp')}
                      className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors">
                      Déconnecter
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Table d'aide hébergeurs */}
            <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
              <summary className="flex items-center gap-2 cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors list-none">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                📋 Paramètres SMTP selon votre hébergeur
              </summary>
              <div className="px-5 pb-4 pt-2">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-4 font-semibold text-slate-600">Hébergeur</th>
                      <th className="text-left py-2 pr-4 font-semibold text-slate-600">Serveur SMTP</th>
                      <th className="text-left py-2 pr-4 font-semibold text-slate-600">Port</th>
                      <th className="text-left py-2 font-semibold text-slate-600">Chiffrement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SMTP_PROVIDERS.map(p => (
                      <tr key={p.name} className="border-b border-slate-100 hover:bg-white transition-colors">
                        <td className="py-2 pr-4 font-medium text-slate-800">{p.name}</td>
                        <td className="py-2 pr-4 text-indigo-600 font-mono">
                          <button onClick={() => { setShowSmtpForm(true) }}
                            title="Utiliser ce serveur"
                            className="hover:underline">{p.host}</button>
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{p.port}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                            ${p.enc === 'SSL' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {p.enc}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-slate-400 mt-3">
                  💡 Utilisez votre adresse email complète comme identifiant et votre mot de passe de messagerie (ou mot de passe d'application si 2FA activé).
                </p>
              </div>
            </details>
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


        </div>
      </main>
    </div>
  )
}
