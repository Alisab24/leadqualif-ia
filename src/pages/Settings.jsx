import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { usePlanGuard, FeatureGate } from '../components/PlanGuard'

export default function Settings() {
  // --- ÉTATS ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Plan Guard
  const { userPlan, canAccess, getPlanName, getPlanColor } = usePlanGuard()

  // --- FORM DATA ---
  const [formData, setFormData] = useState({
    nom_agence: '',
    signataire: '',
    identifiant_fiscal: '',
    adresse_agence: '',
    telephone_agence: '',
    email_agence: '',
    site_web: '',
    logo_url: '',
    couleur_primaire: '#1e40af',
    couleur_secondaire: '#64748b',
    devise: 'FCFA',
    pays: 'Bénin'
  })

  // --- PARAMÈTRES AGENCE ---
  const [agencySettings, setAgencySettings] = useState({
    agency_name: '',
    responsible_name: '',
    logo_url: '',
    agency_id: ''
  })

  // --- TEMPLATES DE COMMUNICATION ---
  const [templates, setTemplates] = useState({
    whatsapp_template: '',
    email_template: '',
    calendly_link: ''
  })

  // --- PARAMÈTRES FORMULAIRE ---
  const [formSettings, setFormSettings] = useState({
    showBudget: true,
    showType: true,
    showLocation: true,
    labelBudget: 'Budget',
    labelType: 'Type de bien',
    labelLocation: 'Localisation'
  })

  // --- CHARGEMENT ---
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session non trouvée')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, plan')
        .eq('user_id', session.user.id)
        .single()

      if (profileError) {
        console.error('Erreur profil:', profileError)
        setError('Erreur de chargement du profil')
        return
      }

      setProfile(profileData)
      console.log('Plan actuel de l\'utilisateur (Settings) :', profileData.plan)
      setFormData({
        nom_agence: profileData.nom_agence || '',
        signataire: profileData.signataire || '',
        identifiant_fiscal: profileData.identifiant_fiscal || '',
        adresse_agence: profileData.adresse_agence || '',
        telephone_agence: profileData.telephone_agence || '',
        email_agence: profileData.email_agence || '',
        site_web: profileData.site_web || '',
        logo_url: profileData.logo_url || '',
        couleur_primaire: profileData.couleur_primaire || '#1e40af',
        couleur_secondaire: profileData.couleur_secondaire || '#64748b',
        devise: profileData.devise || 'FCFA',
        pays: profileData.pays || 'Bénin',
        plan: profileData.plan || 'starter'
      })

      // Charger les paramètres agence
      setAgencySettings({
        agency_name: profileData.nom_agence || '',
        responsible_name: profileData.signataire || '',
        logo_url: profileData.logo_url || '',
        agency_id: profileData.agency_id || ''
      })

      // Charger les templates de communication
      setTemplates({
        whatsapp_template: profileData.whatsapp_template || '',
        email_template: profileData.email_template || '',
        calendly_link: profileData.calendly_link || ''
      })

      // Charger les paramètres du formulaire
      setFormSettings({
        showBudget: profileData.form_settings?.showBudget ?? true,
        showType: profileData.form_settings?.showType ?? true,
        showLocation: profileData.form_settings?.showLocation ?? true,
        labelBudget: profileData.form_settings?.labelBudget || 'Budget',
        labelType: profileData.form_settings?.labelType || 'Type de bien',
        labelLocation: profileData.form_settings?.labelLocation || 'Localisation'
      })

    } catch (error) {
      console.error('Erreur loadProfile:', error)
      setError('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // --- SAUVEGARDE ---
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session non trouvée')
        return
      }

      // Nettoyage des données - aucune valeur undefined
      const dataToSave = {
        user_id: session.user.id,
        nom_agence: formData.nom_agence || '',
        signataire: formData.signataire || '',
        identifiant_fiscal: formData.identifiant_fiscal || '',
        adresse_agence: formData.adresse_agence || '',
        telephone_agence: formData.telephone_agence || '',
        email_agence: formData.email_agence || '',
        site_web: formData.site_web || '',
        logo_url: formData.logo_url || '',
        couleur_primaire: formData.couleur_primaire || '#1e40af',
        couleur_secondaire: formData.couleur_secondaire || '#64748b',
        devise: formData.devise || 'FCFA',
        pays: formData.pays || 'Bénin',
        plan: formData.plan || 'starter',
        // Templates de communication
        whatsapp_template: templates.whatsapp_template || '',
        email_template: templates.email_template || '',
        calendly_link: templates.calendly_link || '',
        // Paramètres du formulaire
        form_settings: formSettings
      }

      console.log('Données envoyées:', dataToSave)

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(dataToSave, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })

      if (upsertError) {
        console.error('Erreur upsert:', upsertError)
        setError(`Erreur lors de la sauvegarde: ${upsertError.message}`)
      } else {
        setSuccess('✅ Paramètres enregistrés avec succès !')
        // Mettre à jour le profil local
        setProfile({ ...profile, ...dataToSave })
      }

    } catch (error) {
      console.error('Erreur handleSave:', error)
      setError(`Erreur lors de la sauvegarde: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // --- CHANGEMENT FORMULAIRE ---
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // --- ÉTATS ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des paramètres...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⚙️ Paramètres</h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-gray-600">Personnalisez les informations de votre agence</p>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPlanColor()} bg-gray-100`}>
                Plan {getPlanName()}
              </span>
            </div>
          </div>
          <Link 
            to="/app" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            ← Retour au Dashboard
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✅</span>
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Paramètres Agence */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Paramètres de l'agence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'agence *
                </label>
                <input
                  type="text"
                  value={agencySettings.agency_name}
                  onChange={(e) => setAgencySettings({...agencySettings, agency_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Immobilier Pro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsable *
                </label>
                <input
                  type="text"
                  value={agencySettings.responsible_name}
                  onChange={(e) => setAgencySettings({...agencySettings, responsible_name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={agencySettings.logo_url}
                  onChange={(e) => setAgencySettings({...agencySettings, logo_url: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://exemple.com/logo.png"
                />
                <p className="text-xs text-gray-500 mt-1">URL du logo de votre agence</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID d'agence
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agencySettings.agency_id}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                    placeholder="ID généré automatiquement"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(agencySettings.agency_id)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    📋 Copier
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">ID unique pour votre lien d'estimation</p>
              </div>
            </div>
          </div>
          
          {/* Informations principales */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Informations légales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'agence (légal) *
                </label>
                <input
                  type="text"
                  name="nom_agence"
                  value={formData.nom_agence}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Immobilier Pro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du signataire (Gérant) *
                </label>
                <input
                  type="text"
                  name="signataire"
                  value={formData.signataire}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Identifiant Fiscal (IFU, SIRET...) *
                </label>
                <input
                  type="text"
                  name="identifiant_fiscal"
                  value={formData.identifiant_fiscal}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 01234567890123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  name="telephone_agence"
                  value={formData.telephone_agence}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 0612345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email_agence"
                  value={formData.email_agence}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@agence.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Web
                </label>
                <input
                  type="url"
                  name="site_web"
                  value={formData.site_web}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.agence.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL du Logo
                </label>
                <input
                  type="url"
                  name="logo_url"
                  value={formData.logo_url}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur Principale
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="couleur_primaire"
                    value={formData.couleur_primaire}
                    onChange={handleChange}
                    className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 font-mono">{formData.couleur_primaire}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur Secondaire
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="couleur_secondaire"
                    value={formData.couleur_secondaire}
                    onChange={handleChange}
                    className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 font-mono">{formData.couleur_secondaire}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Devise *
                </label>
                <select
                  name="devise"
                  value={formData.devise}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="FCFA">FCFA (CFA)</option>
                  <option value="€">€ (Euro)</option>
                  <option value="$">$ (Dollar)</option>
                  <option value="£">£ (Livre)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pays *
                </label>
                <select
                  name="pays"
                  value={formData.pays}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Bénin">Bénin</option>
                  <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                  <option value="Sénégal">Sénégal</option>
                  <option value="Togo">Togo</option>
                  <option value="Burkina Faso">Burkina Faso</option>
                  <option value="Mali">Mali</option>
                  <option value="Niger">Niger</option>
                  <option value="Guinée">Guinée</option>
                  <option value="Cameroun">Cameroun</option>
                  <option value="Congo">Congo</option>
                  <option value="RDC">RD Congo</option>
                  <option value="Gabon">Gabon</option>
                  <option value="Tchad">Tchad</option>
                  <option value="Centrafrique">Centrafrique</option>
                  <option value="France">France</option>
                  <option value="Belgique">Belgique</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Canada">Canada</option>
                  <option value="Maroc">Maroc</option>
                  <option value="Tunisie">Tunisie</option>
                  <option value="Algérie">Algérie</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
          </div>

          {/* Templates de Communication */}
          <FeatureGate 
            feature="templates" 
            fallback={
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="text-center">
                  <span className="text-2xl">🔒</span>
                  <h3 className="text-lg font-medium text-gray-900 mt-2">Templates PRO</h3>
                  <p className="text-gray-600 mt-1">
                    Les templates personnalisés sont disponibles dans le plan PRO.
                  </p>
                  <button 
                    onClick={() => window.open('/pricing', '_blank')}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Passer au plan PRO
                  </button>
                </div>
              </div>
            }
          >
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Templates de Communication</h2>
              <div className="space-y-6">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template WhatsApp
                  </label>
                  <textarea
                    value={templates.whatsapp_template}
                    onChange={(e) => setTemplates({...templates, whatsapp_template: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Bonjour {nom}, je suis {agent} de l'agence {agence}. Je vous contacte concernant votre projet immobilier..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Variables disponibles: {'{nom}'}, {'{agent}'}, {'{agence}'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Email
                  </label>
                  <textarea
                    value={templates.email_template}
                    onChange={(e) => setTemplates({...templates, email_template: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    placeholder="Bonjour {nom},&#10;&#10;Je suis {agent} de l'agence {agence} et je vous remercie pour votre intérêt..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Variables disponibles: {'{nom}'}, {'{agent}'}, {'{agence}'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lien Calendly
                  </label>
                  <input
                    type="url"
                    value={templates.calendly_link}
                    onChange={(e) => setTemplates({...templates, calendly_link: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://calendly.com/votre-agence"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lien pour la prise de RDV automatique (laissez vide pour Google Calendar par défaut)
                  </p>
                </div>
              </div>
            </div>
          </FeatureGate>

          {/* Configuration du Formulaire */}
          <FeatureGate 
            feature="templates" 
            fallback={
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="text-center">
                  <span className="text-2xl">🔒</span>
                  <h3 className="text-lg font-medium text-gray-900 mt-2">Formulaire Personnalisable PRO</h3>
                  <p className="text-gray-600 mt-1">
                    Personnalisez votre formulaire d'estimation dans le plan PRO.
                  </p>
                  <button 
                    onClick={() => window.open('/pricing', '_blank')}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Passer au plan PRO
                  </button>
                </div>
              </div>
            }
          >
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration du Formulaire</h2>
              <div className="space-y-6">
                
                {/* Toggles */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Champs à afficher</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Afficher le Budget</label>
                      <button
                        type="button"
                        onClick={() => setFormSettings({...formSettings, showBudget: !formSettings.showBudget})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formSettings.showBudget ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formSettings.showBudget ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Afficher le Type de bien</label>
                      <button
                        type="button"
                        onClick={() => setFormSettings({...formSettings, showType: !formSettings.showType})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formSettings.showType ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formSettings.showType ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Afficher la Localisation</label>
                      <button
                        type="button"
                        onClick={() => setFormSettings({...formSettings, showLocation: !formSettings.showLocation})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formSettings.showLocation ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formSettings.showLocation ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Labels personnalisés */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Labels personnalisés</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Label Budget
                      </label>
                      <input
                        type="text"
                        value={formSettings.labelBudget}
                        onChange={(e) => setFormSettings({...formSettings, labelBudget: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Budget"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Label Type de bien
                      </label>
                      <input
                        type="text"
                        value={formSettings.labelType}
                        onChange={(e) => setFormSettings({...formSettings, labelType: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Type de bien"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Label Localisation
                      </label>
                      <input
                        type="text"
                        value={formSettings.labelLocation}
                        onChange={(e) => setFormSettings({...formSettings, labelLocation: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Localisation"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FeatureGate>

          {/* Adresse */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Adresse</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse complète *
                </label>
                <input
                  type="text"
                  name="adresse_agence"
                  value={formData.adresse_agence}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Rue de l'Immobilier"
                />
              </div>
            </div>
          </div>

          {/* Bouton de sauvegarde */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  💾 Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Section Abonnement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          💎 Abonnement
        </h2>
        
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Plan Actuel</h3>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-600">Starter</span>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  Actif
                </span>
              </div>
              <p className="text-gray-600 mt-2">49€ / mois</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Prochain renouvellement</p>
              <p className="font-semibold text-gray-900">15 Février 2024</p>
            </div>
          </div>
          
          <div className="border-t border-blue-100 pt-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-gray-600">Utilisateurs</p>
                <p className="font-semibold">1 / 1 utilisé</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prospects</p>
                <p className="font-semibold">Illimité</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stockage</p>
                <p className="font-semibold">5 Go</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex gap-4">
          <button className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold">
            Mettre à jour mon offre
          </button>
          <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium">
            Voir les factures
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Comparer les plans →
          </a>
        </div>
      </div>

      {/* Informations supplémentaires */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Informations importantes</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Les champs marqués d'un * sont obligatoires</p>
          <p>• Ces informations seront utilisées dans tous vos documents (mandats, factures, etc.)</p>
          <p>• Le SIRET et l'IBAN sont requis pour les documents légaux</p>
          <p>• Vous pouvez modifier ces informations à tout moment</p>
        </div>
      </div>
    </div>
  )
}
