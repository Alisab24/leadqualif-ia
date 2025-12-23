import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Settings = () => {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({
    calendlyUrl: import.meta.env.VITE_CALENDLY_URL || '',
    notifications: true,
    autoQualify: true
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSave = () => {
    // Ici, vous pourriez sauvegarder les paramètres dans Supabase ou localStorage
    localStorage.setItem('leadqualif_settings', JSON.stringify(settings))
    alert('Paramètres sauvegardés avec succès!')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
              <p className="text-sm text-gray-500 mt-1">Configurez votre application</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              Retour au dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="card space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration Calendly</h2>
            <div>
              <label htmlFor="calendlyUrl" className="block text-sm font-medium text-gray-700 mb-1">
                URL Calendly
              </label>
              <input
                type="url"
                id="calendlyUrl"
                name="calendlyUrl"
                value={settings.calendlyUrl}
                onChange={handleChange}
                className="input-field"
                placeholder="https://calendly.com/votre-compte"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cette URL sera utilisée pour le bouton "Proposer un RDV"
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Préférences</h2>
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="notifications"
                  checked={settings.notifications}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-3 text-sm text-gray-700">Activer les notifications</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="autoQualify"
                  checked={settings.autoQualify}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-3 text-sm text-gray-700">Qualification automatique via IA</span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Variables d'environnement</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Supabase URL:</span>
                <span className="font-mono text-xs text-gray-900">
                  {import.meta.env.VITE_SUPABASE_URL ? '✓ Configuré' : '✗ Non configuré'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">OpenAI API Key:</span>
                <span className="font-mono text-xs text-gray-900">
                  {import.meta.env.VITE_OPENAI_API_KEY ? '✓ Configuré' : '✗ Non configuré'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Configurez ces variables dans votre fichier .env à la racine du projet
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button onClick={handleSave} className="btn-primary">
              Enregistrer les paramètres
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Settings

