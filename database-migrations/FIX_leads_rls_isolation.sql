-- ============================================================
-- FIX : Isolation des leads par agence (RLS)
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- 1. Activer RLS sur leads (si pas déjà fait)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes policies conflictuelles
DROP POLICY IF EXISTS "leads_select_own"        ON leads;
DROP POLICY IF EXISTS "leads_select_agency"     ON leads;
DROP POLICY IF EXISTS "leads_insert_anon"       ON leads;
DROP POLICY IF EXISTS "leads_insert_auth"       ON leads;
DROP POLICY IF EXISTS "leads_update_own"        ON leads;
DROP POLICY IF EXISTS "leads_delete_own"        ON leads;
DROP POLICY IF EXISTS "Allow anon insert"       ON leads;
DROP POLICY IF EXISTS "Allow authenticated read" ON leads;

-- 3. SELECT : chaque agence ne voit que ses propres leads
CREATE POLICY "leads_select_agency" ON leads
  FOR SELECT
  USING (
    agency_id = auth.uid()
    OR user_id = auth.uid()
  );

-- 4. INSERT authentifié (formulaire interne)
CREATE POLICY "leads_insert_auth" ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. INSERT anonyme (formulaire public)
CREATE POLICY "leads_insert_anon" ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 6. UPDATE : seulement ses propres leads
CREATE POLICY "leads_update_own" ON leads
  FOR UPDATE
  USING (
    agency_id = auth.uid()
    OR user_id = auth.uid()
  );

-- 7. DELETE : seulement ses propres leads
CREATE POLICY "leads_delete_own" ON leads
  FOR DELETE
  USING (
    agency_id = auth.uid()
    OR user_id = auth.uid()
  );

-- Vérification
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY cmd;
