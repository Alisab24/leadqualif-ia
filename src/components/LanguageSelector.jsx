/**
 * LanguageSelector.jsx
 * Toggle FR | EN dans la navbar ET dans la page Paramètres.
 *
 * - Au montage : lit profiles.lang depuis Supabase et applique la langue
 * - Au clic    : met à jour profiles.lang + i18n.changeLanguage()
 * - Pas de rechargement de page, pas de /fr/ /en/ dans l'URL
 * - La langue persiste entre sessions via Supabase (pas localStorage)
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import { applyLang } from '../i18n';

export default function LanguageSelector({ variant = 'navbar' }) {
  const { i18n, t } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'fr');
  const [saving, setSaving] = useState(false);

  /* ── Charger la langue depuis Supabase au montage ── */
  useEffect(() => {
    const loadLang = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('lang')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.lang) {
        applyLang(profile.lang);
        setCurrentLang(profile.lang);
      }
    };
    loadLang();
  }, []);

  /* ── Changer la langue ── */
  const changeLang = async (lang) => {
    if (lang === currentLang || saving) return;
    setSaving(true);

    // 1. Appliquer immédiatement (sans rechargement)
    applyLang(lang);
    setCurrentLang(lang);

    // 2. Persister dans Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ lang })
        .eq('user_id', user.id);
    }

    setSaving(false);
  };

  /* ── Variante navbar : bouton compact FR | EN ── */
  if (variant === 'navbar') {
    return (
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
        <button
          onClick={() => changeLang('fr')}
          disabled={saving}
          className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
            currentLang === 'fr'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          title="Français"
        >
          FR
        </button>
        <button
          onClick={() => changeLang('en')}
          disabled={saving}
          className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
            currentLang === 'en'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          title="English"
        >
          EN
        </button>
      </div>
    );
  }

  /* ── Variante settings : bloc complet avec label ── */
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        {t('settings.language.title')}
      </label>
      <div className="flex gap-3">
        {[
          { code: 'fr', flag: '🇫🇷', label: t('settings.language.fr') },
          { code: 'en', flag: '🇬🇧', label: t('settings.language.en') },
        ].map(({ code, flag, label }) => (
          <button
            key={code}
            onClick={() => changeLang(code)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              currentLang === code
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="text-lg">{flag}</span>
            <span>{label}</span>
            {currentLang === code && (
              <span className="ml-1 text-blue-500">✓</span>
            )}
          </button>
        ))}
      </div>
      {saving && (
        <p className="text-xs text-slate-400">{t('common.loading')}</p>
      )}
    </div>
  );
}
