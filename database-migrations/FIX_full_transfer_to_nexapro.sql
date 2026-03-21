-- ============================================================
-- TRANSFERT COMPLET DES DONNÉES
--   moonalidjol@gmail.com  → admin  (reste admin, garde ses données)
--   contact@nexapro.tech   → owner  (accède à TOUTES les données)
--
-- Ce script relie contact@nexapro.tech à l'agence/données de moonalidjol.
-- Toutes les données (leads, documents, events) restent inchangées.
-- On repointe simplement contact@nexapro.tech sur le bon agency_id.
--
-- ORDRE D'EXÉCUTION :
--   1. FIX_profiles_role_constraint.sql   ← EN PREMIER (si pas encore fait)
--   2. Ce fichier : FIX_full_transfer_to_nexapro.sql
-- ============================================================

-- ── ÉTAPE 0 : Diagnostic avant ───────────────────────────────
SELECT
  u.email,
  p.user_id,
  p.agency_id,
  p.role,
  p.nom_agence,
  p.subscription_status,
  p.subscription_plan,
  p.agency_id = p.user_id AS is_self_owner,
  (SELECT COUNT(*) FROM leads l WHERE l.agency_id = p.agency_id) AS nb_leads
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.email IN ('contact@nexapro.tech', 'moonalidjol@gmail.com')
ORDER BY u.email;

-- ── ÉTAPE 1 : Récupérer les UUIDs ────────────────────────────
DO $$
DECLARE
  moon_uid    UUID;
  contact_uid UUID;
BEGIN
  SELECT id INTO moon_uid    FROM auth.users WHERE email = 'moonalidjol@gmail.com'   LIMIT 1;
  SELECT id INTO contact_uid FROM auth.users WHERE email = 'contact@nexapro.tech'    LIMIT 1;

  IF moon_uid IS NULL THEN
    RAISE EXCEPTION 'moonalidjol@gmail.com introuvable dans auth.users';
  END IF;
  IF contact_uid IS NULL THEN
    RAISE EXCEPTION 'contact@nexapro.tech introuvable dans auth.users';
  END IF;

  -- ── ÉTAPE 2 : Créer ou mettre à jour le profil contact@nexapro.tech ──
  -- agency_id = moon_uid → contact accède aux mêmes données que moon
  -- On copie aussi le nom d'agence, logo, subscription et couleurs de moon
  INSERT INTO profiles (
    user_id,
    email,
    role,
    agency_id,
    nom_agence,
    logo_url,
    couleur_primaire,
    couleur_secondaire,
    type_agence,
    nom_complet,
    telephone,
    subscription_status,
    subscription_plan,
    stripe_customer_id,
    stripe_subscription_id,
    subscription_current_period_end
  )
  SELECT
    contact_uid,
    'contact@nexapro.tech',
    'owner',
    moon_uid,           -- ← pointe sur moonalidjol = accès à toutes ses données
    COALESCE(p.nom_agence, 'NexaPro'),
    p.logo_url,
    p.couleur_primaire,
    p.couleur_secondaire,
    p.type_agence,
    p.nom_complet,
    p.telephone,
    COALESCE(p.subscription_status, 'trialing'),
    COALESCE(p.subscription_plan,   'pro'),
    p.stripe_customer_id,
    p.stripe_subscription_id,
    p.subscription_current_period_end
  FROM profiles p
  WHERE p.user_id = moon_uid
  ON CONFLICT (user_id) DO UPDATE SET
    role                           = 'owner',
    agency_id                      = moon_uid,
    nom_agence                     = COALESCE(EXCLUDED.nom_agence, profiles.nom_agence, 'NexaPro'),
    logo_url                       = COALESCE(EXCLUDED.logo_url,   profiles.logo_url),
    couleur_primaire               = COALESCE(EXCLUDED.couleur_primaire, profiles.couleur_primaire),
    couleur_secondaire             = COALESCE(EXCLUDED.couleur_secondaire, profiles.couleur_secondaire),
    type_agence                    = COALESCE(EXCLUDED.type_agence, profiles.type_agence),
    subscription_status            = COALESCE(EXCLUDED.subscription_status, 'trialing'),
    subscription_plan              = COALESCE(EXCLUDED.subscription_plan,   'pro'),
    stripe_customer_id             = COALESCE(EXCLUDED.stripe_customer_id,  profiles.stripe_customer_id),
    stripe_subscription_id         = COALESCE(EXCLUDED.stripe_subscription_id, profiles.stripe_subscription_id),
    subscription_current_period_end = COALESCE(EXCLUDED.subscription_current_period_end, profiles.subscription_current_period_end);

  RAISE NOTICE 'contact@nexapro.tech mis à jour → owner, agency_id = moonalidjol uid';

  -- ── ÉTAPE 3 : Passer moonalidjol en admin ────────────────────
  UPDATE profiles
  SET
    role      = 'admin',
    agency_id = moon_uid   -- reste sur son propre uid = accès aux mêmes données
  WHERE user_id = moon_uid;

  RAISE NOTICE 'moonalidjol@gmail.com → admin';

END $$;

-- ── ÉTAPE 4 : Corriger la policy RLS owner_update_members ────
-- L'ancienne policy exigeait agency_id = user_id (incompatible avec ce nouveau setup)
-- On la remplace par un check basé uniquement sur role = 'owner'
DROP POLICY IF EXISTS "profiles_owner_update_members" ON profiles;

CREATE POLICY "profiles_owner_update_members" ON profiles
  FOR UPDATE
  USING (
    -- La ligne cible doit être dans la même agence
    agency_id = get_my_agency_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role    = 'owner'
        -- Pas de contrainte agency_id = user_id ici → supporte le transfert
    )
  );

-- ── ÉTAPE 5 : Vérification finale ────────────────────────────
SELECT
  u.email,
  p.role,
  p.agency_id,
  p.user_id,
  p.agency_id = p.user_id AS is_self_owner,
  owner_profile.nom_agence AS nom_agence_agence,
  p.subscription_status,
  p.subscription_plan,
  (SELECT COUNT(*) FROM leads l WHERE l.agency_id = p.agency_id) AS nb_leads_visibles
FROM auth.users u
JOIN  profiles p ON p.user_id = u.id
LEFT JOIN profiles owner_profile ON owner_profile.user_id = p.agency_id
WHERE u.email IN ('contact@nexapro.tech', 'moonalidjol@gmail.com')
ORDER BY p.role DESC;

SELECT 'FIX_full_transfer_to_nexapro OK' AS result;
