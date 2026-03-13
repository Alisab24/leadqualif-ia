-- ═══════════════════════════════════════════════════════════════
-- ADD_PIXEL_TRACKING.sql
-- Ajoute les colonnes de tracking publicitaire dans la table profiles
-- À exécuter une seule fois dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Facebook / Meta Pixel ID
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT DEFAULT '';

-- Google Ads Conversion ID (ex: AW-1234567890)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_ads_id TEXT DEFAULT '';

-- Google Ads Conversion Label (ex: AbCdEfGhIj)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_ads_label TEXT DEFAULT '';

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('facebook_pixel_id', 'google_ads_id', 'google_ads_label')
ORDER BY column_name;
