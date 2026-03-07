-- ============================================================
-- Migration : Nouveaux champs Settings v2 — Apparence & Légal
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- Date : 2026-03-07
-- ============================================================

-- ---- 1. APPARENCE ----

-- Couleur secondaire (gradient / accent)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS couleur_secondaire VARCHAR(20) DEFAULT '#7c3aed';

-- ---- 2. LÉGAL IMMOBILIER ----

-- Carte professionnelle Transaction (obligatoire agents immo France)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS carte_pro_t VARCHAR(100) DEFAULT '';

-- Carte professionnelle Syndic/Gestion
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS carte_pro_s VARCHAR(100) DEFAULT '';

-- ---- 3. LÉGAL SMMA ----

-- Activité principale de l'agence (pour SMMA / conseil)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS activite_principale VARCHAR(255) DEFAULT '';

-- Numéro de TVA intracommunautaire
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS numero_tva VARCHAR(50) DEFAULT '';

-- ---- 4. VÉRIFICATION ----
-- Après exécution, vérifier que les colonnes sont bien créées :
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- AND column_name IN ('couleur_secondaire', 'carte_pro_t', 'carte_pro_s', 'activite_principale', 'numero_tva')
-- ORDER BY column_name;
