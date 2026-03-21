-- ============================================================
-- FIX CRITIQUE : Abonnements inaccessibles + Leads invisibles
--
-- Problèmes résolus :
--   1. Récursion infinie RLS sur profiles → leads invisibles
--   2. Abonnements essai gratuit réinitialisés à 'free'
--   3. Policy profiles bloquant la lecture du plan/subscription
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ── ÉTAPE 1 : Fonction helper non-récursive ─────────────────
-- Permet d'obtenir l'agency_id sans déclencher la récursion RLS
-- sur la table profiles elle-même.
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_agency_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_agency_id TO anon;

-- ── ÉTAPE 2 : Corriger les policies RLS sur profiles ─────────
-- Les anciennes policies avec sous-requête auto-référente
-- peuvent causer une récursion infinie → lecture bloquée.

-- Supprimer TOUTES les policies existantes sur profiles
DROP POLICY IF EXISTS "Users can view profiles from their agency" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile"        ON profiles;
DROP POLICY IF EXISTS "profiles_self_read"                        ON profiles;
DROP POLICY IF EXISTS "profiles_agency_read"                      ON profiles;
DROP POLICY IF EXISTS "profiles_self_write"                       ON profiles;
DROP POLICY IF EXISTS "profiles_self_update"                      ON profiles;

-- S'assurer que RLS est activé
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT 1 : l'utilisateur peut toujours lire SON propre profil
--            (pas de récursion — comparaison directe auth.uid())
CREATE POLICY "profiles_own_read" ON profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- SELECT 2 : les membres peuvent lire les profils de leur agence
--            Utilise la fonction helper pour éviter la récursion
CREATE POLICY "profiles_agency_read" ON profiles
  FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    OR user_id = auth.uid()
  );

-- INSERT : un user peut créer son propre profil
CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE : un user peut modifier uniquement son propre profil
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- ── ÉTAPE 3 : Corriger les policies RLS sur leads ────────────
-- S'assurer que les leads sont lisibles pour les propriétaires
-- (la policy agency_id = auth.uid() évite la dépendance à profiles)

DROP POLICY IF EXISTS "leads_select_agency" ON leads;
DROP POLICY IF EXISTS "leads_select_own"    ON leads;

CREATE POLICY "leads_select_agency" ON leads
  FOR SELECT
  USING (
    agency_id = auth.uid()
    OR agency_id = get_my_agency_id()
  );

-- ── ÉTAPE 4 : Diagnostic — état actuel des abonnements ───────
-- Affiche les profils avec des abonnements en cours
-- pour vérifier que les données sont intactes
SELECT
  p.user_id,
  p.email,
  p.nom_agence,
  p.role,
  p.subscription_status,
  p.subscription_plan,
  p.subscription_current_period_end,
  p.stripe_subscription_id,
  CASE
    WHEN p.subscription_status = 'trialing' THEN '✅ Essai actif'
    WHEN p.subscription_status = 'active'   THEN '✅ Abonnement actif'
    WHEN p.subscription_status = 'inactive' AND p.stripe_subscription_id IS NOT NULL
      THEN '⚠️ Inactif mais Stripe ID présent'
    WHEN p.subscription_status = 'inactive' THEN '❌ Inactif (free)'
    ELSE '❓ ' || COALESCE(p.subscription_status, 'NULL')
  END AS etat
FROM profiles p
WHERE p.role = 'owner'
ORDER BY p.subscription_status, p.created_at DESC
LIMIT 50;

-- ── ÉTAPE 5 : Restaurer les abonnements essai si réinitialisés ─
-- Si des profils owner ont subscription_status = 'inactive' mais
-- qu'ils avaient un essai récent, on peut le détecter et restaurer.
--
-- ATTENTION : Décommenter seulement si ÉTAPE 4 montre des profils
-- avec subscription_status = 'inactive' qui devraient être 'trialing'
-- et n'ont PAS de stripe_subscription_id.
--
-- UPDATE profiles
-- SET
--   subscription_status = 'trialing',
--   subscription_plan   = 'trialing',
--   subscription_current_period_end = NOW() + INTERVAL '14 days'
-- WHERE
--   role = 'owner'
--   AND subscription_status = 'inactive'
--   AND stripe_subscription_id IS NULL
--   AND created_at > NOW() - INTERVAL '30 days'; -- comptes récents seulement

-- ── ÉTAPE 6 : Vérification finale ───────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('profiles', 'leads')
ORDER BY tablename, cmd;

SELECT 'FIX subscriptions_and_rls OK' AS result;
