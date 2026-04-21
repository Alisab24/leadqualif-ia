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

const COLOR_PRESETS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#0f172a', '#475569',
]

const TABS = [
  { key: 'identity',      icon: '🏢', label: 'Agence',        configKey: 'identity' },
  { key: 'apparence',     icon: '🎨', label: 'Apparence',      configKey: 'apparence' },
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

  // Apparence state (profiles table)
  const [appearance, setAppearance]         = useState({
    logo_url: '', signature_url: '', ville_agence: '',
    couleur_primaire: '#2563eb', couleur_secondaire: '#7c3aed',
  })
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  const setApp = (key, val) => setAppearance(p => ({ ...p, [key]: val }))

  // Upload image → base64 dataURL
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSig, setUploadingSig]   = useState(false)

  const handleImageUpload = (file, fieldKey, stateSetter, loadingSetter) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return alert('Format non supporté. Utilisez JPG, PNG, SVG ou GIF.')
    if (file.size > 1024 * 1024) return alert('Image trop lourde (max 1 Mo). Compressez-la avant de l\'importer.')
    loadingSetter(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      stateSetter(p => ({ ...p, [fieldKey]: e.target.result }))
      loadingSetter(false)
    }
    reader.onerror = () => { alert('Erreur de lecture du fichier.'); loadingSetter(false) }
    reader.readAsDataURL(file)
  }

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
    // Agent IA
    anthropic_api_key: '',
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

        // Charger apparence + calendly_link depuis profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('logo_url, signature_url, ville_agence, couleur_primaire, couleur_secondaire, calendly_link')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (profileData) {
          setAppearance(prev => ({
            logo_url:          profileData.logo_url          || prev.logo_url,
            signature_url:     profileData.signature_url     || prev.signature_url,
            ville_agence:      profileData.ville_agence      || prev.ville_agence,
            couleur_primaire:  profileData.couleur_primaire  || prev.couleur_primaire,
            couleur_secondaire:profileData.couleur_secondaire|| prev.couleur_secondaire,
          }))
          setConfigured(c => ({ ...c, apparence: !!(profileData.logo_url || profileData.couleur_primaire) }))
          // Priorité : booking_link de workspace_settings, sinon calendly_link du profil
          if (profileData.calendly_link) {
            setForm(prev => ({ ...prev, booking_link: prev.booking_link || profileData.calendly_link }))
          }
        }
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

      // Synchroniser calendly_link dans profiles (lu par la fiche lead CRM)
      if (form.booking_link !== undefined) {
        await supabase.from('profiles')
          .update({ calendly_link: form.booking_link || null })
          .eq('user_id', session.user.id)
      }

      setSaveOk(true)
      // Recalculer configured
      setConfigured({
        identity:      !!(form.agency_name),
        email:         true, // Configuré via Intégrations (OAuth/SMTP) ou Resend fallback
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

  /* ── Sauvegarder Apparence ───────────────────────────────────────────── */
  const saveAppearance = async () => {
    setAppearanceSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('profiles').update({
        logo_url:           appearance.logo_url           || null,
        signature_url:      appearance.signature_url      || null,
        ville_agence:       appearance.ville_agence       || null,
        couleur_primaire:   appearance.couleur_primaire   || '#2563eb',
        couleur_secondaire: appearance.couleur_secondaire || '#7c3aed',
      }).eq('user_id', session.user.id)
      if (error) throw error
      setSaveOk(true)
      setConfigured(c => ({ ...c, apparence: !!(appearance.logo_url || appearance.couleur_primaire) }))
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e) {
      alert(`❌ ${e.message}`)
    } finally {
      setAppearanceSaving(false)
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

                <Field label="Logo de l'agence" hint="Importez depuis votre PC ou collez une URL (JPG, PNG, SVG — max 1 Mo)">
                  <div className="flex gap-2">
                    <Input value={form.agency_logo_url?.startsWith('data:') ? '(image importée depuis votre PC)' : form.agency_logo_url}
                      readOnly={form.agency_logo_url?.startsWith('data:')}
                      onChange={e => set('agency_logo_url', e.target.value)}
                      placeholder="https://monsite.com/logo.png" />
                    <label className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border cursor-pointer transition-colors ${
                      uploadingLogo ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    }`}>
                      {uploadingLogo ? '⏳' : '📁'} {uploadingLogo ? 'Import…' : 'Importer'}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => handleImageUpload(e.target.files?.[0], 'agency_logo_url', setForm, setUploadingLogo)} />
                    </label>
                  </div>
                  {form.agency_logo_url && (
                    <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200 w-fit">
                      <img src={form.agency_logo_url} alt="Logo preview" className="h-12 w-auto rounded-lg object-contain"
                        onError={e => e.target.style.display='none'} />
                      <div>
                        <p className="text-xs font-medium text-slate-600">Aperçu logo</p>
                        {form.agency_logo_url?.startsWith('data:') && (
                          <button type="button" onClick={() => set('agency_logo_url', '')}
                            className="text-[11px] text-red-500 hover:underline mt-0.5">Supprimer</button>
                        )}
                      </div>
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

            {/* ═══ ONGLET APPARENCE ════════════════════════════ */}
            {activeTab === 'apparence' && (
              <div className="space-y-6">

                {/* Bandeau info */}
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700">
                  🎨 Ces réglages alimentent vos <strong>documents générés</strong> (devis, factures, contrats) et le formulaire public de qualification.
                </div>

                {/* Logo */}
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                  <h2 className="text-base font-bold text-slate-800">🖼️ Logo de l'agence</h2>
                  <Field label="Logo" hint="Importez depuis votre PC ou collez une URL (PNG, SVG, JPG — max 1 Mo). Apparaît dans les documents PDF.">
                    <div className="flex gap-2">
                      <Input value={appearance.logo_url?.startsWith('data:') ? '(image importée depuis votre PC)' : appearance.logo_url}
                        readOnly={appearance.logo_url?.startsWith('data:')}
                        onChange={e => setApp('logo_url', e.target.value)}
                        placeholder="https://monsite.com/logo.png" />
                      <label className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border cursor-pointer transition-colors ${
                        uploadingLogo ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                      }`}>
                        {uploadingLogo ? '⏳' : '📁'} {uploadingLogo ? 'Import…' : 'Importer'}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => handleImageUpload(e.target.files?.[0], 'logo_url', setAppearance, setUploadingLogo)} />
                      </label>
                    </div>
                    {appearance.logo_url && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 inline-flex items-center gap-3 w-fit">
                        <img src={appearance.logo_url} alt="Logo" className="h-14 object-contain"
                          onError={e => e.target.style.display = 'none'} />
                        <div>
                          <p className="text-xs font-medium text-slate-600">Aperçu logo</p>
                          {appearance.logo_url?.startsWith('data:') && (
                            <button type="button" onClick={() => setApp('logo_url', '')}
                              className="text-[11px] text-red-500 hover:underline mt-0.5">Supprimer</button>
                          )}
                        </div>
                      </div>
                    )}
                  </Field>
                </section>

                {/* Signature + ville */}
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                  <h2 className="text-base font-bold text-slate-800">📄 Documents légaux</h2>
                  <Field label="Ville (pour les documents)" hint="Utilisée dans « Fait à ___, le … » des contrats et devis.">
                    <Input value={appearance.ville_agence} onChange={e => setApp('ville_agence', e.target.value)}
                      placeholder="ex : Paris, Lyon, Casablanca…" />
                  </Field>
                  <Field label="Signature" hint="Importez votre signature depuis votre PC ou collez une URL. PNG fond transparent recommandé.">
                    <div className="flex gap-2">
                      <Input value={appearance.signature_url?.startsWith('data:') ? '(signature importée depuis votre PC)' : appearance.signature_url}
                        readOnly={appearance.signature_url?.startsWith('data:')}
                        onChange={e => setApp('signature_url', e.target.value)}
                        placeholder="https://monsite.com/signature.png" />
                      <label className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border cursor-pointer transition-colors ${
                        uploadingSig ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                      }`}>
                        {uploadingSig ? '⏳' : '✍️'} {uploadingSig ? 'Import…' : 'Importer'}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => handleImageUpload(e.target.files?.[0], 'signature_url', setAppearance, setUploadingSig)} />
                      </label>
                    </div>
                    {appearance.signature_url && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 inline-block w-fit">
                        <p className="text-xs text-slate-400 mb-2">Aperçu signature :</p>
                        <img src={appearance.signature_url} alt="Signature" className="h-16 object-contain"
                          onError={e => e.target.style.display = 'none'} />
                        {appearance.signature_url?.startsWith('data:') && (
                          <button type="button" onClick={() => setApp('signature_url', '')}
                            className="block text-[11px] text-red-500 hover:underline mt-1">Supprimer</button>
                        )}
                      </div>
                    )}
                  </Field>
                </section>

                {/* Couleurs */}
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                  <h2 className="text-base font-bold text-slate-800">🎨 Couleurs de la marque</h2>
                  <p className="text-xs text-slate-400">Utilisées dans le formulaire public et les documents générés.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Couleur primaire */}
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-3">Couleur primaire</p>
                      <div className="flex items-center gap-3 mb-3">
                        <input type="color" value={appearance.couleur_primaire}
                          onChange={e => setApp('couleur_primaire', e.target.value)}
                          className="h-10 w-14 p-0.5 border border-slate-200 rounded-lg cursor-pointer" />
                        <Input value={appearance.couleur_primaire}
                          onChange={e => setApp('couleur_primaire', e.target.value)}
                          placeholder="#2563eb" />
                        <div className="w-10 h-10 rounded-lg border border-slate-200 shrink-0"
                          style={{ backgroundColor: appearance.couleur_primaire }} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.map(c => (
                          <button key={c} type="button"
                            onClick={() => setApp('couleur_primaire', c)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                              appearance.couleur_primaire === c ? 'border-slate-800 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>

                    {/* Couleur secondaire */}
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-3">Couleur secondaire</p>
                      <div className="flex items-center gap-3 mb-3">
                        <input type="color" value={appearance.couleur_secondaire}
                          onChange={e => setApp('couleur_secondaire', e.target.value)}
                          className="h-10 w-14 p-0.5 border border-slate-200 rounded-lg cursor-pointer" />
                        <Input value={appearance.couleur_secondaire}
                          onChange={e => setApp('couleur_secondaire', e.target.value)}
                          placeholder="#7c3aed" />
                        <div className="w-10 h-10 rounded-lg border border-slate-200 shrink-0"
                          style={{ backgroundColor: appearance.couleur_secondaire }} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.map(c => (
                          <button key={c} type="button"
                            onClick={() => setApp('couleur_secondaire', c)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                              appearance.couleur_secondaire === c ? 'border-slate-800 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Aperçu — En-tête formulaire public</p>
                    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <div className="h-2" style={{ background: `linear-gradient(to right, ${appearance.couleur_primaire}, ${appearance.couleur_secondaire})` }} />
                      <div className="p-4 bg-white flex items-center gap-3">
                        {appearance.logo_url
                          ? <img src={appearance.logo_url} alt="Logo" className="h-10 object-contain"
                              onError={e => e.target.style.display = 'none'} />
                          : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                              style={{ background: appearance.couleur_primaire }}>A</div>
                        }
                        <div>
                          <p className="text-sm font-bold text-slate-800">{form.agency_name || 'Nom de votre agence'}</p>
                          <p className="text-xs font-medium" style={{ color: appearance.couleur_primaire }}>🏢 Agence</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bouton sauvegarder apparence */}
                  <button onClick={saveAppearance} disabled={appearanceSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700
                               text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                    {appearanceSaving ? '⏳ Sauvegarde…' : '💾 Sauvegarder l\'apparence'}
                  </button>
                </section>

              </div>
            )}

            {/* ═══ ONGLET EMAIL ════════════════════════════════ */}
            {activeTab === 'email' && (
              <section className="space-y-4">

                {/* Bannière principale → Intégrations */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-start gap-4">
                  <span className="text-3xl shrink-0">🔌</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-indigo-800 mb-1">Configurez votre email dans Intégrations</p>
                    <p className="text-xs text-indigo-600 mb-3">
                      Connectez <strong>Gmail</strong>, <strong>Outlook</strong> (OAuth — les emails apparaissent dans vos "Envoyés")
                      ou configurez votre <strong>SMTP</strong> (OVH, Ionos, Infomaniak, Gandi…).
                      Les emails seront envoyés depuis votre vraie adresse.
                    </p>
                    <button onClick={() => navigate('/settings/integrations')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700
                                 text-white text-sm font-semibold rounded-xl transition-colors">
                      🔗 Ouvrir les Intégrations
                    </button>
                  </div>
                </div>

                {/* Signature — utile pour tous les modes d'envoi */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-800">✍️ Signature email</h2>
                  <p className="text-xs text-slate-400">Ajoutée automatiquement en bas de chaque email, quel que soit le mode d'envoi (OAuth, SMTP ou Resend).</p>
                  <Field label="Signature">
                    <Textarea value={form.email_signature}
                      onChange={e => set('email_signature', e.target.value)}
                      placeholder="Cordialement,&#10;Marie Dupont — Agence XYZ&#10;📞 06 12 34 56 78" />
                  </Field>
                </div>

                {/* Resend — fallback uniquement */}
                <details className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <summary className="flex items-center justify-between cursor-pointer px-6 py-4 hover:bg-slate-50 transition-colors list-none">
                    <div className="flex items-center gap-3">
                      <span className="text-base">⚙️</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Resend API <span className="text-xs font-normal text-slate-400 ml-1">(fallback uniquement)</span></p>
                        <p className="text-xs text-slate-400">Utilisé si aucun OAuth ni SMTP n'est configuré dans Intégrations</p>
                      </div>
                    </div>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                  </summary>
                  <div className="px-6 pb-6 pt-2 space-y-4 border-t border-slate-100">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
                      ⚠️ Avec Resend, les emails partent depuis une adresse générique (pas votre vraie boîte). Préférez OAuth ou SMTP.
                      Clé API sur <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="font-semibold underline">resend.com/api-keys</a>
                    </div>

                    <Field label="Clé API Resend" hint="Commence par re_...">
                      <Input type="password" value={form.resend_api_key}
                        onChange={e => set('resend_api_key', e.target.value)}
                        placeholder="re_••••••••••••••••••••••••" autoComplete="off" />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Email d'envoi fallback">
                        <Input value={form.from_email} onChange={e => set('from_email', e.target.value)}
                          placeholder="contact@monagence.com" type="email" />
                      </Field>
                      <Field label="Nom affiché fallback">
                        <Input value={form.from_name} onChange={e => set('from_name', e.target.value)}
                          placeholder='Marie — Agence XYZ' />
                      </Field>
                    </div>

                    {/* Test Resend */}
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <p className="text-sm font-semibold text-slate-700">🧪 Tester Resend</p>
                      <div className="flex gap-2">
                        <Input value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)}
                          placeholder="destinataire@test.com" type="email" />
                        <button onClick={testEmail} disabled={testEmailLoading || !testEmailTo || !form.resend_api_key}
                          className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                                     rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap">
                          {testEmailLoading ? '⏳' : '📤 Tester'}
                        </button>
                      </div>
                      <TestResult result={testEmailResult} />
                    </div>
                  </div>
                </details>

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

            {/* ═══ ONGLET AGENT IA — clé Anthropic ════════════ */}
            {activeTab === 'notifications' && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 mt-2">
                <h2 className="text-base font-bold text-slate-800">🤖 Agent IA — Clé Anthropic</h2>
                <p className="text-xs text-slate-400">
                  Utilisée par l'agent IA pour générer des messages personnalisés (WhatsApp + Email).
                  Obtenez votre clé sur{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
                    className="text-indigo-600 hover:underline font-semibold">console.anthropic.com</a>.
                </p>

                <Field label="Clé API Anthropic" hint="Commence par sk-ant-...">
                  <Input
                    type="password"
                    value={form.anthropic_api_key}
                    onChange={e => set('anthropic_api_key', e.target.value)}
                    placeholder="sk-ant-••••••••••••••••••••••••"
                    autoComplete="off"
                  />
                </Field>

                {form.anthropic_api_key && !form.anthropic_api_key.startsWith('••') && (
                  <p className="text-xs text-green-600 font-semibold">✅ Nouvelle clé saisie — sera sauvegardée à l'enregistrement</p>
                )}
                {form.anthropic_api_key?.startsWith('••') && (
                  <p className="text-xs text-slate-500">🔒 Clé déjà configurée (masquée). Saisissez une nouvelle valeur pour la remplacer.</p>
                )}
              </section>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
