-- ============================================================
-- FIX : Tous les comptes existants → 'owner' par défaut
--       SAUF les membres invités (agency_id ≠ user_id)
--
-- Logique :
--   - Si agency_id = user_id (ou agency_id IS NULL) → propriétaire
--   - Si agency_id ≠ user_id → membre invité, ne pas toucher
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ── ÉTAPE 1 : Diagnostic avant ───────────────────────────────
SELECT
  role,
  COUNT(*) AS nb,
  COUNT(*) FILTER (WHERE agency_id = user_id OR agency_id IS NULL) AS sont_owners,
  COUNT(*) FILTER (WHERE agency_id != user_id AND agency_id IS NOT NULL) AS sont_membres
FROM profiles
GROUP BY role
ORDER BY role;

-- ── ÉTAPE 2 : Passer en 'owner' tous les comptes solo ────────
-- Condition : agency_id = user_id (compte standalone, pas un membre)
UPDATE profiles
SET role = 'owner'
WHERE
  (agency_id = user_id OR agency_id IS NULL)
  AND role != 'owner';

-- ── ÉTAPE 3 : Corriger agency_id NULL → user_id pour les owners ─
-- S'assurer que les owners ont agency_id bien renseigné
UPDATE profiles
SET agency_id = user_id
WHERE agency_id IS NULL
  AND user_id IS NOT NULL;

-- ── ÉTAPE 4 : Vérification finale ────────────────────────────
SELECT
  role,
  COUNT(*) AS nb
FROM profiles
GROUP BY role
ORDER BY role;

-- Détail par compte
SELECT
  u.email,
  p.role,
  CASE
    WHEN p.agency_id = p.user_id THEN '👑 Owner (solo)'
    WHEN p.agency_id != p.user_id THEN '👥 Membre de ' || owner.email
    ELSE '❓ Inconnu'
  END AS situation
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN auth.users owner ON owner.id = p.agency_id AND p.agency_id != p.user_id
ORDER BY p.role, u.email;

SELECT 'FIX_set_existing_owners OK' AS result;
