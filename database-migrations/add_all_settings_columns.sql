-- ============================================================
-- Migration COMPLÈTE — Toutes les colonnes de Settings.jsx
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- Si une colonne existe déjà, IF NOT EXISTS l'ignore sans erreur.
-- ============================================================

-- ---- AGENCE ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom_agence         VARCHAR(255) DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS adresse            TEXT         DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pays               VARCHAR(100) DEFAULT 'France';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS devise             VARCHAR(10)  DEFAULT 'EUR';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS symbole_devise     VARCHAR(10)  DEFAULT '€';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS format_devise      VARCHAR(50)  DEFAULT '1 000 €';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_link      TEXT         DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS type_agence        VARCHAR(50)  DEFAULT 'immobilier';

-- ---- APPARENCE ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url           TEXT         DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS couleur_primaire   VARCHAR(20)  DEFAULT '#2563eb';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS couleur_secondaire VARCHAR(20)  DEFAULT '#7c3aed';

-- ---- LÉGAL (commun) ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom_legal              VARCHAR(255) DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS statut_juridique       VARCHAR(100) DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS numero_enregistrement  VARCHAR(100) DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS adresse_legale         TEXT         DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mention_legale         TEXT         DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS conditions_paiement    TEXT         DEFAULT '';

-- ---- LÉGAL IMMOBILIER ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS carte_pro_t        VARCHAR(100) DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS carte_pro_s        VARCHAR(100) DEFAULT '';

-- ---- LÉGAL SMMA ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activite_principale VARCHAR(255) DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS numero_tva          VARCHAR(50)  DEFAULT '';

-- ---- DOCUMENTS ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_amount_in_words BOOLEAN DEFAULT FALSE;

-- ---- FORMULAIRE & CRM (JSONB) ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_settings JSONB DEFAULT '{"showBudget":true,"showType":true,"showDelai":true,"showLocalisation":true,"showRole":true,"showObjectifMarketing":false,"showTypeService":false}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_settings  JSONB DEFAULT '{"priorite_defaut":"moyenne","source_principale":"formulaire_ia","pipeline_utilise":"immobilier"}';

-- ---- VÉRIFICATION (décommenter pour contrôler après Run) ----
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profiles' ORDER BY column_name;
