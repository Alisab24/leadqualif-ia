-- ============================================================
-- 🔧 FIX DÉFINITIF — Paramètres Settings qui s'effacent
-- ============================================================
-- POURQUOI : La table profiles n'a pas les colonnes nécessaires
--            + la politique RLS SELECT bloque la lecture du profil
--            quand agency_id est NULL.
--
-- À EXÉCUTER dans : Supabase Dashboard → SQL Editor → Run
-- Safe à re-exécuter : tous les ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ============================================================
-- ÉTAPE 1 — Ajouter toutes les colonnes manquantes
-- ============================================================

-- Agence (générales)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom_agence            VARCHAR(255)  DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS adresse               TEXT          DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pays                  VARCHAR(100)  DEFAULT 'France';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS devise                VARCHAR(10)   DEFAULT 'EUR';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS symbole_devise        VARCHAR(10)   DEFAULT '€';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS format_devise         VARCHAR(50)   DEFAULT '1 000 €';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS type_agence           VARCHAR(50)   DEFAULT 'immobilier';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_link         TEXT          DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site_web              TEXT          DEFAULT '';

-- Apparence / Branding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url              TEXT          DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS couleur_primaire      VARCHAR(20)   DEFAULT '#2563eb';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS couleur_secondaire    VARCHAR(20)   DEFAULT '#7c3aed';

-- Légal (commun)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom_legal             VARCHAR(255)  DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS statut_juridique      VARCHAR(100)  DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS numero_enregistrement VARCHAR(100)  DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS adresse_legale        TEXT          DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mention_legale        TEXT          DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS conditions_paiement   TEXT          DEFAULT '';

-- Légal IMMO spécifique
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS carte_pro_t           VARCHAR(100)  DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS carte_pro_s           VARCHAR(100)  DEFAULT '';

-- Légal SMMA spécifique
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activite_principale   VARCHAR(255)  DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS numero_tva            VARCHAR(50)   DEFAULT '';

-- Documents
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_amount_in_words  BOOLEAN       DEFAULT FALSE;

-- Formulaire IA et CRM (JSONB)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_settings JSONB DEFAULT '{
  "showBudget": true,
  "showType": true,
  "showDelai": true,
  "showLocalisation": true,
  "showRole": true,
  "showObjectifMarketing": false,
  "showTypeService": false,
  "agencyName": ""
}'::jsonb;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_settings JSONB DEFAULT '{
  "priorite_defaut": "moyenne",
  "source_principale": "formulaire_ia",
  "pipeline_utilise": "immobilier"
}'::jsonb;

-- Abonnement Stripe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status           VARCHAR(50)   DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan             VARCHAR(50)   DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id           VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id       VARCHAR(255);

-- agency_id (si pas encore défini comme text, on s'assure qu'il existe)
-- Note: agency_id était en UUID refs agencies, mais on l'utilise comme user_id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agency_id UUID;


-- ============================================================
-- ÉTAPE 2 — Corriger les comptes existants
--            agency_id = user_id pour tous les comptes sans agency_id
-- ============================================================

UPDATE profiles
SET agency_id = user_id
WHERE agency_id IS NULL AND user_id IS NOT NULL;


-- ============================================================
-- ÉTAPE 3 — Corriger la politique RLS SELECT (bug principal)
--
-- PROBLÈME: La politique actuelle filtre par agency_id.
--           Si agency_id = NULL → le profil est INVISIBLE.
--           → Settings charge et voit un formulaire vide.
--
-- SOLUTION: Permettre à chaque utilisateur de TOUJOURS lire
--           son propre profil via user_id = auth.uid()
-- ============================================================

-- Supprimer l'ancienne politique défectueuse (si elle existe)
DROP POLICY IF EXISTS "Users can view profiles from their agency" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Nouvelle politique correcte : chacun lit son propre profil
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- S'assurer que la politique UPDATE existe aussi
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- S'assurer que la politique INSERT existe
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- ÉTAPE 4 — Vérification finale
-- Décommenter les lignes SELECT pour vérifier après Run
-- ============================================================

-- ✅ Vérifier que toutes les colonnes existent :
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- ORDER BY column_name;

-- ✅ Vérifier les politiques RLS :
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'profiles';

-- ✅ Vérifier les profils sans agency_id :
-- SELECT COUNT(*) as sans_agency_id FROM profiles WHERE agency_id IS NULL;

-- ✅ Compter les profils total :
-- SELECT COUNT(*) as total FROM profiles;
