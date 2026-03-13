-- ============================================================
-- FIX: Colonnes manquantes dans la table documents
-- Cause : les colonnes preview_html, reference, total_ttc, total_ht,
--         tva_amount, fichier_url n'existent pas → insertions silencieusement
--         rejetées → documents absents de la liste.
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- Colonnes financières et de référence
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS reference     TEXT,
  ADD COLUMN IF NOT EXISTS total_ttc     NUMERIC,
  ADD COLUMN IF NOT EXISTS total_ht      NUMERIC,
  ADD COLUMN IF NOT EXISTS tva_amount    NUMERIC,
  ADD COLUMN IF NOT EXISTS fichier_url   TEXT;

-- Colonne HTML persisté (architecture Stripe-like)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS preview_html  TEXT;

-- Vérification : afficher la structure de la table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;
