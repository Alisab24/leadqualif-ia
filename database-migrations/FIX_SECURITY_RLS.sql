-- ============================================================
-- CORRECTIF SÉCURITÉ SUPABASE — Security Advisor (4 erreurs)
-- Projet : leadqualif-ia-db (rscjrpisvorapbopagox)
-- Date   : 2026-03-21
-- ============================================================
-- Ce script active le Row Level Security (RLS) et crée les
-- policies manquantes sur les 4 tables signalées.
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. document_templates  (templates globaux partagés)
--    Pas d'agency_id → lecture pour tous les users authentifiés
--    Écriture réservée au service role (admin)
-- ──────────────────────────────────────────────────────────
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read templates" ON document_templates;
CREATE POLICY "Authenticated users can read templates"
  ON document_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Les INSERT/UPDATE/DELETE restent bloqués côté client ;
-- seul le service role (backend) peut modifier les templates.


-- ──────────────────────────────────────────────────────────
-- 2. document_audit_trail  (lié à agency_id)
-- ──────────────────────────────────────────────────────────
ALTER TABLE document_audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their agency audit trail" ON document_audit_trail;
CREATE POLICY "Users can view their agency audit trail"
  ON document_audit_trail
  FOR SELECT
  USING (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Users can insert their agency audit trail" ON document_audit_trail;
CREATE POLICY "Users can insert their agency audit trail"
  ON document_audit_trail
  FOR INSERT
  WITH CHECK (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );


-- ──────────────────────────────────────────────────────────
-- 3. agency_settings  (lié à agency_id)
-- ──────────────────────────────────────────────────────────
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their agency settings" ON agency_settings;
CREATE POLICY "Users can view their agency settings"
  ON agency_settings
  FOR SELECT
  USING (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Users can insert their agency settings" ON agency_settings;
CREATE POLICY "Users can insert their agency settings"
  ON agency_settings
  FOR INSERT
  WITH CHECK (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Users can update their agency settings" ON agency_settings;
CREATE POLICY "Users can update their agency settings"
  ON agency_settings
  FOR UPDATE
  USING (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );


-- ──────────────────────────────────────────────────────────
-- 4. document_counters  (lié à user_id directement)
-- ──────────────────────────────────────────────────────────
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own counters" ON document_counters;
CREATE POLICY "Users can view their own counters"
  ON document_counters
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own counters" ON document_counters;
CREATE POLICY "Users can insert their own counters"
  ON document_counters
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own counters" ON document_counters;
CREATE POLICY "Users can update their own counters"
  ON document_counters
  FOR UPDATE
  USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- Vérification finale (à exécuter séparément pour confirmer)
-- ──────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'document_templates',
--     'document_audit_trail',
--     'agency_settings',
--     'document_counters'
--   );
-- Toutes les lignes doivent avoir rowsecurity = true
