/**
 * WorkspaceSettings — /settings/workspace
 * Configuration complète de l'espace de travail (agence)
 * Onglets : Agence · Email · WhatsApp · Calendrier · Notifications
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

/* ── Constantes ─────────────────────────────────────────────────────────── */
const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Brussels', 'Europe/Madrid',
  'Europe/Berlin', 'Europe/Zurich', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Montreal', 'America/Toronto',
  'Africa/Casablanca', 'Africa/Tunis', 'Africa/Algiers', 'Indian/Reunion',
  'Indian/Mauritius', 'Pacific/Tahiti', 'UTC',
]
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DURATIONS = [15, 30, 45, 60, 90, 120]
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7h→21h

const TABS = [
  { key: 'identity',      icon: '🏢', label: 'Agence',        configKey: 'identity' },
  { key: 'email',         icon: '📧', label: 'Email',          configKey: 'email' },
  { key: 'whatsapp',      icon: '💬', label: 'WhatsApp',       configKey: 'whatsapp' },
  { key: 'calendar',      icon: '📅', label: 'Calendrier',     configKey: 'calendar' },
  { key: 'notifications', icon: '🔔', label: 'Notifications',  configKey: 'notifications' },
]

/* ── Composants UI ──────────────────────────────────────────────────────── */
const Field = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-semibold text-slate-700">{label}</label>
    {children}
    {hint && <p className="text-xs text-slate-400">{hint}</p>}
  </div>
)

const Input = ({ type = 'text', ...props }) => (
  <input type={type} {...props}
    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl
               focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white
               disabled:bg-slate-50 disabled:text-slate-400" />
)

const Textarea = ({ rows = 3, ...props }) => (
  <textarea rows={rows} {...props}
    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl
               focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white" />
)

const Select = ({ children, ...props }) => (
  <select {...props}
    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl
               focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
    {children}
  </select>
)

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`} />
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </div>
    <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
  </label>
)

const StatusBadge = ({ ok }) => ok
  ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ Configuré</span>
  : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚪ À configurer</span>

const TestResult = ({ result }) => {
  if (!result) return null
  return (
    <div className={`mt-2 px-4 py-3 rounded-xl text-sm font-medium border ${
      result.success
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-red-50 border-red-200 text-red-600'
    }`}>
      {result.success ? `✅ ${result.message}` : `❌ ${result.error}`}
    </div>
  )
}

/* ── Composant principal ────────────────────────────────────────────────── */
export default function WorkspaceSettings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('identity')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saveOk, setSaveOk]       = useState(false)
  const [configured, setConfigured] = useState({})
  const [userEmail, setUserEmail] = useState('')

  // Test buttons state
  const [testEmailTo,     setTestEmailTo]     = useState('')
  const [testEmailResult, setTestEmailResult] = useState(null)
  const [testEmailLoading,setTestEmailLoading]= useState(false)
  const [testWaTo,        setTestWaTo]        = useState('')
  const [testWaResult,    setTestWaResult]    = useState(null)
  const [testWaLoading,   setTestWaLoading]   = useState(false)

  // Form state
  const [form, setForm] = useState({
    // Identité
    agency_name: '', agency_logo_url: '', primary_color: '#2E75B6',
    // Email
    resend_api_key: '', from_email: '', from_name: '', email_signature: '',
    // WhatsApp
    twilio_account_sid: '', twilio_auth_token: '', twilio_whatsapp_number: '',
    // Calendrier
    calendar_timezone: 'Europe/Paris',
    working_hours_start: 9, working_hours_end: 18,
    working_days: ['1','2','3','4','5'],
    appointment_duration: 30,
    booking_link: '',
    // Notifications
    notification_email: '',
    notify_new_lead: true, notify_hot_lead: true, notify_new_message: true,
  })

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  /* ── Charger les settings ─────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      setUserEmail(session.user.email || '')
      setTestEmailTo(session.user.email || '')

      try {
        const res = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'get-settings' }),
        })
        const data = await res.json()
        if (data.settings) {
          setForm(prev => ({ ...prev, ...data.settings }))
        }
        setConfigured(data.configured || {})
      } catch (e) {
        console.error('[WorkspaceSettings] load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [navigate])

  /* ── Sauvegarder ──────────────────────────────────────────────────────── */
  const save = async () => {
    setSaving(true); setSaveOk(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'save-settings', ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaveOk(true)
      // Recalculer configured
      setConfigured({
        identity:      !!(form.agency_name),
        email:         !!(form.resend_api_key && form.from_email),
        whatsapp:      !!(form.twilio_account_sid && form.twilio_auth_token && form.twilio_whatsapp_number),
        calendar:      true,
        notifications: !!(form.notification_email),
      })
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e) {
      alert(`❌ ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  /* ── Test Email ───────────────────────────────────────────────────────── */
  const testEmail = async () => {
    setTestEmailLoading(true); setTestEmailResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'test-email', to: testEmailTo }),
      })
      setTestEmailResult(await res.json())
    } finally {
      setTestEmailLoading(false)
    }
  }

  /* ── Test WhatsApp ────────────────────────────────────────────────────── */
  const testWa = async () => {
    setTestWaLoading(true); setTestWaResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'test-whatsapp', to: testWaTo }),
      })
      setTestWaResult(await res.json())
    } finally {
      setTestWaLoading(false)
    }
  }

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

      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">←</button>
            <div>
              <h1 className="text-base font-bold text-slate-900">⚙️ Workspace</h1>
              <p className="text-xs text-slate-400">Configuration de votre espace de travail</p>
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700
                       text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
            {saving ? '⏳ Sauvegarde…' : saveOk ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar onglets */}
        <nav className="flex-none w-52 bg-white border-r border-slate-200 py-4 space-y-1 px-3">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}>
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
              <StatusBadge ok={configured[tab.configKey]} />
            </button>
          ))}
        </nav>

        {/* Contenu */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* ═══ ONGLET AGENCE ══════════════════════════════ */}
            {activeTab === 'identity' && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800">🏢 Identité de l'agence</h2>

                <Field label="Nom de l'agence">
                  <Input value={form.agency_name} onChange={e => set('agency_name', e.target.value)}
                    placeholder="Ex: Agence Dupont Immobilier" />
                </Field>

                <Field label="URL du logo" hint="Lien direct vers votre logo (JPG, PNG, SVG)">
                  <Input value={form.agency_logo_url} onChange={e => set('agency_logo_url', e.target.value)}
                    placeholder="https://monsite.com/logo.png" />
                  {form.agency_logo_url && (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={form.agency_logo_url} alt="Logo preview" className="h-12 w-auto rounded-lg border border-slate-200 object-contain p-1" onError={e => e.target.style.display='none'} />
                      <span className="text-xs text-slate-400">Aperçu du logo</span>
                    </div>
                  )}
                </Field>

                <Field label="Couleur principale" hint="Utilisée pour personnaliser l'interface">
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.primary_color}
                      onChange={e => set('primary_color', e.target.value)}
                      className="h-10 w-16 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                    <Input value={form.primary_color} onChange={e => set('primary_color', e.target.value)}
                      placeholder="#2E75B6" className="flex-1" />
                    <div className="w-10 h-10 rounded-lg border border-slate-200 shrink-0"
                      style={{ backgroundColor: form.primary_color }} />
                  </div>
                </Field>
              </section>
            )}

            {/* ═══ ONGLET EMAIL ════════════════════════════════ */}
            {activeTab === 'email' && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800">📧 Configuration email (Resend)</h2>

                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                  💡 Obtenez votre clé API sur <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="font-semibold underline">resend.com/api-keys</a>
                </div>

                <Field label="Clé API Resend" hint="Commence par re_...">
                  <Input type="password" value={form.resend_api_key}
                    onChange={e => set('resend_api_key', e.target.value)}
                    placeholder="re_••••••••••••••••••••••••" autoComplete="off" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email d'envoi">
                    <Input value={form.from_email} onChange={e => set('from_email', e.target.value)}
                      placeholder="contact@monagence.com" type="email" />
                  </Field>
                  <Field label="Nom affiché">
                    <Input value={form.from_name} onChange={e => set('from_name', e.target.value)}
                      placeholder='Marie — Agence XYZ' />
                  </Field>
                </div>

                <Field label="Signature email" hint="Apparaît en bas de chaque email envoyé">
                  <Textarea value={form.email_signature}
                    onChange={e => set('email_signature', e.target.value)}
                    placeholder="Cordialement,&#10;Marie Dupont — Agence XYZ&#10;📞 06 12 34 56 78" />
                </Field>

                {/* Test */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">🧪 Envoyer un email de test</p>
                  <div className="flex gap-2">
                    <Input value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)}
                      placeholder="destinataire@test.com" type="email" />
                    <button onClick={testEmail} disabled={testEmailLoading || !testEmailTo}
                      className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                                 rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap">
                      {testEmailLoading ? '⏳' : '📤 Tester'}
                    </button>
                  </div>
                  <TestResult result={testEmailResult} />
                </div>
              </section>
            )}

            {/* ═══ ONGLET WHATSAPP ═════════════════════════════ */}
            {activeTab === 'whatsapp' && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800">💬 Configuration WhatsApp (Twilio)</h2>

                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-green-700">
                  💡 Trouvez vos credentials sur <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="font-semibold underline">console.twilio.com</a>
                </div>

                <Field label="Account SID" hint="Commence par AC...">
                  <Input type="password" value={form.twilio_account_sid}
                    onChange={e => set('twilio_account_sid', e.target.value)}
                    placeholder="AC••••••••••••••••••••••••••••••••" autoComplete="off" />
                </Field>

                <Field label="Auth Token">
                  <Input type="password" value={form.twilio_auth_token}
                    onChange={e => set('twilio_auth_token', e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••" autoComplete="off" />
                </Field>

                <Field label="Numéro WhatsApp" hint="Format international : +14155238886">
                  <Input value={form.twilio_whatsapp_number}
                    onChange={e => set('twilio_whatsapp_number', e.target.value)}
                    placeholder="+14155238886" />
                </Field>

                {/* Test */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">🧪 Tester la connexion WhatsApp</p>
                  <div className="flex gap-2">
                    <Input value={testWaTo} onChange={e => setTestWaTo(e.target.value)}
                      placeholder="+33612345678" />
                    <button onClick={testWa} disabled={testWaLoading || !testWaTo}
                      className="shrink-0 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold
                                 rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap">
                      {testWaLoading ? '⏳' : '📲 Tester'}
                    </button>
                  </div>
                  <TestResult result={testWaResult} />
                </div>
              </section>
            )}

            {/* ═══ ONGLET CALENDRIER ═══════════════════════════ */}
            {activeTab === 'calendar' && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800">📅 Calendrier & disponibilités</h2>

                <Field label="Fuseau horaire">
                  <Select value={form.calendar_timezone} onChange={e => set('calendar_timezone', e.target.value)}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Début des heures de travail">
                    <Select value={form.working_hours_start} onChange={e => set('working_hours_start', Number(e.target.value))}>
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                    </Select>
                  </Field>
                  <Field label="Fin des heures de travail">
                    <Select value={form.working_hours_end} onChange={e => set('working_hours_end', Number(e.target.value))}>
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                    </Select>
                  </Field>
                </div>

                <Field label="Jours travaillés">
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d, i) => {
                      const val = String(i + 1)
                      const active = (form.working_days || []).includes(val)
                      return (
                        <button key={d} type="button"
                          onClick={() => {
                            const current = form.working_days || []
                            set('working_days', active
                              ? current.filter(x => x !== val)
                              : [...current, val].sort())
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Durée des RDV par défaut">
                  <div className="flex gap-2 flex-wrap">
                    {DURATIONS.map(d => (
                      <button key={d} type="button"
                        onClick={() => set('appointment_duration', d)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          form.appointment_duration === d
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                        }`}>
                        {d >= 60 ? `${d/60}h` : `${d}min`}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Lien de booking public" hint="Laissez vide pour un lien généré automatiquement">
                  <div className="flex gap-2">
                    <Input value={form.booking_link} onChange={e => set('booking_link', e.target.value)}
                      placeholder="https://calendly.com/monagence" />
                    {form.booking_link && (
                      <a href={form.booking_link} target="_blank" rel="noreferrer"
                        className="shrink-0 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        🔗
                      </a>
                    )}
                  </div>
                </Field>
              </section>
            )}

            {/* ═══ ONGLET NOTIFICATIONS ════════════════════════ */}
            {activeTab === 'notifications' && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800">🔔 Notifications</h2>

                <Field label="Email de notification" hint="Les alertes seront envoyées à cette adresse">
                  <Input value={form.notification_email} onChange={e => set('notification_email', e.target.value)}
                    placeholder={userEmail || 'contact@monagence.com'} type="email" />
                </Field>

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <p className="text-sm font-semibold text-slate-700">Recevoir une notification quand :</p>
                  <Toggle checked={!!form.notify_new_lead}
                    onChange={e => set('notify_new_lead', e.target.checked)}
                    label="🆕 Nouveau lead entrant" />
                  <Toggle checked={!!form.notify_hot_lead}
                    onChange={e => set('notify_hot_lead', e.target.checked)}
                    label="🔥 Lead qualifié comme « Chaud »" />
                  <Toggle checked={!!form.notify_new_message}
                    onChange={e => set('notify_new_message', e.target.checked)}
                    label="💬 Nouveau message WhatsApp reçu" />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
                  📌 Les notifications Realtime dans l'interface (cloche 🔔) sont toujours actives, indépendamment de ces réglages.
                </div>
              </section>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
