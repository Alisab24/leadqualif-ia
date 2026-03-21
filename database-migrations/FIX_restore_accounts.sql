-- ============================================================
-- RESTAURATION CIBLÉE — 2 comptes spécifiques
--   moonalidjol@gmail.com
--   aldjanari2@outlook.fr
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ── ÉTAPE 1 : Diagnostic — voir l'état actuel des 2 comptes ──
SELECT
  p.user_id,
  p.email,
  p.nom_agence,
  p.role,
  p.agency_id,
  p.subscription_status,
  p.subscription_plan,
  p.subscription_current_period_end,
  p.stripe_subscription_id,
  p.created_at,
  CASE
    WHEN p.subscription_status = 'trialing' THEN '✅ Essai actif'
    WHEN p.subscription_status = 'active'   THEN '✅ Abonnement actif'
    WHEN p.subscription_status = 'inactive' THEN '❌ Réinitialisé à free — à corriger'
    ELSE '❓ ' || COALESCE(p.subscription_status, 'NULL')
  END AS etat,
  (SELECT COUNT(*) FROM leads l WHERE l.agency_id = p.agency_id OR l.agency_id = p.user_id) AS nb_leads
FROM profiles p
WHERE p.email IN ('moonalidjol@gmail.com', 'aldjanari2@outlook.fr')
ORDER BY p.email;

-- ── ÉTAPE 2 : Restaurer l'essai gratuit pour ces 2 comptes ───
-- Remet subscription_status = 'trialing' et subscription_plan = 'trialing'
-- UNIQUEMENT si le statut actuel est 'inactive' (= réinitialisé par erreur)
-- et qu'il n'y a pas de Stripe ID (= essai gratuit, pas un vrai abonnement)

UPDATE profiles
SET
  subscription_status             = 'trialing',
  subscription_plan               = 'trialing',
  subscription_current_period_end = COALESCE(
    subscription_current_period_end,        -- garder la date existante si elle est là
    created_at + INTERVAL '14 days'         -- sinon 14 jours depuis la création du compte
  )
WHERE
  email IN ('moonalidjol@gmail.com', 'aldjanari2@outlook.fr')
  AND subscription_status = 'inactive'
  AND stripe_subscription_id IS NULL;

-- Affiche combien de lignes ont été corrigées
SELECT 'Comptes restaurés : ' || ROW_COUNT()::text AS resultat;

-- ── ÉTAPE 3 : Vérifier que agency_id est correct ─────────────
-- Pour les owners, agency_id doit = user_id
-- Si ce n'est pas le cas, les leads ne sont pas visibles

UPDATE profiles
SET agency_id = user_id
WHERE
  email IN ('moonalidjol@gmail.com', 'aldjanari2@outlook.fr')
  AND role = 'owner'
  AND (agency_id IS NULL OR agency_id != user_id);

-- ── ÉTAPE 4 : Vérification finale des 2 comptes ──────────────
SELECT
  p.email,
  p.role,
  p.subscription_status,
  p.subscription_plan,
  p.subscription_current_period_end,
  p.agency_id = p.user_id AS agency_id_correct,
  (SELECT COUNT(*) FROM leads l WHERE l.agency_id = p.user_id) AS leads_visibles
FROM profiles p
WHERE p.email IN ('moonalidjol@gmail.com', 'aldjanari2@outlook.fr')
ORDER BY p.email;
