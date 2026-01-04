import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useParams, useNavigate } from 'react-router-dom';

export default function Estimation() {
  const { agency_id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const [settings, setSettings] = useState({
    showBudget: true,
    showType: true,
    labelBudget: "Budget estimé",
    labelType: "Type de bien",
    agencyName: "LeadQualif IA",
    logoUrl: null
  });

  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    type_bien: 'Appartement',
    budget: '',
    surface: '',
    projet: 'Achat'
  });

  useEffect(() => {
    const fetchAgencySettings = async () => {
      if (!agency_id) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('agency_id, form_settings, plan')
          .eq('agency_id', agency_id)
          .single();
          
        if (data && data.form_settings) {
          setSettings(prev => ({
            ...prev,
            ...data.form_settings,
            agencyName: "Agence Partenaire"
          }));
        }
      } catch (err) {
        console.error("Erreur chargement réglages:", err);
      }
    };
    
    fetchAgencySettings();
  }, [agency_id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.from('leads').insert([
        {
          nom: formData.nom,
          email: formData.email,
          telephone: formData.telephone,
          type_bien: formData.type_bien,
          budget: formData.budget ? parseInt(formData.budget) : 0,
          surface: formData.surface ? parseInt(formData.surface) : 0,
          projet: formData.projet,
          statut: 'À traiter',
          agency_id: agency_id || null,
          created_at: new Date(),
          source: 'Formulaire Web'
        }
      ]);
      
      if (error) throw error;
      setSubmitted(true);
      
    } catch (err) {
      console.error("Erreur envoi:", err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Merci !</h1>
            <p className="text-lg text-gray-600 mb-8">
              Votre demande d'estimation a bien été enregistrée.<br />
              Un agent de {settings.agencyName} vous contactera dans les plus brefs délais.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({
                  nom: '',
                  email: '',
                  telephone: '',
                  type_bien: 'Appartement',
                  budget: '',
                  surface: '',
                  projet: 'Achat'
                });
              }}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Nouvelle estimation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.agencyName} className="w-12 h-12 rounded-lg object-contain bg-white p-1" />
            ) : (
              <span className="text-white font-bold text-2xl">LQ</span>
            )}
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-4">
            Estimez votre bien en 2 minutes
          </h1>
          {settings.agencyName && (
            <p className="text-lg text-blue-600 font-medium mb-2">
              Estimation pour {settings.agencyName}
            </p>
          )}
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Obtenez une estimation gratuite et sans engagement par un professionnel certifié
          </p>
          <div className="flex justify-center items-center space-x-4 mt-6">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
              🔒 RGPD Compliant
            </span>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              🇫🇷 Service France
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <form className="space-y-8" onSubmit={handleSubmit}>
            
            {settings.showType && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {settings.labelType}
                </label>
                <select
                  name="type_bien"
                  value={formData.type_bien}
                  onChange={handleChange}
                  className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl"
                >
                  <option>Appartement</option>
                  <option>Maison</option>
                  <option>Terrain</option>
                  <option>Local Commercial</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Surface (m²)</label>
              <input
                type="number"
                name="surface"
                required
                value={formData.surface}
                onChange={handleChange}
                className="mt-1 appearance-none block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {settings.showBudget && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {settings.labelBudget}
                </label>
                <div className="mt-1 relative rounded-xl shadow-sm">
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-xl"
                    placeholder="0"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">€</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-6 mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-4">Vos coordonnées</p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Nom complet</label>
                  <input 
                    type="text" 
                    name="nom" 
                    required 
                    value={formData.nom} 
                    onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Email</label>
                  <input 
                    type="email" 
                    name="email" 
                    required 
                    value={formData.email} 
                    onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Téléphone</label>
                  <input 
                    type="tel" 
                    name="telephone" 
                    required 
                    value={formData.telephone} 
                    onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {loading ? 'Envoi en cours...' : '📋 Recevoir mon estimation'}
              </button>
            </div>
            
            <p className="text-xs text-center text-gray-400 mt-4">
              Vos données sont sécurisées et traitées conformément au RGPD.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
