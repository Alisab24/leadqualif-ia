/**
 * IntegrationsSettings — /settings/integrations
 * - Connexion OAuth Email (Gmail / Outlook) et Calendrier
 * - Sources de leads : Webhooks universels + Clés API
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

/* ── Composants UI partagés ─────────────────────────────────────────────── */
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

/* ── SMTP Providers ─────────────────────────────────────────────────────── */
const SMTP_PROVIDERS = [
  { name: 'OVH',         host: 'ssl0.ovh.net',       port: 465, enc: 'SSL' },
  { name: 'Ionos (1&1)', host: 'smtp.ionos.fr',       port: 587, enc: 'TLS' },
  { name: 'Infomaniak',  host: 'mail.infomaniak.com', port: 587, enc: 'TLS' },
  { name: 'Gandi',       host: 'mail.gandi.net',      port: 587, enc: 'TLS' },
  { name: 'Hostinger',   host: 'smtp.hostinger.com',  port: 587, enc: 'TLS' },
]

/* ── Formulaire SMTP ─────────────────────────────────────────────────────── */
const SmtpForm = ({ session, onSaved, onCancel, existing }) => {
  const [form, setForm] = useState({
    host: existing?.smtp_host || '', port: existing?.smtp_port || '587',
    email: existing?.smtp_user || '', displayName: existing?.smtp_display_name || '',
    password: '', encryption: existing?.smtp_encryption || 'tls',
  })
  const [showPwd, setShowPwd]   = useState(false)
  const [testing, setTesting]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [testResult, setTestResult] = useState(null)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTestResult(null) }
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

  const testSmtp = async () => {
    if (!form.host || !form.email || !form.password) { setTestResult({ success: false, error: 'Remplissez au moins : serveur, email et mot de passe' }); return }
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'test-smtp', ...form }) })
      setTestResult(await res.json())
    } catch (e) { setTestResult({ success: false, error: e.message }) } finally { setTesting(false) }
  }
  const saveSmtp = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'save-smtp', ...form }) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur enregistrement')
      onSaved()
    } catch (e) { setTestResult({ success: false, error: e.message }) } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">⚙️ Configuration SMTP manuelle</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className={labelCls}>Serveur SMTP</label><input className={inputCls} placeholder="mail.monagence.com" value={form.host} onChange={e => set('host', e.target.value)} /></div>
        <div><label className={labelCls}>Port</label><select className={inputCls} value={form.port} onChange={e => set('port', e.target.value)}><option value="25">25</option><option value="465">465</option><option value="587">587 (recommandé)</option></select></div>
        <div><label className={labelCls}>Chiffrement</label><select className={inputCls} value={form.encryption} onChange={e => set('encryption', e.target.value)}><option value="tls">TLS — STARTTLS</option><option value="ssl">SSL (port 465)</option><option value="none">Aucun</option></select></div>
        <div className="sm:col-span-2"><label className={labelCls}>Email expéditeur</label><input className={inputCls} type="email" placeholder="contact@monagence.com" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Nom affiché</label><input className={inputCls} placeholder="Marie — Agence XYZ" value={form.displayName} onChange={e => set('displayName', e.target.value)} /></div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Mot de passe</label>
          <div className="relative">
            <input className={`${inputCls} pr-10`} type={showPwd ? 'text' : 'password'} placeholder={existing ? '(inchangé si vide)' : '••••••••'} value={form.password} onChange={e => set('password', e.target.value)} />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{showPwd ? '🙈' : '👁️'}</button>
          </div>
        </div>
      </div>
      {testResult && <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><span>{testResult.success ? '✅' : '❌'}</span><span>{testResult.success ? testResult.message : testResult.error}</span></div>}
      <div className="flex gap-2 flex-wrap">
        <button onClick={testSmtp} disabled={testing || saving} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">{testing ? '⏳ Test…' : '🔌 Tester'}</button>
        <button onClick={saveSmtp} disabled={saving || !testResult?.success} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">{saving ? '⏳…' : '💾 Enregistrer'}</button>
        <button onClick={onCancel} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-xl transition-colors">Annuler</button>
      </div>
    </div>
  )
}

/* ── Définition des sources de leads ─────────────────────────────────────── */
const LEAD_SOURCES = [
  {
    id: 'systeme', name: 'Systeme.io', icon: '⚡', color: 'blue',
    guide: [
      'Dans Systeme.io, allez dans Paramètres → Webhooks',
      'Cliquez sur "Créer un webhook"',
      'Collez l\'URL ci-dessus dans le champ URL',
      'Sélectionnez l\'événement : "Contact créé" ou "Opt-in"',
      'Sauvegardez et testez avec le bouton ci-dessous',
    ],
  },
  {
    id: 'facebook-leads', name: 'Facebook Lead Ads', icon: '📘', color: 'indigo',
    guide: [
      'Dans Meta Business Suite → Paramètres → Leads Access',
      'Cliquez sur "CRM" puis "Connecter un CRM"',
      'Choisissez "Webhook" et collez l\'URL',
      'Vérifiez avec le challenge GET (automatique)',
      'Publiez une campagne de génération de leads pour tester',
    ],
  },
  {
    id: 'tiktok', name: 'TikTok Ads', icon: '🎵', color: 'pink',
    guide: [
      'Dans TikTok Ads Manager → Events → Web Events',
      'Cliquez sur "Lead Generation" puis "Webhook"',
      'Collez l\'URL et validez avec le token de vérification',
      'Activez l\'événement "Formulaire de lead soumis"',
      'Testez avec une campagne en mode sandbox',
    ],
  },
  {
    id: 'google-ads', name: 'Google Ads', icon: '🎯', color: 'yellow',
    guide: [
      'Dans Google Ads → Outils → Conversions',
      'Créez une conversion de type "Import" → "Leads"',
      'Dans Google Sheets ou Zapier, connectez la campagne',
      'Collez l\'URL comme destination du webhook',
      'Format attendu : column_data avec EMAIL, FIRST_NAME',
    ],
  },
  {
    id: 'typeform', name: 'Typeform', icon: '📝', color: 'purple',
    guide: [
      'Dans Typeform, ouvrez votre formulaire → Connect',
      'Cliquez sur "Webhooks" dans le menu de gauche',
      'Cliquez sur "Add a webhook" et collez l\'URL',
      'Activez le webhook et cliquez "View deliveries" pour tester',
      'Les réponses arrivent en temps réel dès la soumission',
    ],
  },
  {
    id: 'tally', name: 'Tally.so', icon: '📋', color: 'teal',
    guide: [
      'Dans Tally, ouvrez votre formulaire → Intégrations',
      'Cliquez sur "Webhooks" puis "Add endpoint"',
      'Collez l\'URL dans le champ Endpoint URL',
      'Sélectionnez l\'événement "FORM_RESPONSE"',
      'Sauvegardez et soumettez une réponse test',
    ],
  },
  {
    id: 'wordpress', name: 'WordPress (CF7, Elementor…)', icon: '🌐', color: 'slate',
    guide: [
      'Installez le plugin "WP Webhooks" ou "WPForms"',
      'Dans WP Webhooks → Send Data → Add Webhook',
      'Collez l\'URL et choisissez le déclencheur "Form Submit"',
      'Pour CF7 : branchez via "WP Webhooks Contact Form 7 integration"',
      'Pour Elementor : Formulaire → Actions → Webhook → Collez l\'URL',
    ],
  },
  {
    id: 'universal', name: 'Webhook universel', icon: '🔗', color: 'green',
    guide: [
      'Collez cette URL dans n\'importe quel outil supportant les webhooks',
      'Compatible : Make (Integromat), Zapier, n8n, Pabbly, etc.',
      'Le mapping visuel ci-dessous permet d\'adapter n\'importe quel format JSON',
      'Testez en envoyant un POST avec un example de votre payload',
      'Les champs non mappés sont détectés automatiquement',
    ],
    isUniversal: true,
  },
]

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: 'bg-blue-100 text-blue-600'   },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'bg-indigo-100 text-indigo-600' },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-100',   icon: 'bg-pink-100 text-pink-600'   },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-100', icon: 'bg-yellow-100 text-yellow-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-100', icon: 'bg-purple-100 text-purple-600' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-100',   icon: 'bg-teal-100 text-teal-600'   },
  slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  icon: 'bg-slate-100 text-slate-600'  },
  green:  { bg: 'bg-green-50',  border: 'border-green-100',  icon: 'bg-green-100 text-green-600'  },
}

/* ── Configurateur de mapping universel ─────────────────────────────────── */
const MappingConfigurator = ({ session, apiKey }) => {
  const [sampleJson, setSampleJson] = useState('')
  const [parsed,     setParsed]     = useState(null)
  const [parseErr,   setParseErr]   = useState('')
  const [mapping,    setMapping]    = useState({ email: '', firstName: '', lastName: '', phone: '', source: '', detail: '' })
  const [saved,      setSaved]      = useState(false)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    // Charger le mapping existant
    const load = async () => {
      try {
        const res  = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'get-webhook-mapping', platform: 'universal' }) })
        const data = await res.json()
        if (data.mapping && Object.keys(data.mapping).length > 0) setMapping(data.mapping)
        if (data.sampleJson) setSampleJson(data.sampleJson)
      } catch {}
    }
    if (session) load()
  }, [session])

  const tryParse = (txt) => {
    setSampleJson(txt); setParseErr('')
    if (!txt.trim()) { setParsed(null); return }
    try { setParsed(JSON.parse(txt)) } catch (e) { setParseErr('JSON invalide : ' + e.message); setParsed(null) }
  }

  const autoDetect = () => {
    if (!parsed) return
    const flat = {}
    const flatten = (obj, prefix = '') => { for (const [k, v] of Object.entries(obj || {})) { const key = prefix ? `${prefix}.${k}` : k; if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key); flat[k.toLowerCase()] = key } }
    flatten(parsed)

    const find = (...candidates) => { for (const c of candidates) { const k = Object.keys(flat).find(key => key === c.toLowerCase()); if (k) return flat[k] } return '' }
    setMapping({
      email:     find('email', 'mail', 'courriel', 'email_address'),
      firstName: find('first_name', 'firstname', 'prenom', 'prénom', 'given_name', 'name'),
      lastName:  find('last_name', 'lastname', 'nom', 'family_name', 'surname'),
      phone:     find('phone', 'tel', 'telephone', 'mobile', 'phone_number'),
      source:    find('source', 'origine', 'campaign'),
      detail:    find('product', 'produit', 'service', 'funnel'),
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'save-webhook-mapping', platform: 'universal', mapping, sampleJson }) })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch {} finally { setSaving(false) }
  }

  const fieldRows = [
    { key: 'email',     label: '📧 Email',     required: true  },
    { key: 'firstName', label: '👤 Prénom',     required: false },
    { key: 'lastName',  label: '👤 Nom',        required: false },
    { key: 'phone',     label: '📱 Téléphone',  required: false },
    { key: 'source',    label: '🏷️ Source',     required: false },
    { key: 'detail',    label: '📌 Info extra',  required: false },
  ]

  const inputCls = 'flex-1 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-300'

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Exemple de JSON reçu</label>
        <textarea
          className="w-full h-28 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
          placeholder={'{\n  "name": "Jean Dupont",\n  "mail": "jean@example.com",\n  "tel": "0600000000"\n}'}
          value={sampleJson}
          onChange={e => tryParse(e.target.value)}
        />
        {parseErr && <p className="text-xs text-red-500 mt-1">{parseErr}</p>}
      </div>

      {parsed && (
        <div className="flex items-center gap-2">
          <button onClick={autoDetect}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
            ✨ Détecter automatiquement
          </button>
          <span className="text-xs text-slate-400">Champs détectés : {Object.keys(parsed).join(', ')}</span>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600">Mapping des champs</p>
        {fieldRows.map(({ key, label, required }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-700 w-28 shrink-0">
              {label}{required && <span className="text-red-400 ml-0.5">*</span>}
            </span>
            <span className="text-slate-300 text-xs">→</span>
            <input
              className={inputCls}
              placeholder={`chemin.vers.champ (ex: contact.email)`}
              value={mapping[key] || ''}
              onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
        {saving ? '⏳…' : saved ? '✅ Sauvegardé !' : '💾 Sauvegarder le mapping'}
      </button>
    </div>
  )
}

/* ── Card source de lead ─────────────────────────────────────────────────── */
const WebhookCard = ({ source, webhookUrl, session, apiKey, onTest }) => {
  const [open,     setOpen]    = useState(false)
  const [copied,   setCopied]  = useState(false)
  const [testing,  setTesting] = useState(false)
  const [testRes,  setTestRes] = useState(null)
  const c = COLOR_MAP[source.color] || COLOR_MAP.slate
  const url = `${webhookUrl}/api/webhooks/${source.id}?key=${apiKey || 'VOTRE_CLE_API'}`

  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const test = async () => {
    if (!apiKey) { setTestRes({ ok: false, result: { error: 'Générez une clé API d\'abord' } }); return }
    setTesting(true); setTestRes(null)
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'test-webhook', platform: source.id, apiKey }),
      })
      const data = await res.json()
      setTestRes(data)
    } catch (e) { setTestRes({ ok: false, result: { error: e.message } }) } finally { setTesting(false) }
  }

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${c.icon}`}>
            {source.icon}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{source.name}</p>
            <p className="text-xs text-slate-400">Webhook entrant</p>
          </div>
        </div>
      </div>

      {/* URL */}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 truncate">
          {url}
        </code>
        <button onClick={copy}
          className="shrink-0 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors">
          {copied ? '✅' : '📋'}
        </button>
      </div>

      {/* Boutons */}
      <div className="flex gap-2">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors">
          📖 {open ? 'Masquer le guide' : 'Guide de configuration'}
        </button>
        <button onClick={test} disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
          {testing ? '⏳' : '🔌'} Tester
        </button>
      </div>

      {/* Guide */}
      {open && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-700 mb-2">Guide de configuration</p>
          {source.guide.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
          {source.isUniversal && session && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-3">🗺️ Configurateur de mapping</p>
              <MappingConfigurator session={session} apiKey={apiKey} />
            </div>
          )}
        </div>
      )}

      {/* Résultat du test */}
      {testRes && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${testRes.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span>{testRes.ok ? '✅' : '❌'}</span>
          <span>{testRes.ok ? `Lead test créé (id: ${testRes.result?.leadId || '?'})` : (testRes.result?.error || JSON.stringify(testRes.result))}</span>
        </div>
      )}
    </div>
  )
}

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function IntegrationsSettings() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading,        setLoading]       = useState(true)
  const [actionLoading,  setActionLoading] = useState('')
  const [toast,          setToast]         = useState(null)
  const [currentSession, setCurrentSession] = useState(null)

  // OAuth email/calendrier
  const [emailIntegrations,    setEmailIntegrations]    = useState([])
  const [calendarIntegrations, setCalendarIntegrations] = useState([])
  const [upcomingEvents,       setUpcomingEvents]       = useState([])
  const [eventsProvider,       setEventsProvider]       = useState(null)
  const [showSmtpForm,         setShowSmtpForm]         = useState(false)

  // API Keys
  const [apiKeys,       setApiKeys]       = useState([])
  const [generatingKey, setGeneratingKey] = useState(false)
  const [webhookBaseUrl, setWebhookBaseUrl] = useState(window.location.origin)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  /* ── Charger tout ──────────────────────────────────────────────────────── */
  const loadStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    setCurrentSession(session)

    // Email/Calendrier
    try {
      const res  = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'get-status' }) })
      const data = await res.json()
      setEmailIntegrations(data.email || [])
      setCalendarIntegrations(data.calendar || [])
    } catch {}

    // RDV calendrier
    try {
      const res = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'get-upcoming', limit: 5 }) })
      const data = await res.json()
      setUpcomingEvents(data.events || []); setEventsProvider(data.provider)
    } catch {}

    // Clés API
    try {
      const res  = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'get-api-key' }) })
      const data = await res.json()
      setApiKeys(data.keys || [])
    } catch {}

    setLoading(false)
  }, [navigate])

  useEffect(() => {
    loadStatus()
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')
    if (connected) showToast(`✅ ${connected === 'google' ? 'Google' : 'Microsoft'} connecté !`)
    if (error)     showToast(`❌ Erreur : ${decodeURIComponent(error)}`, 'error')
    const interval = setInterval(() => loadStatus(), 60_000)
    return () => clearInterval(interval)
  }, [loadStatus, searchParams])

  /* ── OAuth ────────────────────────────────────────────────────────────── */
  const connectProvider = async (provider) => {
    setActionLoading(provider)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res  = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'get-oauth-url', provider }) })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'URL OAuth introuvable')
      window.location.href = data.url
    } catch (e) { showToast(`❌ ${e.message}`, 'error'); setActionLoading('') }
  }

  const disconnectProvider = async (provider) => {
    if (!confirm(`Déconnecter ${provider === 'google' ? 'Google' : 'Microsoft'} ?`)) return
    setActionLoading(`disconnect-${provider}`)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'disconnect', provider, type: 'both' }) })
      showToast(`${provider === 'google' ? 'Google' : 'Microsoft'} déconnecté.`)
      loadStatus()
    } catch (e) { showToast(`❌ ${e.message}`, 'error') } finally { setActionLoading('') }
  }

  /* ── Clés API ─────────────────────────────────────────────────────────── */
  const generateApiKey = async () => {
    setGeneratingKey(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res  = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'generate-api-key', name: 'Clé principale' }) })
      const data = await res.json()
      if (data.key) { setApiKeys(k => [...k, data.key]); showToast('✅ Clé API générée !') }
    } catch (e) { showToast(`❌ ${e.message}`, 'error') } finally { setGeneratingKey(false) }
  }

  const revokeApiKey = async (keyId) => {
    if (!confirm('Révoquer cette clé ? Les webhooks utilisant cette clé cesseront de fonctionner.')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: 'revoke-api-key', keyId }) })
      setApiKeys(k => k.filter(key => key.id !== keyId))
      showToast('Clé révoquée.')
    } catch (e) { showToast(`❌ ${e.message}`, 'error') }
  }

  const copyKey = (key) => { navigator.clipboard.writeText(key); showToast('✅ Clé copiée !') }

  /* ── Getters ──────────────────────────────────────────────────────────── */
  const getEmail = (p) => emailIntegrations.find(i => i.provider === p)
  const getCal   = (p) => calendarIntegrations.find(i => i.provider === p)
  const getSmtp  = ()  => emailIntegrations.find(i => i.provider === 'smtp')
  const activeKey = apiKeys.find(k => k.is_active)?.key || ''

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
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100 text-lg">×</button>
        </div>
      )}

      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 shadow-sm z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">←</button>
            <div>
              <h1 className="text-base font-bold text-slate-900">🔌 Intégrations</h1>
              <p className="text-xs text-slate-400">Email, Calendrier et Sources de leads</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-10">

          {/* ══════════════════════════════════════════════════════════
              PARTIE 1 — SOURCES DE LEADS (WEBHOOKS)
          ══════════════════════════════════════════════════════════ */}
          <section className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">🎯 Sources de leads</h2>
                <p className="text-sm text-slate-500 mt-0.5">Centralisez vos leads depuis toutes vos plateformes marketing</p>
              </div>
            </div>

            {/* Clé API */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔑</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Votre clé API</p>
                  <p className="text-xs text-slate-500">Utilisée dans toutes les URLs de webhooks pour identifier votre espace</p>
                </div>
              </div>

              {apiKeys.filter(k => k.is_active).length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-3">Aucune clé API active. Générez-en une pour activer vos webhooks.</p>
                  <button onClick={generateApiKey} disabled={generatingKey}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors mx-auto">
                    {generatingKey ? '⏳ Génération…' : '✨ Générer une clé API'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.filter(k => k.is_active).map(key => (
                    <div key={key.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <code className="flex-1 text-xs font-mono text-slate-700 truncate">{key.key}</code>
                      <button onClick={() => copyKey(key.key)}
                        className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">📋 Copier</button>
                      <button onClick={() => revokeApiKey(key.id)}
                        className="px-2.5 py-1 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50 transition-colors">Révoquer</button>
                    </div>
                  ))}
                  <button onClick={generateApiKey} disabled={generatingKey}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
                    + Générer une nouvelle clé
                  </button>
                </div>
              )}
            </div>

            {/* Bannière info */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 text-xs text-indigo-700">
              <span className="text-base shrink-0">💡</span>
              <p>Chaque source reçoit une URL unique. Collez-la dans votre plateforme — les leads arrivent automatiquement, sont scorés par IA et déclenchent le contact automatique si score ≥ 70.</p>
            </div>

            {/* Cards sources */}
            <div className="grid grid-cols-1 gap-4">
              {LEAD_SOURCES.map(source => (
                <WebhookCard
                  key={source.id}
                  source={source}
                  webhookUrl={webhookBaseUrl}
                  apiKey={activeKey}
                  session={currentSession}
                />
              ))}
            </div>
          </section>

          <div className="border-t border-slate-200" />

          {/* ══════════════════════════════════════════════════════════
              PARTIE 2 — EMAIL
          ══════════════════════════════════════════════════════════ */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">📧 Email</h2>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-sm text-indigo-700">
              <span className="text-xl shrink-0">ℹ️</span>
              <p className="text-xs text-indigo-600">
                <strong>OAuth Google/Microsoft</strong> — emails depuis votre vraie boîte. &nbsp;|&nbsp;
                <strong>SMTP manuel</strong> — pour OVH, Ionos, Infomaniak, etc.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProviderCard icon="📨" name="Gmail"
                badge={<Badge ok={!!getEmail('google')} label={getEmail('google')?.email || 'Connecté'} />}
                email={getEmail('google')?.email}
                onConnect={() => connectProvider('google')}
                onDisconnect={() => disconnectProvider('google')}
                loading={actionLoading === 'google' || actionLoading === 'disconnect-google'}>
                <p className="text-xs text-slate-400">Emails envoyés depuis votre adresse Gmail. Scopes : Send + Read.</p>
              </ProviderCard>

              <ProviderCard icon="📬" name="Outlook / Microsoft 365"
                badge={<Badge ok={!!getEmail('microsoft')} label={getEmail('microsoft')?.email || 'Connecté'} />}
                email={getEmail('microsoft')?.email}
                onConnect={() => connectProvider('microsoft')}
                onDisconnect={() => disconnectProvider('microsoft')}
                loading={actionLoading === 'microsoft' || actionLoading === 'disconnect-microsoft'}>
                <p className="text-xs text-slate-400">Via Microsoft Graph API. Scopes : Mail.Send + Mail.Read.</p>
              </ProviderCard>
            </div>

            {/* SMTP */}
            {showSmtpForm && currentSession ? (
              <SmtpForm session={currentSession} existing={getSmtp()}
                onSaved={() => { setShowSmtpForm(false); showToast('✅ SMTP enregistré !'); loadStatus() }}
                onCancel={() => setShowSmtpForm(false)} />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📮</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">SMTP manuel</p>
                      {getSmtp()
                        ? <p className="text-xs text-slate-500">{getSmtp().smtp_host}:{getSmtp().smtp_port}</p>
                        : <p className="text-xs text-slate-400">OVH, Ionos, Infomaniak, Gandi, Hostinger…</p>}
                    </div>
                  </div>
                  {getSmtp() ? <Badge ok label="Configuré" /> : <Badge ok={false} />}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowSmtpForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors">
                    ⚙️ {getSmtp() ? 'Modifier' : 'Configurer manuellement'}
                  </button>
                  {getSmtp() && <button onClick={() => disconnectProvider('smtp')} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl">Déconnecter</button>}
                </div>
              </div>
            )}

            <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
              <summary className="flex items-center gap-2 cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors list-none">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                📋 Paramètres SMTP selon votre hébergeur
              </summary>
              <div className="px-5 pb-4 pt-2">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="border-b border-slate-200"><th className="text-left py-2 pr-4 font-semibold text-slate-600">Hébergeur</th><th className="text-left py-2 pr-4 font-semibold text-slate-600">Serveur SMTP</th><th className="text-left py-2 pr-4 font-semibold text-slate-600">Port</th><th className="text-left py-2 font-semibold text-slate-600">Chiffrement</th></tr></thead>
                  <tbody>
                    {SMTP_PROVIDERS.map(p => (
                      <tr key={p.name} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium text-slate-800">{p.name}</td>
                        <td className="py-2 pr-4 text-indigo-600 font-mono text-[11px]">{p.host}</td>
                        <td className="py-2 pr-4 text-slate-600">{p.port}</td>
                        <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.enc === 'SSL' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{p.enc}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          {/* ══════════════════════════════════════════════════════════
              PARTIE 3 — CALENDRIER
          ══════════════════════════════════════════════════════════ */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">📅 Calendrier</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProviderCard icon="🗓️" name="Google Calendar"
                badge={<Badge ok={!!getCal('google')} label="Connecté" />}
                email={getCal('google') ? 'Google Calendar actif' : null}
                onConnect={() => connectProvider('google')}
                onDisconnect={() => disconnectProvider('google')}
                loading={actionLoading === 'google' || actionLoading === 'disconnect-google'}>
                <p className="text-xs text-slate-400">Lecture des disponibilités + création d'événements. Inclus avec Gmail.</p>
              </ProviderCard>
              <ProviderCard icon="📋" name="Outlook Calendar"
                badge={<Badge ok={!!getCal('microsoft')} label="Connecté" />}
                email={getCal('microsoft') ? 'Outlook Calendar actif' : null}
                onConnect={() => connectProvider('microsoft')}
                onDisconnect={() => disconnectProvider('microsoft')}
                loading={actionLoading === 'microsoft' || actionLoading === 'disconnect-microsoft'}>
                <p className="text-xs text-slate-400">Via Microsoft Graph. Scopes : Calendars.ReadWrite.</p>
              </ProviderCard>
            </div>
          </section>

          {/* RDV */}
          {(eventsProvider || upcomingEvents.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">🗓️ Prochains RDV — {eventsProvider === 'google' ? 'Google Calendar' : 'Outlook'}</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                {upcomingEvents.length === 0
                  ? <p className="text-sm text-slate-400 text-center py-4">Aucun RDV à venir dans les 7 prochains jours.</p>
                  : <div className="divide-y divide-slate-100">{upcomingEvents.map(e => <EventRow key={e.id} event={e} />)}</div>
                }
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}
