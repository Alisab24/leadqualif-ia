-- ============================================================
-- TRANSFERT DE PROPRIÉTÉ
--   contact@nexapro.tech  → propriétaire (owner)
--   moonalidjol@gmail.com → admin sous cette agence
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ── ÉTAPE 1 : Diagnostic avant modification ──────────────────
SELECT
  u.email,
  p.user_id,
  p.agency_id,
  p.role,
  p.nom_agence,
  p.agency_id = p.user_id AS is_owner_setup
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.email IN ('contact@nexapro.tech', 'moonalidjol@gmail.com')
ORDER BY u.email;

-- ── ÉTAPE 2 : S'assurer que contact@nexapro.tech est bien owner ──
-- agency_id = user_id = soi-même (c'est la règle pour un owner)
UPDATE profiles
SET
  role      = 'owner',
  agency_id = user_id       -- owner pointe sur lui-même
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'contact@nexapro.tech' LIMIT 1
)
AND user_id IS NOT NULL;

-- Si le profil contact@nexapro.tech n'existe pas encore, le créer
INSERT INTO profiles (user_id, email, role, agency_id, nom_agence)
SELECT
  u.id,
  u.email,
  'owner',
  u.id,       -- agency_id = user_id pour un owner
  'NexaPro'
FROM auth.users u
WHERE u.email = 'contact@nexapro.tech'
  AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = u.id
  );

-- ── ÉTAPE 3 : Lier moonalidjol@gmail.com comme admin ────────
-- agency_id = user_id du propriétaire (contact@nexapro.tech)
UPDATE profiles
SET
  role      = 'admin',
  agency_id = (
    SELECT id FROM auth.users WHERE email = 'contact@nexapro.tech' LIMIT 1
  )
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'moonalidjol@gmail.com' LIMIT 1
)
AND user_id IS NOT NULL;

-- ── ÉTAPE 4 : Vérification finale ────────────────────────────
SELECT
  u.email,
  p.role,
  p.agency_id = p.user_id            AS agency_id_propre,
  owner.email                         AS agence_proprietaire,
  p.nom_agence
FROM auth.users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN auth.users owner ON owner.id = p.agency_id
WHERE u.email IN ('contact@nexapro.tech', 'moonalidjol@gmail.com')
ORDER BY p.role DESC;

SELECT 'FIX_transfer_ownership OK' AS result;
