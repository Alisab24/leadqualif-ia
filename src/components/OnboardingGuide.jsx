/**
 * OnboardingGuide.jsx
 * Barre d'onboarding 4 étapes — s'affiche au Dashboard pour les nouveaux utilisateurs
 * Disparaît automatiquement quand toutes les étapes sont complétées ou si l'user la ferme
 */
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'onboarding_dismissed';

export default function OnboardingGuide() {
  const navigate = useNavigate();
  const [visible, setVisible]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [agencyId, setAgencyId]   = useState(null);
  const [steps, setSteps]         = useState([
    { id: 'profile',  done: false, loading: true },
    { id: 'lead',     done: false, loading: true },
    { id: 'url',      done: false, loading: true },
    { id: 'document', done: false, loading: true },
  ]);
  const [copied, setCopied] = useState(false);

  // ── Charger l'état réel des étapes ──
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') return;

    loadSteps();
  }, []);

  const loadSteps = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Profil + agence
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, nom_complet, subscription_plan')
        .eq('user_id', user.id)
        .single();

      const aid = profile?.agency_id;
      setAgencyId(aid);

      // Vérifier chaque étape en parallèle
      const [agencyRes, leadsRes, docsRes] = await Promise.all([
        aid ? supabase.from('agencies').select('nom_agence').eq('id', aid).maybeSingle() : Promise.resolve({ data: null }),
        aid ? supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', aid) : Promise.resolve({ count: 0 }),
        aid ? supabase.from('documents').select('id', { count: 'exact', head: true }).eq('agency_id', aid) : Promise.resolve({ count: 0 }),
      ]);

      const profileDone  = !!(agencyRes.data?.nom_agence);
      const leadDone     = (leadsRes.count || 0) > 0;
      const urlDone      = !!aid; // URL dispo dès qu'on a un agency_id
      const documentDone = (docsRes.count || 0) > 0;

      const newSteps = [
        { id: 'profile',  done: profileDone,  loading: false },
        { id: 'lead',     done: leadDone,     loading: false },
        { id: 'url',      done: urlDone,      loading: false },
        { id: 'document', done: documentDone, loading: false },
      ];

      setSteps(newSteps);

      // Afficher l'onboarding seulement si pas tout fait
      const allDone = newSteps.every(s => s.done);
      setVisible(!allDone);
    } catch (err) {
      console.error('[Onboarding]', err);
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const copyUrl = async () => {
    if (!agencyId) return;
    const url = `${window.location.origin}/estimation/${agencyId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Marquer l'étape URL comme faite visuellement
    setSteps(prev => prev.map(s => s.id === 'url' ? { ...s, done: true } : s));
  };

  if (!visible) return null;

  const doneCount = steps.filter(s => s.done).length;
  const percent   = Math.round((doneCount / steps.length) * 100);
  const allDone   = doneCount === steps.length;

  const STEP_CONFIG = [
    {
      id: 'profile',
      number: 1,
      icon: '🏢',
      title: 'Configurer votre agence',
      desc: 'Renseignez le nom, le type et le logo de votre agence',
      cta: 'Configurer',
      action: () => navigate('/settings?tab=general'),
    },
    {
      id: 'lead',
      number: 2,
      icon: '👤',
      title: 'Ajouter votre premier lead',
      desc: 'Créez un lead manuellement ou importez-en un pour tester',
      cta: 'Ajouter un lead',
      action: () => {
        // Déclencher le bouton "Nouveau lead" du Dashboard
        document.querySelector('[data-new-lead]')?.click();
      },
    },
    {
      id: 'url',
      number: 3,
      icon: '🔗',
      title: 'Copier votre lien formulaire',
      desc: `Partagez ce lien avec vos clients pour recevoir des leads automatiquement`,
      cta: copied ? '✅ Copié !' : 'Copier le lien',
      action: copyUrl,
    },
    {
      id: 'document',
      number: 4,
      icon: '📄',
      title: 'Générer votre premier document',
      desc: 'Créez un devis, une facture ou un mandat depuis un lead',
      cta: 'Voir les documents',
      action: () => navigate('/documents'),
    },
  ];

  return (
    <div className="mx-6 mt-4 mb-2 bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <span className="text-lg">🚀</span>
          <div>
            <p className="text-sm font-bold text-indigo-900">
              {allDone ? '🎉 Configuration terminée !' : `Démarrez avec LeadQualif — ${percent}% complété`}
            </p>
            <p className="text-xs text-indigo-600">{doneCount}/{steps.length} étapes complétées</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-indigo-400 hover:text-indigo-600 text-xs px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
          >
            {collapsed ? '▼ Afficher' : '▲ Réduire'}
          </button>
          <button
            onClick={dismiss}
            className="text-indigo-300 hover:text-indigo-600 text-xs px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
            title="Masquer l'onboarding"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Étapes */}
      {!collapsed && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-100">
          {STEP_CONFIG.map((step) => {
            const state = steps.find(s => s.id === step.id);
            const isDone    = state?.done;
            const isLoading = state?.loading;

            return (
              <div
                key={step.id}
                className={`flex flex-col justify-between p-4 ${isDone ? 'bg-green-50/50' : 'bg-white hover:bg-slate-50'} transition-colors`}
              >
                <div className="flex items-start gap-2 mb-3">
                  {/* Icône état */}
                  <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${isDone ? 'bg-green-500 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    {isLoading ? (
                      <span className="animate-spin text-xs">⏳</span>
                    ) : isDone ? (
                      '✓'
                    ) : (
                      step.number
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold leading-tight ${isDone ? 'text-green-700 line-through opacity-60' : 'text-slate-800'}`}>
                      {step.icon} {step.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{step.desc}</p>
                  </div>
                </div>

                {!isDone && (
                  <button
                    onClick={step.action}
                    className="w-full text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors text-center"
                  >
                    {step.cta} →
                  </button>
                )}
                {isDone && (
                  <span className="text-xs text-green-600 font-medium text-center">✅ Complété</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
