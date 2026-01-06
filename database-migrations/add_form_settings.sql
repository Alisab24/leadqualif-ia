-- Migration pour ajouter la colonne form_settings à la table profiles
-- À exécuter dans Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS form_settings JSONB DEFAULT '{"showBudget": true, "showType": true, "labelBudget": "Budget", "labelType": "Type de bien"}';

-- Créer un index pour optimiser les requêtes sur form_settings
CREATE INDEX IF NOT EXISTS idx_profiles_form_settings ON profiles USING gin (form_settings);

-- Commentaire sur la colonne
COMMENT ON COLUMN profiles.form_settings IS 'Paramètres de personnalisation du formulaire pour les agences PRO (affichage des champs, labels personnalisés)';
