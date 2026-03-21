-- ============================================================
-- RESTAURER moonalidjol@gmail.com EN PROPRIÉTAIRE
-- ============================================================

-- Remettre moonalidjol en owner, agency_id = son propre user_id
UPDATE profiles
SET
  role      = 'owner',
  agency_id = user_id   -- owner pointe sur lui-même
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'moonalidjol@gmail.com' LIMIT 1
);

-- Vérification
SELECT
  u.email,
  p.role,
  p.agency_id = p.user_id AS is_owner_setup,
  p.subscription_status,
  p.subscription_plan,
  (SELECT COUNT(*) FROM leads l WHERE l.agency_id = p.user_id) AS nb_leads
FROM auth.users u
JOIN profiles p ON p.user_id = u.id
WHERE u.email = 'moonalidjol@gmail.com';

SELECT 'FIX_restore_moon_owner OK' AS result;
