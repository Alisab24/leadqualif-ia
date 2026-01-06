import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useParams } from 'react-router-dom';

export default function Estimation() {
  const { agency_id } = useParams();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Réglages par défaut
  const [settings, setSettings] = useState({
    showBudget: true,
    showType: true,
    showDelai: true,
    showMsg: true,
    labelBudget: "Budget estimé",
    labelType: "Type de bien",
    labelDelai: "Délai du projet",
    labelMsg: "Message / Précisions",
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
    projet: 'Achat',
    delai: 'Indéfini',
    message: ''
  });

  // Chargement config Agence
  useEffect(() => {
    const fetchSettings = async () => {
      if (!agency_id) return;
      try {
        const { data } = await supabase.from('profiles').select('form_settings, agency_id, nom_agence, logo_url').eq('agency_id', agency_id).single();
        if (data?.form_settings) {
          setSettings(prev => ({ 
            ...prev, 
            ...data.form_settings,
            agencyName: data.nom_agence || 'LeadQualif IA',
            logoUrl: data.logo_url || null
          }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, [agency_id]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("ID Agence:", agency_id); // Pour vérifier qu'on a bien l'ID
    setLoading(true);
    try {
      // --- ALGORITHME DE SCORING LEADQUALIF IA ---
      let scoreIA = 30; // Score de base (Intérêt manifesté)
      
      // 1. Critère Budget (Le nerf de la guerre)
      if (formData.budget > 0) scoreIA += 20;
      if (formData.budget > 200000) scoreIA += 10; // Bonus gros budget
      
      // 2. Critère Urgence (Délai)
      if (formData.delai === 'Urgent (Immédiat)') scoreIA += 30;
      else if (formData.delai === 'Dans les 3 mois') scoreIA += 15;
      else if (formData.delai === 'Projet indéfini') scoreIA -= 10;
      
      // 3. Critère Complétude
      if (formData.message && formData.message.length > 10) scoreIA += 10; // A pris le temps d'écrire
      if (formData.telephone && formData.telephone.length >= 10) scoreIA += 10;
      
      // Plafond à 99% (Nul n'est parfait)
      if (scoreIA > 99) scoreIA = 99;
      if (scoreIA < 10) scoreIA = 10;
      // -------------------------------------------

      const { error } = await supabase.from('leads').insert([{
        ...formData,
        budget: formData.budget ? parseInt(formData.budget) : 0,
        surface: formData.surface ? parseInt(formData.surface) : 0,
        score: scoreIA, // Score IA ajouté
        statut: 'À traiter',
        created_at: new Date(),
        agency_id: agency_id || null,
        source: 'Formulaire Web IA'
      }]);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error("🔴 ERREUR CRITIQUE:", err); // Le log important
      console.log("Données envoyées:", formData); // Pour vérifier les champs
      setError(`Erreur technique: ${err.message || err.details || 'Inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white py-10 px-8 shadow-2xl shadow-blue-900/10 rounded-3xl border border-white/50 backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Analyse lancée !</h1>
          <p className="text-lg text-gray-600 mb-8">
            Votre projet a été soumis à notre IA.<br />
            Un expert vous contactera rapidement.
          </p>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center space-x-2 text-blue-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium">Analyse IA gratuite et sans engagement</span>
            </div>
          </div>
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
                projet: 'Achat',
                delai: 'Indéfini',
                message: ''
              });
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
          >
            Nouvelle analyse
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header moderne */}
        <div className="text-center mb-12">
          {settings.logoUrl ? (
            <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl shadow-lg p-3 flex items-center justify-center">
              <img 
                src={settings.logoUrl} 
                alt={settings.agencyName}
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div 
                className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
                style={{ display: 'none' }}
              >
                {settings.agencyName?.substring(0, 2).toUpperCase() || 'LQ'}
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <span className="text-white font-bold text-3xl">LQ</span>
            </div>
          )}
          
          <h1 className="text-5xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Analyse IA Immédiate
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Obtenez une analyse précise de votre projet par notre intelligence artificielle
          </p>
          
          {settings.agencyName && settings.agencyName !== 'LeadQualif IA' && (
            <div className="mb-8">
              <span className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 px-6 py-3 rounded-full text-base font-semibold border border-slate-200 shadow-sm">
                Proposé par {settings.agencyName}
              </span>
            </div>
          )}
          
          <div className="flex justify-center items-center space-x-3 mb-8">
            <span className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-4 py-2 rounded-full text-sm font-semibold border border-green-200">
              🔒 RGPD Compliant
            </span>
            <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-200">
              🇫🇷 Service France
            </span>
            <span className="bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 px-4 py-2 rounded-full text-sm font-semibold border border-purple-200">
              ⚡ Analyse IA
            </span>
          </div>
          
          <div className="flex justify-center">
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
              Powered by LeadQualif AI
            </span>
          </div>
        </div>

        <div className="bg-white py-10 px-8 shadow-2xl shadow-blue-900/10 rounded-3xl border border-white/50 backdrop-blur-xl">
          {error && <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">{error}</div>}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Grid 2 colonnes pour desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {settings.showType && (
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">{settings.labelType}</label>
                  <select name="type_bien" value={formData.type_bien} onChange={handleChange} className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-sm">
                    <option>Appartement</option>
                    <option>Maison</option>
                    <option>Terrain</option>
                    <option>Local</option>
                  </select>
                </div>
              )}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-1">Surface (m²)</label>
                <input type="number" name="surface" required value={formData.surface} onChange={handleChange} className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-sm" placeholder="Ex: 85" />
              </div>
              {settings.showBudget && (
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">{settings.labelBudget}</label>
                  <div className="relative">
                    <input type="number" name="budget" value={formData.budget} onChange={handleChange} className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-sm pl-4" placeholder="Votre budget max..." />
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 font-bold">€</div>
                  </div>
                </div>
              )}
              {settings.showDelai && (
                 <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-bold text-slate-700 mb-1">{settings.labelDelai}</label>
                   <select name="delai" value={formData.delai} onChange={handleChange} className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-sm">
                     <option>Urgent (Immédiat)</option>
                     <option>Dans les 3 mois</option>
                     <option>Dans les 6 mois</option>
                     <option>Projet indéfini</option>
                   </select>
                 </div>
              )}
            </div>
            {/* Message (Full width) */}
            {settings.showMsg && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">{settings.labelMsg}</label>
                <textarea name="message" rows="3" value={formData.message} onChange={handleChange} className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-sm" placeholder="Précisez votre recherche..."></textarea>
              </div>
            )}
            <div className="border-t border-slate-100 pt-6 mt-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Vos Coordonnées</p>
              <div className="space-y-4">
                <input type="text" name="nom" required value={formData.nom} onChange={handleChange} placeholder="Nom complet" className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 focus:ring-2 focus:ring-blue-500 transition" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="Email" className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 focus:ring-2 focus:ring-blue-500 transition" />
                  <input type="tel" name="telephone" required value={formData.telephone} onChange={handleChange} placeholder="Téléphone" className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 focus:ring-2 focus:ring-blue-500 transition" />
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-0.5 transition duration-200">
              {loading ? 'Analyse en cours...' : 'Lancer l\'analyse IA 🚀'}
            </button>
          </form>
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} LeadQualif System • Données sécurisées
        </p>
      </div>
    </div>
  );
}
