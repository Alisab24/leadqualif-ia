-- ============================================================
-- FIX : Système d'invitation équipe
-- Problèmes résolus :
--   1. Membre invité ne voit pas les données de l'agence
--   2. Membre invité bloqué sur plan gratuit
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. S'assurer que la table agency_invitations existe ─────────────────────
CREATE TABLE IF NOT EXISTS agency_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL,
  invited_by  UUID NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'agent',
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide par token
CREATE INDEX IF NOT EXISTS agency_invitations_token_idx ON agency_invitations(token);
CREATE INDEX IF NOT EXISTS agency_invitations_email_idx ON agency_invitations(email, status);
CREATE INDEX IF NOT EXISTS agency_invitations_agency_idx ON agency_invitations(agency_id, status);

-- ── 2. RLS sur agency_invitations ───────────────────────────────────────────
ALTER TABLE agency_invitations ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire une invitation par token (pour la page /join)
DROP POLICY IF EXISTS "invitations_read_by_token" ON agency_invitations;
CREATE POLICY "invitations_read_by_token" ON agency_invitations
  FOR SELECT USING (true);  -- lecture publique (filtre par token côté client)

-- Seul le propriétaire de l'agence peut créer des invitations
DROP POLICY IF EXISTS "invitations_insert_owner" ON agency_invitations;
CREATE POLICY "invitations_insert_owner" ON agency_invitations
  FOR INSERT WITH CHECK (auth.uid() = invited_by);

-- Le propriétaire peut modifier (révoquer) ses invitations
DROP POLICY IF EXISTS "invitations_update_owner" ON agency_invitations;
CREATE POLICY "invitations_update_owner" ON agency_invitations
  FOR UPDATE USING (
    auth.uid() = invited_by
    OR auth.uid()::text = agency_id::text
    OR (status = 'pending')  -- l'invité peut accepter (change status → accepted)
  );

-- ── 3. RLS sur profiles : permettre à chaque utilisateur de créer/modifier SON profil ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Un utilisateur peut toujours lire son propre profil
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Les membres de la même agence peuvent voir les profils de leurs collègues
DROP POLICY IF EXISTS "profiles_agency_read" ON profiles;
CREATE POLICY "profiles_agency_read" ON profiles
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Chaque utilisateur peut créer/modifier SON propre profil
DROP POLICY IF EXISTS "profiles_self_write" ON profiles;
CREATE POLICY "profiles_self_write" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ── 4. RPC : upsert_member_profile (SECURITY DEFINER) ──────────────────────
-- Permet au nouvel invité d'écrire son profil même si RLS serait trop restrictif
-- (utilisé comme fallback)
CREATE OR REPLACE FUNCTION upsert_member_profile(
  p_user_id       UUID,
  p_email         TEXT,
  p_nom_complet   TEXT,
  p_agency_id     UUID,
  p_role          TEXT,
  p_nom_agence    TEXT,
  p_invitation_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sécurité : l'appelant doit être le même utilisateur
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  -- Vérifier que l'invitation est valide (si fournie)
  IF p_invitation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM agency_invitations
      WHERE id = p_invitation_id
        AND agency_id = p_agency_id
        AND status = 'pending'
        AND expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'Invitation invalide ou expirée';
    END IF;
  END IF;

  -- Créer ou mettre à jour le profil
  INSERT INTO profiles (user_id, email, nom_complet, agency_id, role, nom_agence)
  VALUES (p_user_id, p_email, p_nom_complet, p_agency_id, p_role, p_nom_agence)
  ON CONFLICT (user_id) DO UPDATE SET
    agency_id   = EXCLUDED.agency_id,
    role        = EXCLUDED.role,
    nom_agence  = EXCLUDED.nom_agence,
    nom_complet = EXCLUDED.nom_complet,
    email       = EXCLUDED.email;

  -- Marquer l'invitation comme acceptée
  IF p_invitation_id IS NOT NULL THEN
    UPDATE agency_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = p_invitation_id;
  END IF;
END;
$$;

-- Permettre à tous les utilisateurs authentifiés d'appeler cette RPC
GRANT EXECUTE ON FUNCTION upsert_member_profile TO authenticated;

-- ── 5. Vérification des membres existants sans agency_id correct ────────────
-- Affiche les membres invités qui pourraient avoir le mauvais agency_id
SELECT
  p.user_id,
  p.email,
  p.role,
  p.agency_id,
  p.agency_id = p.user_id AS "agency_id_mal_configuré",
  ai.agency_id AS "agency_id_attendu"
FROM profiles p
LEFT JOIN agency_invitations ai ON ai.email = p.email AND ai.status = 'accepted'
WHERE p.role != 'owner'
  AND (p.agency_id IS NULL OR p.agency_id = p.user_id)
LIMIT 20;

SELECT 'Migration team_invitations OK' AS result;
