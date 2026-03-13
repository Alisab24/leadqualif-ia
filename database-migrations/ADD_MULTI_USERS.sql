-- ═══════════════════════════════════════════════════════════════════
-- ADD_MULTI_USERS.sql
-- Ajoute le support multi-utilisateurs par agence
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Colonne rôle sur profiles ────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'owner'
  CHECK (role IN ('owner', 'admin', 'agent', 'viewer'));

-- Tous les profils existants sont propriétaires de leur agence
UPDATE profiles SET role = 'owner' WHERE role IS NULL OR role = '';


-- ── 2. Table des invitations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_invitations (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   UUID    NOT NULL,
  invited_by  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  DEFAULT 'agent'
              CHECK (role IN ('admin', 'agent', 'viewer')),
  token       UUID    DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status      VARCHAR(20)  DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at  TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_agency_id ON agency_invitations (agency_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token     ON agency_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email     ON agency_invitations (email);


-- ── 3. RLS invitations ───────────────────────────────────────────
ALTER TABLE agency_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can see invitations"   ON agency_invitations;
DROP POLICY IF EXISTS "Agency owners manage invitations"     ON agency_invitations;

-- Tout membre de l'agence peut lire les invitations
CREATE POLICY "Agency members can see invitations" ON agency_invitations
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Seul l'owner/admin peut créer et modifier
CREATE POLICY "Agency owners manage invitations" ON agency_invitations
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Lecture publique par token pour acceptation d'invitation
-- (nécessaire pour que le nouvel utilisateur puisse lire son invitation)
CREATE POLICY "Public can read invitation by token" ON agency_invitations
  FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());


-- ── 4. Mise à jour RLS leads ─────────────────────────────────────
-- Remplace agency_id = auth.uid() par subquery sur profiles
-- Compatible avec les comptes existants (pour eux profiles.agency_id = auth.uid())

DROP POLICY IF EXISTS "Users manage own leads"            ON leads;
DROP POLICY IF EXISTS "Agency members manage leads"       ON leads;
DROP POLICY IF EXISTS "Users can manage their own leads"  ON leads;
DROP POLICY IF EXISTS "agency_id_policy"                  ON leads;

CREATE POLICY "Agency members manage leads" ON leads
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );


-- ── 5. Mise à jour RLS documents ────────────────────────────────
DROP POLICY IF EXISTS "Users manage own documents"        ON documents;
DROP POLICY IF EXISTS "Agency members manage documents"   ON documents;

CREATE POLICY "Agency members manage documents" ON documents
  FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );


-- ── 6. Mise à jour RLS timeline (si elle existe) ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'timeline'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users manage own timeline" ON timeline';
    EXECUTE 'DROP POLICY IF EXISTS "Agency members manage timeline" ON timeline';
    EXECUTE '
      CREATE POLICY "Agency members manage timeline" ON timeline
        FOR ALL
        USING (
          lead_id IN (
            SELECT id FROM leads WHERE agency_id IN (
              SELECT agency_id FROM profiles WHERE user_id = auth.uid()
            )
          )
        )
      ';
  END IF;
END $$;


-- ── 7. Fonction utilitaire : récupérer agency_id de l'utilisateur ─
CREATE OR REPLACE FUNCTION get_user_agency_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT agency_id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;


-- ── 8. Vérification ──────────────────────────────────────────────
SELECT
  'profiles.role'  AS check_name,
  COUNT(*)         AS rows_with_role
FROM profiles
WHERE role IS NOT NULL

UNION ALL

SELECT
  'agency_invitations table',
  COUNT(*)
FROM agency_invitations;
