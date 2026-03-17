/**
 * LeadForm — Formulaire ajout lead adaptatif
 * IMMO : Client acheteur / Propriétaire bailleur
 * SMMA : Prospect / Client actif
 */
import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { aiService } from '../services/ai'

/* ── Petit composant label+input réutilisable ── */
const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
)

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const selectCls = inputCls
const textareaCls = `${inputCls} resize-none`

/* ── Codes pays fréquents (agences FR + Afrique francophone + Europe) ── */
const COUNTRY_CODES = [
  { code: '+33',  flag: '🇫🇷', label: 'France'         },
  { code: '+32',  flag: '🇧🇪', label: 'Belgique'        },
  { code: '+41',  flag: '🇨🇭', label: 'Suisse'          },
  { code: '+352', flag: '🇱🇺', label: 'Luxembourg'      },
  { code: '+1',   flag: '🇨🇦', label: 'Canada'          },
  { code: '+212', flag: '🇲🇦', label: 'Maroc'           },
  { code: '+213', flag: '🇩🇿', label: 'Algérie'         },
  { code: '+216', flag: '🇹🇳', label: 'Tunisie'         },
  { code: '+221', flag: '🇸🇳', label: 'Sénégal'         },
  { code: '+225', flag: '🇨🇮', label: "Côte d'Ivoire"   },
  { code: '+237', flag: '🇨🇲', label: 'Cameroun'        },
  { code: '+241', flag: '🇬🇦', label: 'Gabon'           },
  { code: '+223', flag: '🇲🇱', label: 'Mali'            },
  { code: '+242', flag: '🇨🇬', label: 'Congo'           },
  { code: '+44',  flag: '🇬🇧', label: 'Royaume-Uni'     },
  { code: '+34',  flag: '🇪🇸', label: 'Espagne'         },
  { code: '+49',  flag: '🇩🇪', label: 'Allemagne'       },
  { code: '+39',  flag: '🇮🇹', label: 'Italie'          },
  { code: '+1',   flag: '🇺🇸', label: 'États-Unis'      },
  { code: '+971', flag: '🇦🇪', label: 'Émirats arabes'  },
  { code: '+974', flag: '🇶🇦', label: 'Qatar'           },
  { code: '+966', flag: '🇸🇦', label: 'Arabie saoudite' },
];

/* ──────────────────────────────────────────────────── */

const LeadForm = ({ onClose, onSuccess, agencyType = 'immobilier', agencyId = null }) => {
  const isImmo = agencyType === 'immobilier'

  /* ── État du formulaire ── */
  const [formData, setFormData] = useState({
    // Commun
    lead_role: '',
    nom: '',
    email: '',
    telephone: '',
    countryCode: '+33',   // code pays séparé (non sauvegardé en DB)
    source: 'site_web',
    message: '',
    // IMMO — client
    localisation_souhaitee: '',
    budget: '',
    type_de_bien: '',
    delai_achat: '',
    criteres_specifiques: '',
    type_projet: '',        // résidence principale / investissement / secondaire
    financement: '',        // cash / crédit / primo-accédant / à définir
    deja_proprietaire: '', // oui / non
    // IMMO — propriétaire
    adresse_bien: '',
    surface: '',
    nb_pieces: '',
    prix_vente: '',
    date_disponibilite: '',
    // SMMA
    objectif_marketing: '',
    type_service: '',
    budget_marketing: '',
    site_web: '',
    reseau_social: '',
    secteur_activite: '',   // restaurant, e-commerce, coach, artisan...
    deja_agence: '',        // oui / non
    taille_entreprise: '',  // solo / tpe / pme
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [qualificationResult, setQualificationResult] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  /* ── Qualification IA ── */
  const qualifyLead = async (leadData) => {
    try {
      const qualification = await aiService.qualifyLead(leadData)
      const evaluation = qualification.evaluation_complete || qualification
      const niveauInteret = qualification.niveau_interet_final || qualification.niveau_interet || evaluation.niveau_interet
      const score = qualification.score_qualification || evaluation.score_qualification || 0
      const raison = qualification.resume || evaluation.raison_classification || 'Analyse effectuée'
      let action_recommandee = ''
      if (niveauInteret === 'CHAUD') action_recommandee = 'Contacter immédiatement. Lead très prometteur.'
      else if (niveauInteret === 'TIÈDE') action_recommandee = 'Contacter sous 24-48h. Nourrir le lead.'
      else action_recommandee = 'Ajouter au suivi. Relancer pour plus d\'informations.'
      return { niveau: (niveauInteret || 'froid').toLowerCase(), score: Math.max(0, Math.min(100, score)), raison, action_recommandee }
    } catch {
      return { niveau: 'froid', score: 0, raison: 'Erreur qualification automatique', action_recommandee: 'Analyser manuellement' }
    }
  }

  /* ── Soumission ── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setQualificationResult(null)

    if (!formData.lead_role) {
      setError('Veuillez sélectionner le type de contact')
      return
    }
    setLoading(true)
    try {
      const result = await qualifyLead(formData)
      setQualificationResult(result)

      // ⚠️ On garde un seul appel IA pour la qualification de base (result).
      // Le 2ème appel sert uniquement aux données enrichies (points_forts, etc.)
      // MAIS on utilise le niveau/score du 1er appel pour la cohérence DB ↔ affichage.
      const qualification = await aiService.qualifyLead(formData)
      const evaluation = qualification.evaluation_complete || qualification
      // Toujours utiliser le niveau du 1er appel (result) → cohérent avec ce qui est affiché
      const niveauInteret = (result.niveau || 'froid').toUpperCase()

      // Combiner code pays + numéro local → format international ex: +33612345678
      // Supprimer le 0 initial si l'utilisateur a saisi 06... avec un indicatif non-FR
      const localNumber = formData.telephone.replace(/\s/g, '')
      const fullPhone = localNumber
        ? `${formData.countryCode}${localNumber.replace(/^0/, '')}`
        : ''

      // Sanitiser toutes les chaînes vides → null pour éviter les erreurs
      // "invalid input syntax for type integer: ''" sur les colonnes numériques
      // Exclure countryCode : champ UI uniquement, pas de colonne en DB
      const sanitized = Object.fromEntries(
        Object.entries(formData)
          .filter(([k]) => k !== 'countryCode')
          .map(([k, v]) => [k, v === '' ? null : v])
      )

      const budgetInt = formData.budget ? parseInt(formData.budget, 10) : null

      // Récupérer l'ID utilisateur si agencyId non fourni en prop
      let resolvedAgencyId = agencyId
      if (!resolvedAgencyId) {
        const { data: { user } } = await supabase.auth.getUser()
        resolvedAgencyId = user?.id || null
      }

      const leadData = {
        ...sanitized,
        telephone: fullPhone || null,   // format international: +33612345678
        budget: isNaN(budgetInt) ? null : budgetInt,
        agency_id: resolvedAgencyId,
        score_qualification: result.score,       // score du 1er appel (0-100)
        niveau_interet: niveauInteret,            // niveau du 1er appel (même que l'affichage)
        budget_estime: formData.budget || formData.budget_marketing || qualification.budget_estime || 'Non spécifié',
        urgence: qualification.urgence || 'moyenne',
        type_bien_recherche: formData.type_de_bien || qualification.type_bien_recherche || 'autre',
        localisation_souhaitee: formData.localisation_souhaitee || qualification.localisation_souhaitee || null,
        points_forts: qualification.points_forts || [],
        points_attention: qualification.points_attention || [],
        recommandations: qualification.recommandations || [],
        resume: result.raison,
        qualification_data: qualification,
        evaluation_complete: evaluation,
      }

      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()

      if (insertError) throw insertError
      if (onSuccess) onSuccess(newLead)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  /* ──────────── RENDU ──────────── */

  /* Couleurs selon type d'agence */
  const accent = isImmo ? 'blue' : 'violet'
  const accentBg   = isImmo ? 'bg-blue-50 border-blue-200'   : 'bg-violet-50 border-violet-200'
  const accentText = isImmo ? 'text-blue-900'                 : 'text-violet-900'
  const accentSub  = isImmo ? 'text-blue-700'                 : 'text-violet-700'
  const ringCls    = isImmo ? 'border-blue-500 bg-blue-100'   : 'border-violet-500 bg-violet-100'
  const ringText   = isImmo ? 'text-blue-900'                 : 'text-violet-900'

  /* Rôles selon type */
  const roles = isImmo
    ? [
        { id: 'client',       icon: '🏠', label: 'Client acheteur',       desc: 'Recherche un bien à acheter / louer' },
        { id: 'proprietaire', icon: '🔑', label: 'Propriétaire / Bailleur', desc: 'Vend ou loue un bien' },
      ]
    : [
        { id: 'prospect',     icon: '🎯', label: 'Prospect',              desc: 'Intéressé par nos services' },
        { id: 'client_actif', icon: '💼', label: 'Client actif',          desc: 'Déjà en relation commerciale' },
      ]

  return (
    <div className="p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* ── TYPE DE CONTACT ── */}
      <div className={`border rounded-xl p-4 ${accentBg}`}>
        <label className={`block text-sm font-bold mb-3 ${accentText}`}>
          Type de contact <span className="text-xs font-normal opacity-70">(obligatoire)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {roles.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, lead_role: r.id }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                formData.lead_role === r.id
                  ? `${ringCls} ${ringText} shadow-sm`
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-1">{r.icon}</div>
              <div className="font-semibold text-sm">{r.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{r.desc}</div>
            </button>
          ))}
        </div>
        {formData.lead_role && (
          <p className={`mt-2 text-xs ${accentSub}`}>
            ✅ Sélectionné : <strong>{roles.find(r => r.id === formData.lead_role)?.label}</strong>
          </p>
        )}
      </div>

      {/* ── CHAMPS COMMUNS ── */}
      <Field label="Nom complet" required>
        <input className={inputCls} name="nom" value={formData.nom} onChange={handleChange}
          placeholder="Jean Dupont" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" required>
          <input className={inputCls} type="email" name="email" value={formData.email}
            onChange={handleChange} placeholder="jean@exemple.com" required />
        </Field>
        <Field label="Téléphone" required>
          <div className="flex">
            <select
              name="countryCode"
              value={formData.countryCode}
              onChange={handleChange}
              className="shrink-0 pl-2 pr-1 py-2 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10"
              style={{ minWidth: '90px' }}
              title="Code pays"
            >
              {COUNTRY_CODES.map(({ code, flag, label }) => (
                <option key={`${code}-${label}`} value={code}>
                  {flag} {code}
                </option>
              ))}
            </select>
            <input
              className="flex-1 px-3 py-2 rounded-r-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="tel"
              name="telephone"
              value={formData.telephone}
              onChange={handleChange}
              placeholder="6 12 34 56 78"
              required
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Indicatif sélectionné : <strong>{formData.countryCode}</strong>
            {' · '}sera enregistré comme <strong>{formData.countryCode}{(formData.telephone || '').replace(/\s/g,'').replace(/^0/,'') || 'XXXXXXXXX'}</strong>
          </p>
        </Field>
      </div>

      <Field label="Source du lead">
        <select className={selectCls} name="source" value={formData.source} onChange={handleChange}>
          {isImmo ? (
            <>
              <option value="site_web">Site web</option>
              <option value="portail_immo">Portail immobilier (SeLoger, LBC…)</option>
              <option value="reseaux_sociaux">Réseaux sociaux</option>
              <option value="recommandation">Recommandation / Bouche à oreille</option>
              <option value="panneau">Panneau / Vitrine</option>
              <option value="publicite">Publicité</option>
              <option value="autre">Autre</option>
            </>
          ) : (
            <>
              <option value="site_web">Site web</option>
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook / Meta Ads</option>
              <option value="google_ads">Google Ads</option>
              <option value="recommandation">Recommandation</option>
              <option value="cold_outreach">Prospection directe</option>
              <option value="evenement">Événement / Réseau</option>
              <option value="autre">Autre</option>
            </>
          )}
        </select>
      </Field>

      {/* ══════════════════════════════════════
          CHAMPS IMMO — CLIENT ACHETEUR
      ══════════════════════════════════════ */}
      {isImmo && formData.lead_role === 'client' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-blue-900 text-sm">🏠 Qualification du projet</h3>

          {/* ── Les 3 champs clés EN PREMIER ── */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type de projet" required>
              <select className={selectCls} name="type_projet" value={formData.type_projet} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                <option value="residence_principale">Résidence principale</option>
                <option value="investissement">Investissement locatif</option>
                <option value="residence_secondaire">Résidence secondaire</option>
              </select>
            </Field>
            <Field label="Financement" required>
              <select className={selectCls} name="financement" value={formData.financement} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                <option value="cash">Comptant (cash)</option>
                <option value="credit">Crédit bancaire</option>
                <option value="primo">Primo-accédant (PTZ)</option>
                <option value="a_definir">À définir</option>
              </select>
            </Field>
            <Field label="Déjà propriétaire ?">
              <select className={selectCls} name="deja_proprietaire" value={formData.deja_proprietaire} onChange={handleChange}>
                <option value="">—</option>
                <option value="non">Non</option>
                <option value="oui_vendre">Oui, doit vendre</option>
                <option value="oui_garder">Oui, garde son bien</option>
              </select>
            </Field>
          </div>

          {/* ── Infos complémentaires ── */}
          <Field label="Localisation souhaitée" required>
            <input className={inputCls} name="localisation_souhaitee" value={formData.localisation_souhaitee}
              onChange={handleChange} placeholder="Paris 15ème, Lyon, Bordeaux…" required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Budget max (€)">
              <input className={inputCls} type="number" name="budget" value={formData.budget}
                onChange={handleChange} placeholder="250 000" min="0" />
            </Field>
            <Field label="Type de bien">
              <select className={selectCls} name="type_de_bien" value={formData.type_de_bien} onChange={handleChange}>
                <option value="">—</option>
                <option value="appartement">Appartement</option>
                <option value="maison">Maison</option>
                <option value="studio">Studio</option>
                <option value="villa">Villa</option>
                <option value="terrain">Terrain</option>
                <option value="commercial">Local commercial</option>
                <option value="autre">Autre</option>
              </select>
            </Field>
            <Field label="Délai d'achat">
              <select className={selectCls} name="delai_achat" value={formData.delai_achat} onChange={handleChange}>
                <option value="">—</option>
                <option value="immediat">Immédiat (- 1 mois)</option>
                <option value="court">1 – 3 mois</option>
                <option value="moyen">3 – 6 mois</option>
                <option value="long">+ 6 mois</option>
                <option value="indefini">En réflexion</option>
              </select>
            </Field>
          </div>
          <Field label="Critères spécifiques">
            <textarea className={textareaCls} name="criteres_specifiques" rows={2}
              value={formData.criteres_specifiques} onChange={handleChange}
              placeholder="Nb pièces, étage, parking, jardin…" />
          </Field>
        </div>
      )}

      {/* ══════════════════════════════════════
          CHAMPS IMMO — PROPRIÉTAIRE
      ══════════════════════════════════════ */}
      {isImmo && formData.lead_role === 'proprietaire' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-green-900 text-sm">🔑 Informations du bien</h3>
          <Field label="Adresse du bien" required>
            <input className={inputCls} name="adresse_bien" value={formData.adresse_bien}
              onChange={handleChange} placeholder="15 Rue de la Paix, 75001 Paris" required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Surface (m²)" required>
              <input className={inputCls} type="number" name="surface" value={formData.surface}
                onChange={handleChange} placeholder="75" min="0" required />
            </Field>
            <Field label="Pièces" required>
              <select className={selectCls} name="nb_pieces" value={formData.nb_pieces} onChange={handleChange} required>
                <option value="">—</option>
                {['1','2','3','4','5','6+'].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Prix (€)" required>
              <input className={inputCls} type="number" name="prix_vente" value={formData.prix_vente}
                onChange={handleChange} placeholder="350 000" min="0" required />
            </Field>
          </div>
          <Field label="Disponibilité" required>
            <select className={selectCls} name="date_disponibilite" value={formData.date_disponibilite} onChange={handleChange} required>
              <option value="">Sélectionner</option>
              <option value="immediat">Immédiat</option>
              <option value="1_mois">Dans 1 mois</option>
              <option value="3_mois">Dans 3 mois</option>
              <option value="6_mois">Dans 6 mois</option>
              <option value="plus_6_mois">+ 6 mois</option>
            </select>
          </Field>
        </div>
      )}

      {/* ══════════════════════════════════════
          CHAMPS SMMA — PROSPECT / CLIENT
      ══════════════════════════════════════ */}
      {!isImmo && formData.lead_role && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-violet-900 text-sm">
            {formData.lead_role === 'prospect' ? '🎯 Qualification prospect' : '💼 Qualification client'}
          </h3>

          {/* ── Les 3 champs clés EN PREMIER ── */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Secteur d'activité" required>
              <select className={selectCls} name="secteur_activite" value={formData.secteur_activite} onChange={handleChange} required>
                <option value="">Sélectionner</option>
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
            </Field>
            <Field label="Taille structure">
              <select className={selectCls} name="taille_entreprise" value={formData.taille_entreprise} onChange={handleChange}>
                <option value="">—</option>
                <option value="solo">Solo / Auto-entrepreneur</option>
                <option value="tpe">TPE (2–10 pers.)</option>
                <option value="pme">PME (10–50 pers.)</option>
                <option value="pme_plus">PME+ (50+ pers.)</option>
              </select>
            </Field>
            <Field label="Déjà une agence ?">
              <select className={selectCls} name="deja_agence" value={formData.deja_agence} onChange={handleChange}>
                <option value="">—</option>
                <option value="non_jamais">Non, jamais</option>
                <option value="non_avant">Oui, mais terminé</option>
                <option value="oui_concurrent">Oui, avec concurrent</option>
                <option value="en_interne">Gère en interne</option>
              </select>
            </Field>
          </div>

          {/* ── Infos complémentaires ── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objectif marketing" required>
              <select className={selectCls} name="objectif_marketing" value={formData.objectif_marketing} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                <option value="generation_leads">Génération de leads</option>
                <option value="notoriete">Notoriété / Branding</option>
                <option value="ecommerce">E-commerce / Ventes</option>
                <option value="reseaux_sociaux">Croissance réseaux sociaux</option>
                <option value="seo_contenu">SEO / Contenu</option>
                <option value="lancement">Lancement de produit</option>
                <option value="autre">Autre</option>
              </select>
            </Field>
            <Field label="Type de service" required>
              <select className={selectCls} name="type_service" value={formData.type_service} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                <option value="social_media">Social Media Management</option>
                <option value="meta_ads">Meta Ads (Facebook/Instagram)</option>
                <option value="google_ads">Google Ads</option>
                <option value="seo">SEO</option>
                <option value="creation_contenu">Création de contenu</option>
                <option value="emailing">Emailing / CRM</option>
                <option value="strategie">Stratégie globale</option>
                <option value="autre">Autre</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Budget mensuel (€)">
              <select className={selectCls} name="budget_marketing" value={formData.budget_marketing} onChange={handleChange}>
                <option value="">—</option>
                <option value="moins_500">- 500 €</option>
                <option value="500_1500">500 – 1 500 €</option>
                <option value="1500_3000">1 500 – 3 000 €</option>
                <option value="3000_5000">3 000 – 5 000 €</option>
                <option value="5000_plus">+ 5 000 €</option>
              </select>
            </Field>
            <Field label="Réseau principal">
              <select className={selectCls} name="reseau_social" value={formData.reseau_social} onChange={handleChange}>
                <option value="">—</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="aucun">Aucun</option>
              </select>
            </Field>
            <Field label="Site web">
              <input className={inputCls} type="url" name="site_web" value={formData.site_web}
                onChange={handleChange} placeholder="https://…" />
            </Field>
          </div>
        </div>
      )}

      {/* ── MESSAGE ── */}
      <Field label={isImmo ? 'Message / Besoins' : 'Notes additionnelles'}>
        <textarea className={textareaCls} name="message" rows={3} value={formData.message}
          onChange={handleChange}
          placeholder={isImmo
            ? 'Décrivez les besoins, critères spécifiques, remarques…'
            : 'Contexte, historique, attentes particulières…'
          } />
      </Field>

      {/* ── ACTIONS ── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button type="button" onClick={onClose} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
          Annuler
        </button>
        <button type="button" onClick={handleSubmit} disabled={loading}
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
            isImmo ? 'bg-blue-600 hover:bg-blue-700' : 'bg-violet-600 hover:bg-violet-700'
          } disabled:opacity-50`}>
          {loading
            ? <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Qualification en cours…
              </span>
            : '✨ Qualifier et enregistrer'
          }
        </button>
      </div>

      {/* ── RÉSULTAT QUALIFICATION ── */}
      {qualificationResult && (
        <div className={`mt-2 p-4 rounded-xl border-2 ${
          qualificationResult.niveau === 'chaud'  ? 'bg-red-50 border-red-300' :
          qualificationResult.niveau === 'tiède'  ? 'bg-amber-50 border-amber-300' :
                                                    'bg-slate-50 border-slate-300'
        }`}>
          <h3 className="font-bold text-slate-900 mb-3">Résultat de la qualification IA</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-600">Niveau : </span>
              <span className={`font-bold uppercase ${
                qualificationResult.niveau === 'chaud'  ? 'text-red-600' :
                qualificationResult.niveau === 'tiède'  ? 'text-amber-600' : 'text-slate-600'
              }`}>{qualificationResult.niveau}</span>
            </div>
            <div>
              <span className="text-slate-600">Score IA : </span>
              <span className="font-bold">{qualificationResult.score}/100</span>
              <div className="mt-1 w-full bg-slate-200 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${
                  qualificationResult.score >= 75 ? 'bg-red-500' :
                  qualificationResult.score >= 50 ? 'bg-amber-500' : 'bg-slate-400'
                }`} style={{ width: `${qualificationResult.score}%` }} />
              </div>
            </div>
            <div>
              <span className="text-slate-600">Analyse : </span>
              <span className="text-slate-800">{qualificationResult.raison}</span>
            </div>
            <div>
              <span className="text-slate-600">Action : </span>
              <span className="text-slate-800">{qualificationResult.action_recommandee}</span>
            </div>
          </div>
          <button onClick={onClose}
            className={`mt-4 w-full py-2 rounded-lg text-sm font-semibold text-white ${
              isImmo ? 'bg-blue-600 hover:bg-blue-700' : 'bg-violet-600 hover:bg-violet-700'
            }`}>
            Fermer
          </button>
        </div>
      )}
    </div>
  )
}

export default LeadForm
