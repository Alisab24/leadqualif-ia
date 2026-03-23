/**
 * i18n.js — Configuration i18next pour React/Vite
 * Langues : fr (défaut) | en
 * Persistance : Supabase profiles.lang (pas localStorage)
 * Pas de /fr/ ou /en/ dans les URLs
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from '../messages/fr.json';
import en from '../messages/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: 'fr',              // langue par défaut — sera remplacée par profiles.lang
    fallbackLng: 'fr',      // si une clé manque en EN → fallback FR
    interpolation: {
      escapeValue: false,   // React échappe déjà les valeurs
    },
    pluralSeparator: '_',   // hotLeads_one / hotLeads_other
  });

export default i18n;

/**
 * Applique la langue depuis Supabase profiles.lang
 * Appelé au chargement de l'app + après changement dans LanguageSelector
 */
export function applyLang(lang) {
  if (lang && ['fr', 'en'].includes(lang)) {
    i18n.changeLanguage(lang);
  }
}

/**
 * Mapping statut DB (toujours en FR) → clé i18n
 * Les valeurs Supabase restent en FR, seul l'affichage change.
 */
export const STATUT_KEYS = {
  'À traiter':      'pipeline.toProcess',
  'Contacté':       'pipeline.contacted',
  'RDV fixé':       'pipeline.appointmentSet',
  'RDV planifié':   'pipeline.appointmentPlanned',
  'En négociation': 'pipeline.inNegotiation',
  'Offre envoyée':  'pipeline.offerSent',
  'Gagné':          'pipeline.won',
  'Perdu':          'pipeline.lost',
  'Archivé':        'pipeline.archived',
};

/**
 * Traduit un statut DB (FR) dans la langue courante
 * Usage : tStatut('Chaud') → "Hot 🔥" ou "Chaud 🔥"
 */
export function tStatut(statut) {
  const key = STATUT_KEYS[statut];
  return key ? i18n.t(key) : statut;
}

/**
 * Traduit un score IA en label chaud/tiède/froid
 */
export function tScore(score) {
  if (score >= 70) return i18n.t('score.hot');
  if (score >= 40) return i18n.t('score.warm');
  return i18n.t('score.cold');
}

/**
 * Traduit le label pipeline_labels (mapping direct depuis DB value)
 * Usage dans les colonnes Kanban : tPipelineLabel('À traiter') → "To process"
 */
export function tPipelineLabel(label) {
  return i18n.t(`pipeline_labels.${label}`, { defaultValue: label });
}
