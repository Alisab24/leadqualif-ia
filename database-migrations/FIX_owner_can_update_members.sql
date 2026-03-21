-- ============================================================
-- FIX : Permettre au propriétaire de modifier les rôles des membres
--
-- Problème : profiles_own_update bloque toute mise à jour
-- sur un profil autre que le sien (user_id = auth.uid()).
-- L'owner ne pouvait donc pas changer le rôle d'un membre.
-- ============================================================

-- Supprimer l'ancienne policy UPDATE trop restrictive
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;

-- Policy UPDATE 1 : chacun peut modifier SON propre profil
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy UPDATE 2 : le propriétaire peut modifier les profils
-- de tous les membres de son agence (pour changer les rôles)
DROP POLICY IF EXISTS "profiles_owner_update_members" ON profiles;
CREATE POLICY "profiles_owner_update_members" ON profiles
  FOR UPDATE
  USING (
    -- Le profil cible appartient à l'agence de l'utilisateur courant
    agency_id = get_my_agency_id()
    -- ET l'utilisateur courant est owner de cette agence
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id  = auth.uid()
        AND p.role     = 'owner'
        AND p.agency_id = p.user_id
    )
  );

-- Vérification
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'UPDATE'
ORDER BY policyname;

SELECT 'FIX_owner_can_update_members OK' AS result;
