-- ============================================================
-- FIX : Colonnes manquantes dans la table leads
-- Exécuter dans Supabase → SQL Editor → Run
-- Toutes les colonnes sont ajoutées de façon idempotente (IF NOT EXISTS)
-- ============================================================

DO $$
BEGIN

  -- ── Qualification IA ─────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='budget_estime') THEN
    ALTER TABLE leads ADD COLUMN budget_estime TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='urgence') THEN
    ALTER TABLE leads ADD COLUMN urgence TEXT DEFAULT 'moyenne';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='type_bien_recherche') THEN
    ALTER TABLE leads ADD COLUMN type_bien_recherche TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='points_forts') THEN
    ALTER TABLE leads ADD COLUMN points_forts JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='points_attention') THEN
    ALTER TABLE leads ADD COLUMN points_attention JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='recommandations') THEN
    ALTER TABLE leads ADD COLUMN recommandations JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='resume') THEN
    ALTER TABLE leads ADD COLUMN resume TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='qualification_data') THEN
    ALTER TABLE leads ADD COLUMN qualification_data JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='evaluation_complete') THEN
    ALTER TABLE leads ADD COLUMN evaluation_complete JSONB;
  END IF;

  -- ── Formulaire IMMO — client ──────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='criteres_specifiques') THEN
    ALTER TABLE leads ADD COLUMN criteres_specifiques TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='type_projet') THEN
    ALTER TABLE leads ADD COLUMN type_projet TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='financement') THEN
    ALTER TABLE leads ADD COLUMN financement TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='deja_proprietaire') THEN
    ALTER TABLE leads ADD COLUMN deja_proprietaire TEXT;
  END IF;

  -- ── Formulaire IMMO — propriétaire ───────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='adresse_bien') THEN
    ALTER TABLE leads ADD COLUMN adresse_bien TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='surface') THEN
    ALTER TABLE leads ADD COLUMN surface NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='nb_pieces') THEN
    ALTER TABLE leads ADD COLUMN nb_pieces INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='prix_vente') THEN
    ALTER TABLE leads ADD COLUMN prix_vente NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='date_disponibilite') THEN
    ALTER TABLE leads ADD COLUMN date_disponibilite TEXT;
  END IF;

  -- ── Formulaire SMMA ──────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='objectif_marketing') THEN
    ALTER TABLE leads ADD COLUMN objectif_marketing TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='type_service') THEN
    ALTER TABLE leads ADD COLUMN type_service TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='budget_marketing') THEN
    ALTER TABLE leads ADD COLUMN budget_marketing TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='site_web') THEN
    ALTER TABLE leads ADD COLUMN site_web TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='reseau_social') THEN
    ALTER TABLE leads ADD COLUMN reseau_social TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='secteur_activite') THEN
    ALTER TABLE leads ADD COLUMN secteur_activite TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='deja_agence') THEN
    ALTER TABLE leads ADD COLUMN deja_agence TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='taille_entreprise') THEN
    ALTER TABLE leads ADD COLUMN taille_entreprise TEXT;
  END IF;

  -- ── Champs IA supplémentaires ─────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='suggestion_ia') THEN
    ALTER TABLE leads ADD COLUMN suggestion_ia TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='resume_ia') THEN
    ALTER TABLE leads ADD COLUMN resume_ia TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='ia_processed_at') THEN
    ALTER TABLE leads ADD COLUMN ia_processed_at TIMESTAMPTZ;
  END IF;

END $$;

-- Vérification : liste toutes les colonnes de leads
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;
