-- ============================================================
-- FIX : Isolation des leads par agence (RLS) — VERSION FINALE
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- 1. Activer RLS sur leads (si pas déjà fait)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer TOUTES les anciennes policies conflictuelles
DROP POLICY IF EXISTS "leads_select_own"                              ON leads;
DROP POLICY IF EXISTS "leads_select_agency"                          ON leads;
DROP POLICY IF EXISTS "leads_insert_anon"                            ON leads;
DROP POLICY IF EXISTS "leads_insert_auth"                            ON leads;
DROP POLICY IF EXISTS "leads_update_own"                             ON leads;
DROP POLICY IF EXISTS "leads_delete_own"                             ON leads;
DROP POLICY IF EXISTS "Allow anon insert"                            ON leads;
DROP POLICY IF EXISTS "Allow anon select"                            ON leads;
DROP POLICY IF EXISTS "Allow authenticated read"                     ON leads;
DROP POLICY IF EXISTS "Allow all operations for authenticated users"  ON leads;
DROP POLICY IF EXISTS "Users can view leads from their agency only"   ON leads;
DROP POLICY IF EXISTS "Users can insert leads for their agency"       ON leads;
DROP POLICY IF EXISTS "Users can update leads from their agency"      ON leads;
DROP POLICY IF EXISTS "Users can delete leads from their agency"      ON leads;

-- ============================================================
-- CONTEXTE ARCHITECTURE :
-- leads.agency_id = user.id de l'agence (UUID auth Supabase)
-- Ceci est garanti par :
--   - Settings.jsx      : agency_id: userId  (= auth.uid)
--   - Estimation.jsx    : agency_id: agencyProfile.user_id || agencyId
--   - Dashboard.jsx     : filtre par ProfileManager.getSafeAgencyId
--   - Stats.jsx         : filtre par ProfileManager.getSafeAgencyId
-- La condition OR ci-dessous couvre aussi les anciens comptes
-- dont agency_id pointe vers agencies.id (UUID différent de user.id)
-- ============================================================

-- 3. SELECT : chaque agence ne voit que ses propres leads
CREATE POLICY "leads_select_agency" ON leads
  FOR SELECT
  USING (
    agency_id = auth.uid()
    OR agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- 4. INSERT authentifié (formulaire interne Dashboard)
CREATE POLICY "leads_insert_auth" ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. INSERT anonyme (formulaire public Estimation.jsx)
CREATE POLICY "leads_insert_anon" ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 6. UPDATE : seulement ses propres leads
CREATE POLICY "leads_update_own" ON leads
  FOR UPDATE
  USING (
    agency_id = auth.uid()
    OR agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- 7. DELETE : seulement ses propres leads
CREATE POLICY "leads_delete_own" ON leads
  FOR DELETE
  USING (
    agency_id = auth.uid()
    OR agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- BONUS : corriger les profils existants dont agency_id est NULL
-- (ne touche pas ceux qui ont déjà agency_id = agencies.id)
-- ============================================================
UPDATE profiles
SET agency_id = user_id
WHERE user_id IS NOT NULL
  AND agency_id IS NULL;

-- ============================================================
-- Vérification : affiche les policies actives sur leads
-- ============================================================
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY cmd;
