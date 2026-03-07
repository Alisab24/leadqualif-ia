import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { redirectToCheckout, openBillingPortal, PLAN_LABELS, PLAN_COLORS, STATUS_LABELS } from '../services/stripeService';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  // === Stripe ===
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    status: 'inactive',
    plan: 'free',
    current_period_end: null,
  });
  // Plan à auto-déclencher une fois le profil chargé (vient de la landing page)
  const [pendingPlan, setPendingPlan] = useState(null);

  // Détecter les params URL au montage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('subscription') === 'success') {
      const plan = params.get('plan') || 'growth';
      alert(`✅ Abonnement ${plan.toUpperCase()} activé ! Bienvenue sur LeadQualif.`);
      window.history.replaceState({}, '', '/settings?tab=facturation');
      setActiveTab('facturation');
      return;
    }
    if (params.get('canceled') === 'true') {
      setActiveTab('facturation');
      window.history.replaceState({}, '', '/settings?tab=facturation');
      return;
    }
    if (params.get('tab')) {
      setActiveTab(params.get('tab'));
    }
    // Plan depuis la landing page → stocker, nettoyer l'URL
    const planParam = params.get('plan');
    if (planParam && ['starter', 'growth', 'enterprise'].includes(planParam)) {
      setPendingPlan(planParam);
      setActiveTab('facturation');
      window.history.replaceState({}, '', '/settings?tab=facturation');
    }
    // Vérifier aussi sessionStorage (filet de sécurité)
    const storedPlan = sessionStorage.getItem('pendingPlan');
    if (storedPlan && ['starter', 'growth', 'enterprise'].includes(storedPlan)) {
      setPendingPlan(storedPlan);
      sessionStorage.removeItem('pendingPlan');
      setActiveTab('facturation');
    }
  }, []);

  // Auto-déclencher le checkout dès que profil chargé + email dispo + plan en attente
  useEffect(() => {
    if (!loading && pendingPlan && userEmail && userId) {
      const plan = pendingPlan;
      setPendingPlan(null); // reset pour éviter double-déclenchement
      handleSubscribeWithEmail(plan, userEmail, userId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingPlan, userEmail, userId]);

  // État global
  const [formData, setFormData] = useState({
    // Informations agence
    nom_agence: '',
    email: '',
    telephone: '',
    adresse: '',
    pays: 'France',
    devise: 'EUR',
    symbole_devise: '€',
    format_devise: '1 000 €',
    calendly_link: '',
    logo_url: '',
    couleur_primaire: '#2563eb',
    
    // Type d'agence
    type_agence: 'immobilier', // immobilier | smma
    
    // Informations légales
    nom_legal: '',
    statut_juridique: '',
    numero_enregistrement: '',
    adresse_legale: '',
    mention_legale: '',
    conditions_paiement: '',
    
    // 🎯 Option Premium - Montant en lettres
    show_amount_in_words: false,
    
    // Formulaire IA
    form_settings: {
      showBudget: true,
      showType: true,
      showDelai: true,
      showLocalisation: true,
      showObjectifMarketing: false,
      showTypeService: false,
      agencyName: ''
    },
    
    // Paramètres CRM avancés
    crm_settings: {
      priorite_defaut: 'moyenne', // faible | moyenne | haute
      source_principale: 'formulaire_ia', // formulaire_ia | whatsapp | import_manuel
      pipeline_utilise: 'immobilier' // immobilier | smma
    }
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserEmail(user.email || '');
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setFormData({
          // Informations agence
          nom_agence: data.nom_agence || '',
          email: user.email,
          telephone: data.telephone || '',
          adresse: data.adresse || '',
          pays: data.pays || 'France',
          devise: data.devise || 'EUR',
          symbole_devise: data.symbole_devise || '€',
          format_devise: data.format_devise || '1 000 €',
          calendly_link: data.calendly_link || '',
          logo_url: data.logo_url || '',
          couleur_primaire: data.couleur_primaire || '#2563eb',
          
          // Type d'agence
          type_agence: data.type_agence || 'immobilier',
          
          // Informations légales
          nom_legal: data.nom_legal || '',
          statut_juridique: data.statut_juridique || '',
          numero_enregistrement: data.numero_enregistrement || '',
          adresse_legale: data.adresse_legale || '',
          mention_legale: data.mention_legale || '',
          conditions_paiement: data.conditions_paiement || '',
          
          // 🎯 Option Premium - Montant en lettres
          show_amount_in_words: data.show_amount_in_words || false,
          
          // Formulaire IA
          form_settings: data.form_settings || {
            showBudget: true,
            showType: true,
            showDelai: true,
            showLocalisation: true,
            showObjectifMarketing: false,
            showTypeService: false
          },
          
          // Paramètres CRM avancés
          crm_settings: data.crm_settings || {
            priorite_defaut: 'moyenne',
            source_principale: 'formulaire_ia',
            pipeline_utilise: 'immobilier'
          }
        });

        // Infos abonnement Stripe depuis le profil
        setSubscriptionInfo({
          status: data.subscription_status || 'inactive',
          plan: data.subscription_plan || 'free',
          current_period_end: data.subscription_current_period_end || null,
          stripe_customer_id: data.stripe_customer_id || null,
        });
      }
    }
    setLoading(false);
  };

  // === HANDLERS STRIPE ===

  // Version avec email explicite (utilisée pour auto-checkout depuis landing page)
  const handleSubscribeWithEmail = async (plan, email, uid) => {
    setStripeLoading(true);
    setStripeError('');
    const result = await redirectToCheckout({
      plan,
      userId: uid || userId,
      userEmail: email,
      agencyName: formData.nom_agence,
    });
    setStripeLoading(false);
    if (!result.success) {
      setStripeError(result.error || 'Erreur lors de la redirection vers le paiement.');
    }
  };

  const handleSubscribe = async (plan) => {
    if (!userEmail) {
      setStripeError('Impossible de récupérer votre email. Reconnectez-vous.');
      return;
    }
    setStripeLoading(true);
    setStripeError('');
    const result = await redirectToCheckout({
      plan,
      userId,
      userEmail,
      agencyName: formData.nom_agence,
    });
    if (!result.success) {
      setStripeError(result.error || 'Erreur lors de la redirection vers Stripe.');
    }
    setStripeLoading(false);
  };

  const handleOpenPortal = async () => {
    if (!userEmail) {
      setStripeError('Impossible de récupérer votre email.');
      return;
    }
    setStripeLoading(true);
    setStripeError('');
    const result = await openBillingPortal(userEmail);
    if (!result.success) {
      setStripeError(result.error || 'Erreur lors de l\'ouverture du portail.');
    }
    setStripeLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Logique automatique pour la devise selon le pays
    if (name === 'pays') {
      let devise = 'EUR';
      let symbole = '€';
      let format = '1 000 €';
      
      switch (value) {
        case 'France':
          devise = 'EUR';
          symbole = '€';
          format = '1 000 €';
          break;
        case 'Bénin':
        case 'Sénégal':
        case 'Côte d\'Ivoire':
          devise = 'XOF';
          symbole = 'FCFA';
          format = '1 000 000 FCFA';
          break;
        case 'Canada':
          devise = 'CAD';
          symbole = '$';
          format = '$1,000';
          break;
        default:
          devise = 'EUR';
          symbole = '€';
          format = '1 000 €';
      }
      
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        devise: devise,
        symbole_devise: symbole,
        format_devise: format
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNestedChange = (parent, key, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [key]: value
      }
    }));
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
          // Informations agence
          nom_agence: formData.nom_agence,
          telephone: formData.telephone,
          adresse: formData.adresse,
          pays: formData.pays,
          devise: formData.devise,
          symbole_devise: formData.symbole_devise,
          format_devise: formData.format_devise,
          calendly_link: formData.calendly_link,
          logo_url: formData.logo_url,
          couleur_primaire: formData.couleur_primaire,
          
          // Type d'agence
          type_agence: formData.type_agence,
          
          // Informations légales
          nom_legal: formData.nom_legal,
          statut_juridique: formData.statut_juridique,
          numero_enregistrement: formData.numero_enregistrement,
          adresse_legale: formData.adresse_legale,
          mention_legale: formData.mention_legale,
          conditions_paiement: formData.conditions_paiement,
          
          // Formulaire IA et CRM
          form_settings: formData.form_settings,
          crm_settings: formData.crm_settings
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
        <div className="flex gap-4 border-b border-slate-200 mb-6 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('general')} 
            className={`pb-2 px-4 font-medium transition whitespace-nowrap ${
              activeTab === 'general' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            🏢 Informations Agence
          </button>
          <button 
            onClick={() => setActiveTab('legal')} 
            className={`pb-2 px-4 font-medium transition whitespace-nowrap ${
              activeTab === 'legal' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            📋 Documents & Identité légale
          </button>
          <button 
            onClick={() => setActiveTab('form')} 
            className={`pb-2 px-4 font-medium transition whitespace-nowrap ${
              activeTab === 'form' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            🤖 Formulaire IA
          </button>
          <button 
            onClick={() => setActiveTab('crm')} 
            className={`pb-2 px-4 font-medium transition whitespace-nowrap ${
              activeTab === 'crm' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-slate-500'
            }`}
          >
            ⚙️ Paramètres CRM avancés
          </button>
          <button
            onClick={() => setActiveTab('visuel')}
            className={`pb-2 px-4 font-medium transition whitespace-nowrap ${
              activeTab === 'visuel'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500'
            }`}
          >
            🎨 Apparence
          </button>
          <button
            onClick={() => setActiveTab('facturation')}
            className={`pb-2 px-4 font-medium transition whitespace-nowrap ${
              activeTab === 'facturation'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-slate-500'
            }`}
          >
            💳 Abonnement & Facturation
          </button>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          
          {/* ONGLET INFORMATIONS AGENCE */}
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
                  <label className="block text-sm font-bold mb-1">Type d'agence</label>
                  <select 
                    name="type_agence" 
                    value={formData.type_agence} 
                    onChange={handleChange} 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="immobilier">🏠 Immobilier</option>
                    <option value="smma">📱 SMMA</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Ce choix adapte le formulaire IA et les documents</p>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Email principal</label>
                  <input 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    type="email"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Téléphone principal</label>
                  <input 
                    name="telephone" 
                    value={formData.telephone} 
                    onChange={handleChange} 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Pays *</label>
                  <select 
                    name="pays" 
                    value={formData.pays} 
                    onChange={handleChange} 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="France">🇫🇷 France</option>
                    <option value="Bénin">🇧🇯 Bénin</option>
                    <option value="Sénégal">🇸🇳 Sénégal</option>
                    <option value="Côte d'Ivoire">🇨🇮 Côte d'Ivoire</option>
                    <option value="Canada">🇨🇦 Canada</option>
                    <option value="Autre">🌍 Autre</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Le pays détermine automatiquement la devise et le format</p>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Devise (lecture seule)</label>
                  <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                    <span className="font-medium">{formData.devise}</span>
                    <span className="text-slate-500">({formData.symbole_devise})</span>
                    <span className="text-xs text-slate-400">Format: {formData.format_devise}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Adresse complète</label>
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
              
              {!formData.nom_agence && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    ⚠️ Veuillez compléter les informations de l'agence pour activer la génération de documents.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ONGLET DOCUMENTS & IDENTITÉ LÉGALE */}
          {activeTab === 'legal' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-blue-800 mb-2">📋 Informations légales pour documents</h3>
                <p className="text-sm text-blue-600">Ces informations sont utilisées pour générer automatiquement vos documents (devis, factures, contrats).</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Nom légal de l'entreprise</label>
                  <input 
                    name="nom_legal" 
                    value={formData.nom_legal} 
                    onChange={handleChange} 
                    placeholder="Ex: SARL IMMOBILIER SERVICES"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Statut juridique</label>
                  <select 
                    name="statut_juridique" 
                    value={formData.statut_juridique} 
                    onChange={handleChange} 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="auto-entrepreneur">Auto-entrepreneur</option>
                    <option value="ei">Entreprise Individuelle (EI)</option>
                    <option value="eurl">EURL</option>
                    <option value="sarl">SARL</option>
                    <option value="sas">SAS</option>
                    <option value="sasu">SASU</option>
                    <option value="scs">SCS</option>
                    <option value="snc">SNC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Numéro d'enregistrement</label>
                  <input 
                    name="numero_enregistrement" 
                    value={formData.numero_enregistrement} 
                    onChange={handleChange} 
                    placeholder="SIRET, RCCM, etc."
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Adresse légale</label>
                  <input 
                    name="adresse_legale" 
                    value={formData.adresse_legale} 
                    onChange={handleChange} 
                    placeholder="Si différente de l'adresse principale"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-1">Mention légale (pied de page documents)</label>
                <textarea 
                  name="mention_legale" 
                  value={formData.mention_legale} 
                  onChange={handleChange} 
                  placeholder="Ex: TVA non applicable, art. 293 B du CGI"
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-1">Conditions de paiement</label>
                <textarea 
                  name="conditions_paiement" 
                  value={formData.conditions_paiement} 
                  onChange={handleChange} 
                  placeholder="Ex: Paiement à 30 jours, pénalités de retard de 3% par mois"
                  rows={3}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              
              {/* 🎯 OPTION PREMIUM - MONTANT EN LETTRES */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-purple-800 mb-1">💎 Afficher le montant en lettres</h4>
                    <p className="text-sm text-purple-600 mb-2">
                      Option premium - Différenciation professionnelle vs Bitrix/Pipedrive
                    </p>
                    <ul className="text-xs text-purple-600 space-y-1">
                      <li>• Affiche "Arrêté la présente facture à la somme de..."</li>
                      <li>• Conversion intelligente selon devise et pays</li>
                      <li>• Style italique, aligné à gauche, discret</li>
                      <li>• Compatible EUR, USD, CAD, FCFA</li>
                    </ul>
                  </div>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="show_amount_in_words"
                        checked={formData.show_amount_in_words} 
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              
              {(!formData.nom_legal || !formData.statut_juridique) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    ⚠️ Veuillez compléter les informations légales pour générer des documents valides.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ONGLET FORMULAIRE IA */}
          {activeTab === 'form' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-purple-800 mb-2">🤖 Formulaire IA (Paramétrable par Agence)</h3>
                <p className="text-sm text-purple-600">Adaptez le formulaire client selon votre type d'agence. Ces réglages améliorent la qualité des leads.</p>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-slate-800 mb-3">Type d'agence détecté: {formData.type_agence === 'immobilier' ? '🏠 Immobilier' : '📱 SMMA'}</h4>
                <p className="text-sm text-slate-600">
                  {formData.type_agence === 'immobilier' 
                    ? 'Les champs recommandés pour l\'immobilier sont activés par défaut.'
                    : 'Les champs recommandés pour le SMMA sont activés par défaut.'
                  }
                </p>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800">Champs visibles côté client</h4>
                
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                  <div>
                    <span className="font-medium">💰 Budget</span>
                    <p className="text-xs text-slate-500">Essentiel pour qualifier le lead</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.form_settings?.showBudget} 
                    onChange={() => handleToggle('showBudget')} 
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                  <div>
                    <span className="font-medium">⏱️ Délai</span>
                    <p className="text-xs text-slate-500">Urgence du projet</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.form_settings?.showDelai} 
                    onChange={() => handleToggle('showDelai')} 
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                  <div>
                    <span className="font-medium">🏠 Type de bien</span>
                    <p className="text-xs text-slate-500">Immobilier uniquement</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.form_settings?.showType} 
                    onChange={() => handleToggle('showType')} 
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                    disabled={formData.type_agence !== 'immobilier'}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                  <div>
                    <span className="font-medium">📍 Localisation</span>
                    <p className="text-xs text-slate-500">Zone géographique souhaitée</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.form_settings?.showLocalisation} 
                    onChange={() => handleToggle('showLocalisation')} 
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                  <div>
                    <span className="font-medium">🎯 Objectif marketing</span>
                    <p className="text-xs text-slate-500">SMMA uniquement</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.form_settings?.showObjectifMarketing} 
                    onChange={() => handleToggle('showObjectifMarketing')} 
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                    disabled={formData.type_agence !== 'smma'}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                  <div>
                    <span className="font-medium">🛠️ Type de service</span>
                    <p className="text-xs text-slate-500">SMMA uniquement</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={formData.form_settings?.showTypeService} 
                    onChange={() => handleToggle('showTypeService')} 
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                    disabled={formData.type_agence !== 'smma'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ONGLET PARAMÈTRES CRM AVANCÉS */}
          {activeTab === 'crm' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-green-800 mb-2">⚙️ Paramètres CRM avancés</h3>
                <p className="text-sm text-green-600">Préparez votre CRM pour le futur scoring IA. Ces paramètres influenceront l'automatisation.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Priorité par défaut d'un lead</label>
                  <select 
                    value={formData.crm_settings?.priorite_defaut} 
                    onChange={(e) => handleNestedChange('crm_settings', 'priorite_defaut', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="faible">🔴 Faible</option>
                    <option value="moyenne">🟡 Moyenne</option>
                    <option value="haute">🟢 Haute</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Utilisé pour l'assignation automatique des leads</p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold mb-1">Source principale préférée</label>
                  <select 
                    value={formData.crm_settings?.source_principale} 
                    onChange={(e) => handleNestedChange('crm_settings', 'source_principale', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="formulaire_ia">🤖 Formulaire IA</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="import_manuel">📥 Import manuel</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Influence les algorithmes de scoring futur</p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold mb-1">Pipeline utilisé</label>
                  <select 
                    value={formData.crm_settings?.pipeline_utilise} 
                    onChange={(e) => handleNestedChange('crm_settings', 'pipeline_utilise', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="immobilier">🏠 Immobilier</option>
                    <option value="smma">📱 SMMA</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Doit correspondre à votre type d'agence</p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-bold text-slate-800 mb-2">🚀 Préparation IA</h4>
                <p className="text-sm text-slate-600 mb-3">Ces paramètres seront utilisés par le futur système de scoring IA:</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Priorité automatique basée sur le budget et l'urgence</li>
                  <li>• Score de qualité selon la source du lead</li>
                  <li>• Recommandations de suivi personnalisées</li>
                  <li>• Prédiction de taux de conversion</li>
                </ul>
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

          {/* ===== ONGLET ABONNEMENT & FACTURATION ===== */}
          {activeTab === 'facturation' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">💳 Abonnement & Facturation</h2>
                <p className="text-sm text-slate-500">Gérez votre abonnement LeadQualif — paiements sécurisés via Stripe</p>
              </div>

              {/* Erreur Stripe */}
              {stripeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  ⚠️ {stripeError}
                </div>
              )}

              {/* Plan actuel */}
              {subscriptionInfo.status === 'active' || subscriptionInfo.status === 'trialing' ? (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Votre plan actuel</p>
                      <p className="text-2xl font-bold mt-1">
                        {PLAN_LABELS[subscriptionInfo.plan] || subscriptionInfo.plan}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold block mb-2">
                        {STATUS_LABELS[subscriptionInfo.status] || subscriptionInfo.status}
                      </span>
                    </div>
                  </div>
                  {subscriptionInfo.current_period_end && (
                    <p className="text-blue-200 text-sm">
                      Prochain renouvellement : {new Date(subscriptionInfo.current_period_end).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleOpenPortal}
                      disabled={stripeLoading}
                      className="px-4 py-2 bg-white text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 transition disabled:opacity-50"
                    >
                      {stripeLoading ? '⏳ Chargement…' : '⚙️ Gérer mon abonnement'}
                    </button>
                    <button
                      onClick={handleOpenPortal}
                      disabled={stripeLoading}
                      className="px-4 py-2 bg-white/20 text-white rounded-lg font-semibold text-sm hover:bg-white/30 transition disabled:opacity-50"
                    >
                      📄 Voir mes factures
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-bold text-amber-800">Aucun abonnement actif</p>
                      <p className="text-sm text-amber-700">Choisissez un plan pour débloquer toutes les fonctionnalités</p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600">7 jours d'essai gratuit • Annulation à tout moment • Paiement sécurisé via Stripe</p>
                </div>
              )}

              {/* Plans disponibles */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3">
                  {subscriptionInfo.status === 'active' ? 'Changer de plan' : 'Choisir votre plan'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      key: 'starter',
                      name: 'Starter',
                      price: '49€',
                      features: ['Jusqu\'à 100 leads', 'Qualification IA', 'Pipeline Kanban', 'Documents basiques', 'Support email'],
                      border: 'border-slate-200',
                      badge: '',
                      btnClass: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
                    },
                    {
                      key: 'growth',
                      name: 'Growth',
                      price: '149€',
                      features: ['Leads illimités', 'IA avancée + suggestions', 'CRM & historique complet', 'Documents Pro SaaS', 'Stats & Analytics', 'Support prioritaire'],
                      border: 'border-blue-400 ring-2 ring-blue-200',
                      badge: '⭐ Recommandé',
                      btnClass: 'bg-blue-600 text-white hover:bg-blue-700',
                    },
                    {
                      key: 'enterprise',
                      name: 'Enterprise',
                      price: 'Sur devis',
                      features: ['Multi-agents', 'API dédiée', 'Onboarding prioritaire', 'Formation équipe', 'SLA 99.9%'],
                      border: 'border-purple-200',
                      badge: '',
                      btnClass: 'border border-purple-300 text-purple-700 hover:bg-purple-50',
                    },
                  ].map(plan => {
                    const isCurrent = subscriptionInfo.plan === plan.key && subscriptionInfo.status === 'active';
                    return (
                      <div key={plan.key} className={`border-2 rounded-xl p-4 ${plan.border} relative`}>
                        {plan.badge && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap">
                            {plan.badge}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="absolute -top-3 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                            ✅ Actif
                          </span>
                        )}
                        <p className="font-bold text-slate-800 text-lg">{plan.name}</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">
                          {plan.price}
                          {plan.key !== 'enterprise' && <span className="text-sm text-slate-400 font-normal">/mois</span>}
                        </p>
                        <p className="text-xs text-green-600 font-medium mt-1">🎯 7 jours offerts</p>
                        <ul className="mt-3 space-y-1 mb-4">
                          {plan.features.map(f => (
                            <li key={f} className="text-xs text-slate-600 flex items-center gap-1.5">
                              <span className="text-green-500 shrink-0">✓</span>{f}
                            </li>
                          ))}
                        </ul>
                        {plan.key === 'enterprise' ? (
                          <a
                            href="mailto:contact@nexapro.tech?subject=LeadQualif Enterprise"
                            className={`w-full mt-2 py-2 px-4 rounded-lg text-sm font-semibold transition text-center block ${plan.btnClass}`}
                          >
                            Nous contacter
                          </a>
                        ) : (
                          <button
                            onClick={() => handleSubscribe(plan.key)}
                            disabled={stripeLoading || isCurrent}
                            className={`w-full py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${plan.btnClass}`}
                          >
                            {stripeLoading ? '⏳ Chargement…' : isCurrent ? '✅ Plan actuel' : `Démarrer l'essai gratuit`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center text-slate-400 mt-3">
                  🔒 Paiement sécurisé via Stripe • Annulation à tout moment depuis le portail • Aucun engagement
                </p>
              </div>

              {/* Portail de gestion */}
              {subscriptionInfo.stripe_customer_id && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">⚙️ Gérer votre abonnement</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Accédez au portail Stripe pour modifier votre plan, télécharger vos factures, changer de carte bancaire ou annuler.
                  </p>
                  <button
                    onClick={handleOpenPortal}
                    disabled={stripeLoading}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50"
                  >
                    {stripeLoading ? '⏳ Ouverture…' : '→ Ouvrir le portail Stripe'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BOUTON SAUVEGARDE */}
          {activeTab !== 'facturation' && (
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
