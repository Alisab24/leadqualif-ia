import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useParams } from 'react-router-dom';

export default function Estimation() {
  const { agency_id } = useParams();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [showClientPreview, setShowClientPreview] = useState(false);
  const [scoreData, setScoreData] = useState(null);

  // Réglages par défaut avec personnalisation SMMA/IMMO
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
    logoUrl: null,
    agencyType: "IMMO", // IMMO ou SMMA
    introText: "Obtenez une analyse précise de votre projet par notre intelligence artificielle",
    analysisLabel: "Analyse IA"
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

  // Fonction pour calculer la lecture métier
  const calculateBusinessInsights = (score, budget, delai) => {
    let priority = "Faible";
    let delay = "6+ mois";
    let potential = "0€";
    let action = "Relance";
    let priorityColor = "bg-gray-100 text-gray-700";

    if (score >= 80) {
      priority = "Élevé";
      delay = "1-2 semaines";
      potential = `${Math.round((budget || 0) * 0.02)}€`;
      action = "Appel immédiat";
      priorityColor = "bg-red-100 text-red-700";
    } else if (score >= 60) {
      priority = "Moyen";
      delay = "2-4 semaines";
      potential = `${Math.round((budget || 0) * 0.015)}€`;
      action = "RDV prioritaire";
      priorityColor = "bg-yellow-100 text-yellow-700";
    }

    return { priority, delay, potential, action, priorityColor };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("ID Agence:", agency_id);
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

      // Calcul des insights métier
      const insights = calculateBusinessInsights(scoreIA, parseInt(formData.budget) || 0, formData.delai);
      setScoreData({ score: scoreIA, insights });

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
      console.error("🔴 ERREUR CRITIQUE:", err);
      console.log("Données envoyées:", formData);
      setError(`Erreur technique: ${err.message || err.details || 'Inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white py-10 px-8 shadow-2xl shadow-blue-900/10 rounded-3xl border border-white/50 backdrop-blur-xl">
          
          {/* Header succès */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {settings.analysisLabel} lancée !
            </h1>
            <p className="text-lg text-gray-600 mb-2">
              Votre projet a été soumis à notre IA.<br />
              Un expert vous contactera rapidement.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Analyse prédictive de la probabilité de conversion
            </p>
          </div>

          {/* BLOC LECTURE MÉTIER */}
          {scoreData && (
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-6 mb-8 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                🔥 Lecture métier de votre projet
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Niveau de priorité</div>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${scoreData.insights.priorityColor}`}>
                    {scoreData.insights.priority}
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-xs font-semibold text-gray-500 mb-1">⏱ Délai estimé de closing</div>
                  <div className="text-lg font-bold text-slate-800">{scoreData.insights.delay}</div>
                </div>
                
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-xs font-semibold text-gray-500 mb-1">💰 Potentiel estimé</div>
                  <div className="text-lg font-bold text-green-600">{scoreData.insights.potential}</div>
                </div>
                
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-xs font-semibold text-gray-500 mb-1">🎯 Action recommandée</div>
                  <div className="text-sm font-bold text-blue-600">{scoreData.insights.action}</div>
                </div>
              </div>

              {/* Info-bulle score */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-blue-700">Score IA (Intention d'achat): {scoreData.score}%</span>
                  <span className="text-xs text-blue-600">• Score calculé automatiquement selon budget, urgence et engagement</span>
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowClientPreview(!showClientPreview)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center justify-center space-x-2"
            >
              <span>👁️</span>
              <span>{showClientPreview ? 'Masquer' : 'Aperçu client'}</span>
            </button>
            
            <button
              onClick={() => {
                setSubmitted(false);
                setScoreData(null);
                setShowClientPreview(false);
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
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              Nouvelle analyse
            </button>
          </div>

          {/* APERÇU CLIENT */}
          {showClientPreview && (
            <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
              <h3 className="text-lg font-bold text-green-800 mb-4">👁️ Aperçu Client</h3>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-green-800 mb-2">Votre projet est en cours d'analyse</h4>
                <p className="text-green-700 mb-4">
                  Un expert vous recontacte dans les plus brefs délais pour étudier votre projet en détail.
                </p>
                <div className="bg-white rounded-xl p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Prochaine étape :</strong> Un conseiller spécialisé vous appellera pour affiner votre recherche et vous présenter les meilleures opportunités correspondant à votre projet.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
              <div className="flex items-center justify-center space-x-2 text-blue-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium">{settings.analysisLabel} gratuite et sans engagement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header moderne avec personnalisation */}
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
            {settings.analysisLabel} Immédiate
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            {settings.introText}
          </p>
          
          <p className="text-sm text-gray-500 mb-8">
            Analyse prédictive de la probabilité de conversion
          </p>
          
          {settings.agencyName && settings.agencyName !== 'LeadQualif IA' && (
            <div className="mb-8">
              <span className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 px-6 py-3 rounded-full text-base font-semibold border border-slate-200 shadow-sm">
                {settings.analysisLabel} proposée par {settings.agencyName}
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
              ⚡ {settings.analysisLabel}
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
            
            {/* Info-bulle Score IA */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-blue-700">Score IA (Intention d'achat)</span>
                <span className="text-xs text-blue-600">• Score calculé automatiquement selon budget, urgence et engagement</span>
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-0.5 transition duration-200">
              {loading ? 'Analyse en cours...' : `Lancer l'${settings.analysisLabel.toLowerCase()} 🚀`}
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
