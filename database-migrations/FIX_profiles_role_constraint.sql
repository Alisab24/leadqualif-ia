-- ============================================================
-- FIX CRITIQUE : Contrainte CHECK sur profiles.role
--
-- Problème : la colonne role avait CHECK (role IN ('admin','agent'))
-- → 'owner' rejeté silencieusement → tous les nouveaux comptes
--   deviennent 'agent' par défaut au lieu de 'owner'.
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ── ÉTAPE 1 : Supprimer l'ancienne contrainte restrictive ────
-- Le nom peut varier selon quand la table a été créée
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS "profiles_role_check";

-- Chercher et supprimer toutes les contraintes CHECK sur role
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
  END LOOP;
END $$;

-- ── ÉTAPE 2 : Ajouter la nouvelle contrainte avec 'owner' ─────
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'agent', 'viewer'));

-- ── ÉTAPE 3 : Changer le DEFAULT à 'owner' ───────────────────
-- Un nouveau profil créé sans rôle explicite = propriétaire
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'owner';

-- ── ÉTAPE 4 : Corriger les profils existants mal configurés ──
-- Les propriétaires (agency_id = user_id) qui ont role = 'agent'
-- par erreur → les remettre en 'owner'
UPDATE profiles
SET role = 'owner'
WHERE (agency_id = user_id OR agency_id IS NULL)
  AND (role IS NULL OR role NOT IN ('owner', 'admin', 'agent', 'viewer'));

-- Cas spécifique : aldjanari@gmail.com et contact@nexapro.tech = owners
UPDATE profiles
SET role = 'owner'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('aldjanari@gmail.com', 'contact@nexapro.tech')
)
AND agency_id = user_id;

-- ── ÉTAPE 5 : Vérification ───────────────────────────────────
SELECT
  u.email,
  p.role,
  p.agency_id = p.user_id AS is_owner_config,
  p.subscription_status
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
ORDER BY p.role, u.email;

SELECT 'FIX_profiles_role_constraint OK — DEFAULT owner, CHECK inclut owner' AS result;
