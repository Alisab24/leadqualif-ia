-- ═══════════════════════════════════════════════════════════════════════════
-- ADD_HOT_LEAD_ALERTS.sql
-- Ajoute :
--   1. Les colonnes de notification dans profiles
--   2. La table lead_alerts pour suivre les alertes envoyées
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes notification dans profiles ────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_email   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notification_webhook TEXT DEFAULT '';

-- ── 2. Table lead_alerts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_alerts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agency_id   UUID NOT NULL,
  alerted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)   -- une seule alerte par lead
);

-- Index pour recherche rapide par agence
CREATE INDEX IF NOT EXISTS idx_lead_alerts_agency_id ON lead_alerts(agency_id);
CREATE INDEX IF NOT EXISTS idx_lead_alerts_lead_id   ON lead_alerts(lead_id);

-- ── 3. RLS sur lead_alerts ───────────────────────────────────────────────
ALTER TABLE lead_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own alerts" ON lead_alerts;
CREATE POLICY "Users manage own alerts"
  ON lead_alerts
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
