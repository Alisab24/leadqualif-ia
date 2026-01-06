import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  // État global
  const [formData, setFormData] = useState({
    nom_agence: '',
    email: '',
    telephone: '',
    adresse: '',
    calendly_link: '',
    logo_url: '',
    couleur_primaire: '#2563eb',
    form_settings: {
      showBudget: true,
      showType: true,
      showDelai: true,
      agencyName: ''
    }
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setFormData({
          nom_agence: data.nom_agence || '',
          email: user.email,
          telephone: data.telephone || '',
          adresse: data.adresse || '',
          calendly_link: data.calendly_link || '',
          logo_url: data.logo_url || '',
          couleur_primaire: data.couleur_primaire || '#2563eb',
          form_settings: data.form_settings || {
            showBudget: true,
            showType: true,
            showDelai: true
          }
        });
      }
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (key) => {
    setFormData(prev => ({
      ...prev,
      form_settings: {
        ...prev.form_settings,
        [key]: !prev.form_settings[key]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nom_agence: formData.nom_agence,
          telephone: formData.telephone,
          adresse: formData.adresse,
          calendly_link: formData.calendly_link,
          logo_url: formData.logo_url,
          couleur_primaire: formData.couleur_primaire,
          form_settings: formData.form_settings
        })
        .eq('user_id', userId);

      if (error) throw error;
      alert('✅ Paramètres sauvegardés avec succès !');
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Chargement des paramètres...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">⚙️ Paramètres de l'Agence</h1>
          <p className="text-slate-600">Configurez votre profil et personnalisez votre expérience</p>
        </div>

        {/* Navigation Onglets */}
        <div className="flex gap-4 border-b border-slate-200 mb-6">
          <button 
            onClick={() => setActiveTab('general')} 
            className={`pb-2 px-4 font-medium transition ${
              activeTab === 'general' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            🏢 Général
          </button>
          <button 
            onClick={() => setActiveTab('visuel')} 
            className={`pb-2 px-4 font-medium transition ${
              activeTab === 'visuel' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            🎨 Apparence
          </button>
          <button 
            onClick={() => setActiveTab('form')} 
            className={`pb-2 px-4 font-medium transition ${
              activeTab === 'form' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            📝 Formulaire Estimation
          </button>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          
          {/* ONGLET GÉNÉRAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Nom de l'agence</label>
                  <input 
                    name="nom_agence" 
                    value={formData.nom_agence} 
                    onChange={handleChange} 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Téléphone</label>
                  <input 
                    name="telephone" 
                    value={formData.telephone} 
                    onChange={handleChange} 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Adresse</label>
                <input 
                  name="adresse" 
                  value={formData.adresse} 
                  onChange={handleChange} 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="block text-sm font-bold text-blue-800 mb-1">Lien Calendly / Prise de RDV</label>
                <input 
                  name="calendly_link" 
                  value={formData.calendly_link} 
                  onChange={handleChange} 
                  placeholder="https://calendly.com/..." 
                  className="w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
                <p className="text-xs text-blue-600 mt-1">Sert pour le bouton "Prendre RDV" sur vos leads.</p>
              </div>
            </div>
          )}

          {/* ONGLET VISUEL */}
          {activeTab === 'visuel' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">URL du Logo</label>
                <input 
                  name="logo_url" 
                  value={formData.logo_url} 
                  onChange={handleChange} 
                  placeholder="https://..." 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
                {formData.logo_url && (
                  <img 
                    src={formData.logo_url} 
                    alt="Logo Preview" 
                    className="h-16 mt-2 object-contain border p-1 rounded" 
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Couleur Principale</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    name="couleur_primaire" 
                    value={formData.couleur_primaire} 
                    onChange={handleChange} 
                    className="h-10 w-20 p-1 border border-slate-300 rounded" 
                  />
                  <span className="text-sm text-slate-500">{formData.couleur_primaire}</span>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET FORMULAIRE */}
          {activeTab === 'form' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-4">Personnalisez le formulaire que vos clients voient.</p>
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="font-medium">Demander le Budget</span>
                <input 
                  type="checkbox" 
                  checked={formData.form_settings?.showBudget} 
                  onChange={() => handleToggle('showBudget')} 
                  className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                />
              </div>
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="font-medium">Demander le Type de bien</span>
                <input 
                  type="checkbox" 
                  checked={formData.form_settings?.showType} 
                  onChange={() => handleToggle('showType')} 
                  className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                />
              </div>
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="font-medium">Demander le Délai</span>
                <input 
                  type="checkbox" 
                  checked={formData.form_settings?.showDelai} 
                  onChange={() => handleToggle('showDelai')} 
                  className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                />
              </div>
            </div>
          )}

          {/* BOUTON SAUVEGARDE */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
