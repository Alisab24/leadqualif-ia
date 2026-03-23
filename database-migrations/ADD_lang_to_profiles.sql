-- ============================================================
-- Ajoute la colonne lang à la table profiles
-- Valeurs acceptées : 'fr' | 'en'
-- Défaut : 'fr'
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'fr'
  CHECK (lang IN ('fr', 'en'));

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'lang';

SELECT 'ADD_lang_to_profiles OK' AS result;
