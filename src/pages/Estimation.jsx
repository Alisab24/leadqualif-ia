/**
 * Estimation.jsx — Formulaire public adaptatif
 * IMMO : Client acheteur / Propriétaire bailleur
 * SMMA : Prospect / Client actif
 *
 * Fix : useParams() lit 'agencyId' (= nom du param dans App.jsx)
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useParams } from 'react-router-dom';

export default function Estimation() {
  const { agencyId } = useParams(); // ✅ corrigé (était agency_id → toujours undefined)

  const [agencyProfile, setAgencyProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState(null);
  const [scoreData, setScoreData] = useState(null);

  /* ── Données du formulaire ── */
  const [formData, setFormData] = useState({
    lead_role: '',
    nom: '', email: '', telephone: '',
    source: 'formulaire_web',
    message: '',
    // IMMO — client
    localisation_souhaitee: '',
    budget: '',
    type_de_bien: '',
    delai_achat: '',
    type_projet: '',
    financement: '',
    deja_proprietaire: '',
    criteres_specifiques: '',
    // IMMO — propriétaire
    adresse_bien: '',
    surface: '',
    nb_pieces: '',
    prix_vente: '',
    date_disponibilite: '',
    // SMMA
    secteur_activite: '',
    taille_entreprise: '',
    deja_agence: '',
    objectif_marketing: '',
    type_service: '',
    budget_marketing: '',
    reseau_social: '',
    site_web: '',
  });

  /* ── Chargement profil agence ── */
  useEffect(() => {
    if (!agencyId) { setLoadingProfile(false); return; }
    const fetchProfile = async () => {
      try {
        // L'UUID dans l'URL peut être user_id OU agency_id selon quand le profil a été créé.
        // On essaie user_id en premier (cas le plus fréquent — signup standard),
        // puis agency_id (si explicitement défini dans Settings).
        let profile = null;

        const { data: byUserId } = await supabase
          .from('profiles')
          .select('nom_agence, logo_url, couleur_primaire, type_agence, agency_id, user_id')
          .eq('user_id', agencyId)
          .maybeSingle();

        if (byUserId) {
          profile = byUserId;
        } else {
          const { data: byAgencyId } = await supabase
            .from('profiles')
            .select('nom_agence, logo_url, couleur_primaire, type_agence, agency_id, user_id')
            .eq('agency_id', agencyId)
            .maybeSingle();
          profile = byAgencyId || null;
        }

        setAgencyProfile(profile);
      } catch (e) {
        console.error('Profil agence:', e);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [agencyId]);

  /* ── Dérivés ── */
  const isImmo        = !agencyProfile || agencyProfile?.type_agence !== 'smma';
  const primaryColor  = agencyProfile?.couleur_primaire || (isImmo ? '#2563eb' : '#7c3aed');
  const accentBg      = isImmo ? 'bg-blue-50 border-blue-200'   : 'bg-violet-50 border-violet-200';
  const accentTitle   = isImmo ? 'text-blue-900'                : 'text-violet-900';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  /* ── Soumission ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.lead_role) {
      setError('Veuillez sélectionner votre profil avant de continuer.');
      return;
    }
    setLoading(true);
    try {
      /* Score simplifié côté client */
      let scoreIA = 30;
      const budget = parseInt(formData.budget || formData.prix_vente || 0) || 0;
      if (budget > 0)        scoreIA += 20;
      if (budget > 100000)   scoreIA += 10;
      if (formData.message?.length > 10) scoreIA += 10;
      if (formData.telephone?.length >= 10) scoreIA += 10;
      if (formData.type_projet || formData.secteur_activite) scoreIA += 10;
      if (formData.financement || formData.objectif_marketing) scoreIA += 10;
      scoreIA = Math.min(99, Math.max(10, scoreIA));

      // Convertit les chaînes vides en null pour éviter
      // "invalid input syntax for type integer: ''"
      const sanitized = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, v === '' ? null : v])
      );

      const leadPayload = {
        ...sanitized,
        budget: budget || null,
        score: scoreIA,
        score_qualification: scoreIA,
        statut: 'À traiter',
        agency_id: agencyId || null,
        source: 'formulaire_web',
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('leads').insert([leadPayload]);
      if (insertError) throw insertError;

      setScoreData({ score: scoreIA });
      setSubmitted(true);
    } catch (err) {
      setError(`Erreur : ${err.message || 'Veuillez réessayer.'}`);
    } finally {
      setLoading(false);
    }
  };

  /* ── Rôles selon type d'agence ── */
  const roles = isImmo
    ? [
        { id: 'client',       icon: '🏠', label: 'Je cherche un bien',  desc: 'Achat ou location' },
        { id: 'proprietaire', icon: '🔑', label: 'Je vends / loue',     desc: 'Mise en vente ou location' },
      ]
    : [
        { id: 'prospect',     icon: '🎯', label: 'Nouveau projet',      desc: 'Je cherche une agence' },
        { id: 'client_actif', icon: '💼', label: 'Client actif',        desc: 'Déjà en relation' },
      ];

  const inputCls  = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition';
  const labelCls  = 'block text-xs font-bold text-slate-600 mb-1';

  /* ──────────── ÉCRAN SUCCÈS ──────────── */
  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${primaryColor}20` }}>
          <svg className="w-10 h-10" fill="none" stroke={primaryColor} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Demande envoyée !</h2>
        <p className="text-slate-600 mb-6">
          {isImmo
            ? 'Votre projet immobilier a bien été reçu. Un conseiller vous contactera rapidement.'
            : 'Votre demande a bien été reçue. Notre équipe revient vers vous sous 24h.'}
        </p>

        {scoreData && (
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200 text-left">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Score de votre projet</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${scoreData.score}%`, backgroundColor: primaryColor }} />
              </div>
              <span className="font-bold text-slate-900 text-sm">{scoreData.score}%</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Score calculé selon les informations fournies
            </p>
          </div>
        )}

        {agencyProfile?.nom_agence && (
          <p className="text-xs text-slate-400 mt-4">
            Formulaire proposé par <strong>{agencyProfile.nom_agence}</strong>
          </p>
        )}
      </div>
    </div>
  );

  /* ──────────── CHARGEMENT ──────────── */
  if (loadingProfile) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Chargement…</p>
      </div>
    </div>
  );

  /* ──────────── FORMULAIRE ──────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header agence */}
        <div className="text-center mb-10">
          {agencyProfile?.logo_url ? (
            <img
              src={agencyProfile.logo_url}
              alt={agencyProfile.nom_agence}
              className="h-16 w-auto mx-auto mb-4 object-contain"
              onError={e => e.target.style.display = 'none'}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              {agencyProfile?.nom_agence?.substring(0, 2).toUpperCase() || 'AG'}
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {agencyProfile?.nom_agence || 'Formulaire de contact'}
          </h1>
          <p className="text-slate-500 text-sm">
            {isImmo
              ? 'Partagez votre projet immobilier en quelques clics'
              : 'Dites-nous en plus sur votre projet marketing'}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* ── Sélecteur de rôle ── */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Vous êtes <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, lead_role: r.id }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.lead_role === r.id
                      ? 'shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  style={formData.lead_role === r.id
                    ? { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }
                    : {}}
                >
                  <div className="text-2xl mb-1">{r.icon}</div>
                  <div className="font-semibold text-sm text-slate-900">{r.label}</div>
                  <div className="text-xs mt-0.5 text-slate-500">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Coordonnées ── */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input className={inputCls} name="nom" value={formData.nom}
              onChange={handleChange} placeholder="Jean Dupont" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input className={inputCls} type="email" name="email" value={formData.email}
                onChange={handleChange} placeholder="jean@exemple.com" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Téléphone <span className="text-red-500">*</span>
              </label>
              <input className={inputCls} type="tel" name="telephone" value={formData.telephone}
                onChange={handleChange} placeholder="06 12 34 56 78" required />
            </div>
          </div>

          {/* ══════════════════════════════════════
              IMMO — CLIENT ACHETEUR
          ══════════════════════════════════════ */}
          {isImmo && formData.lead_role === 'client' && (
            <div className={`${accentBg} rounded-2xl p-5 space-y-4 border`}>
              <h3 className={`font-semibold text-sm ${accentTitle}`}>🏠 Votre projet d'achat</h3>

              {/* 3 champs clés EN PREMIER */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Type de projet <span className="text-red-500">*</span></label>
                  <select className={inputCls} name="type_projet" value={formData.type_projet} onChange={handleChange} required>
                    <option value="">—</option>
                    <option value="residence_principale">Résidence principale</option>
                    <option value="investissement">Investissement locatif</option>
                    <option value="residence_secondaire">Résidence secondaire</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Financement <span className="text-red-500">*</span></label>
                  <select className={inputCls} name="financement" value={formData.financement} onChange={handleChange} required>
                    <option value="">—</option>
                    <option value="cash">Comptant</option>
                    <option value="credit">Crédit bancaire</option>
                    <option value="primo">Primo-accédant (PTZ)</option>
                    <option value="a_definir">À définir</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Déjà propriétaire ?</label>
                  <select className={inputCls} name="deja_proprietaire" value={formData.deja_proprietaire} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="non">Non</option>
                    <option value="oui_vendre">Oui, doit vendre</option>
                    <option value="oui_garder">Oui, garde son bien</option>
                  </select>
                </div>
              </div>

              {/* Localisation */}
              <div>
                <label className={labelCls}>Localisation souhaitée <span className="text-red-500">*</span></label>
                <input className={inputCls} name="localisation_souhaitee" value={formData.localisation_souhaitee}
                  onChange={handleChange} placeholder="Paris 15ème, Lyon, Bordeaux…" required />
              </div>

              {/* Budget + Type + Délai */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Budget max (€)</label>
                  <input className={inputCls} type="number" name="budget" value={formData.budget}
                    onChange={handleChange} placeholder="250 000" min="0" />
                </div>
                <div>
                  <label className={labelCls}>Type de bien</label>
                  <select className={inputCls} name="type_de_bien" value={formData.type_de_bien} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison</option>
                    <option value="studio">Studio</option>
                    <option value="villa">Villa</option>
                    <option value="terrain">Terrain</option>
                    <option value="commercial">Local commercial</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Délai</label>
                  <select className={inputCls} name="delai_achat" value={formData.delai_achat} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="immediat">Immédiat</option>
                    <option value="court">1 – 3 mois</option>
                    <option value="moyen">3 – 6 mois</option>
                    <option value="long">+ 6 mois</option>
                    <option value="indefini">En réflexion</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Critères spécifiques</label>
                <textarea className={`${inputCls} resize-none`} name="criteres_specifiques" rows={2}
                  value={formData.criteres_specifiques} onChange={handleChange}
                  placeholder="Nb pièces, étage, parking, jardin…" />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════
              IMMO — PROPRIÉTAIRE
          ══════════════════════════════════════ */}
          {isImmo && formData.lead_role === 'proprietaire' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-green-900 text-sm">🔑 Votre bien</h3>

              <div>
                <label className={labelCls}>Adresse du bien <span className="text-red-500">*</span></label>
                <input className={inputCls} name="adresse_bien" value={formData.adresse_bien}
                  onChange={handleChange} placeholder="15 Rue de la Paix, 75001 Paris" required />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Surface (m²) <span className="text-red-500">*</span></label>
                  <input className={inputCls} type="number" name="surface" value={formData.surface}
                    onChange={handleChange} placeholder="75" min="0" required />
                </div>
                <div>
                  <label className={labelCls}>Pièces <span className="text-red-500">*</span></label>
                  <select className={inputCls} name="nb_pieces" value={formData.nb_pieces} onChange={handleChange} required>
                    <option value="">—</option>
                    {['1','2','3','4','5','6+'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Prix souhaité (€) <span className="text-red-500">*</span></label>
                  <input className={inputCls} type="number" name="prix_vente" value={formData.prix_vente}
                    onChange={handleChange} placeholder="350 000" min="0" required />
                </div>
              </div>

              <div>
                <label className={labelCls}>Disponibilité <span className="text-red-500">*</span></label>
                <select className={inputCls} name="date_disponibilite" value={formData.date_disponibilite} onChange={handleChange} required>
                  <option value="">Sélectionner</option>
                  <option value="immediat">Immédiat</option>
                  <option value="1_mois">Dans 1 mois</option>
                  <option value="3_mois">Dans 3 mois</option>
                  <option value="6_mois">Dans 6 mois</option>
                  <option value="plus_6_mois">+ 6 mois</option>
                </select>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════
              SMMA — PROSPECT / CLIENT
          ══════════════════════════════════════ */}
          {!isImmo && formData.lead_role && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-violet-900 text-sm">
                {formData.lead_role === 'prospect' ? '🎯 Votre projet marketing' : '💼 Votre situation'}
              </h3>

              {/* 3 champs clés EN PREMIER */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Secteur d'activité <span className="text-red-500">*</span></label>
                  <select className={inputCls} name="secteur_activite" value={formData.secteur_activite} onChange={handleChange} required>
                    <option value="">—</option>
                    <option value="restaurant_food">Restaurant / Food</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="coach_formation">Coach / Formation</option>
                    <option value="immobilier">Immobilier</option>
                    <option value="beaute_bien_etre">Beauté / Bien-être</option>
                    <option value="sante">Santé / Médical</option>
                    <option value="artisan_btp">Artisan / BTP</option>
                    <option value="mode_luxe">Mode / Luxe</option>
                    <option value="tech_saas">Tech / SaaS</option>
                    <option value="service_b2b">Service B2B</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Taille structure</label>
                  <select className={inputCls} name="taille_entreprise" value={formData.taille_entreprise} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="solo">Solo / Auto-entrepreneur</option>
                    <option value="tpe">TPE (2–10 pers.)</option>
                    <option value="pme">PME (10–50 pers.)</option>
                    <option value="pme_plus">PME+ (50+ pers.)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Déjà une agence ?</label>
                  <select className={inputCls} name="deja_agence" value={formData.deja_agence} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="non_jamais">Non, jamais</option>
                    <option value="non_avant">Oui, mais terminé</option>
                    <option value="oui_concurrent">Oui, avec concurrent</option>
                    <option value="en_interne">Gère en interne</option>
                  </select>
                </div>
              </div>

              {/* Objectif + Service */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Objectif marketing <span className="text-red-500">*</span></label>
                  <select className={inputCls} name="objectif_marketing" value={formData.objectif_marketing} onChange={handleChange} required>
                    <option value="">—</option>
                    <option value="generation_leads">Génération de leads</option>
                    <option value="notoriete">Notoriété / Branding</option>
                    <option value="ecommerce">E-commerce / Ventes</option>
                    <option value="reseaux_sociaux">Croissance réseaux sociaux</option>
                    <option value="seo_contenu">SEO / Contenu</option>
                    <option value="lancement">Lancement de produit</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Service souhaité <span className="text-red-500">*</span></label>
                  <select className={inputCls} name="type_service" value={formData.type_service} onChange={handleChange} required>
                    <option value="">—</option>
                    <option value="social_media">Social Media Management</option>
                    <option value="meta_ads">Meta Ads (Facebook/Instagram)</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="seo">SEO</option>
                    <option value="creation_contenu">Création de contenu</option>
                    <option value="emailing">Emailing / CRM</option>
                    <option value="strategie">Stratégie globale</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              {/* Budget + Réseau + Site */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Budget mensuel</label>
                  <select className={inputCls} name="budget_marketing" value={formData.budget_marketing} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="moins_500">- 500 €</option>
                    <option value="500_1500">500 – 1 500 €</option>
                    <option value="1500_3000">1 500 – 3 000 €</option>
                    <option value="3000_5000">3 000 – 5 000 €</option>
                    <option value="5000_plus">+ 5 000 €</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Réseau principal</label>
                  <select className={inputCls} name="reseau_social" value={formData.reseau_social} onChange={handleChange}>
                    <option value="">—</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="aucun">Aucun</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Site web</label>
                  <input className={inputCls} type="url" name="site_web" value={formData.site_web}
                    onChange={handleChange} placeholder="https://…" />
                </div>
              </div>
            </div>
          )}

          {/* ── Message ── */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {isImmo ? 'Message / Besoins' : 'Notes additionnelles'}
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              name="message" rows={3}
              value={formData.message} onChange={handleChange}
              placeholder={isImmo
                ? 'Décrivez vos critères, souhaits particuliers…'
                : 'Contexte, historique, attentes spécifiques…'}
            />
          </div>

          {/* ── Bouton ── */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Envoi en cours…
              </span>
            ) : '✨ Envoyer ma demande'}
          </button>

          <p className="text-xs text-center text-slate-400">
            🔒 Données sécurisées · Aucun engagement
            {agencyProfile?.nom_agence ? ` · ${agencyProfile.nom_agence}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
