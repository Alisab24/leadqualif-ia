-- ══════════════════════════════════════════════════════════════════
-- Migration : Module Intégrations Universelles
-- Exécuter dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Clés API par workspace ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id    UUID        NOT NULL,
  key          TEXT        UNIQUE DEFAULT ('lq_live_' || replace(gen_random_uuid()::text, '-', '')),
  name         TEXT        DEFAULT 'Clé principale',
  is_active    BOOLEAN     DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_agency ON api_keys (agency_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key    ON api_keys (key) WHERE is_active = true;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_agency_owns" ON api_keys;
CREATE POLICY "api_keys_agency_owns" ON api_keys
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ── 2. Mappings webhook universel ─────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_mappings (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id   UUID        NOT NULL,
  platform    TEXT        NOT NULL DEFAULT 'universal',
  mapping     JSONB       NOT NULL DEFAULT '{}',
  sample_json TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agency_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_webhook_mappings_agency ON webhook_mappings (agency_id);

ALTER TABLE webhook_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_mappings_agency_owns" ON webhook_mappings;
CREATE POLICY "webhook_mappings_agency_owns" ON webhook_mappings
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ── 3. Champ source sur les leads ─────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_platform TEXT;  -- 'Facebook Ads', 'Systeme.io', etc.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_detail   TEXT;  -- info complémentaire (nom du funnel, form_id…)

CREATE INDEX IF NOT EXISTS idx_leads_source_platform ON leads (agency_id, source_platform);

-- ── 4. Log des webhooks (debug & monitoring) ──────────────────────
CREATE TABLE IF NOT EXISTS webhook_logs (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id  UUID,
  platform   TEXT,
  payload    JSONB,
  lead_id    UUID,
  action     TEXT,        -- 'created' | 'updated' | 'duplicate' | 'error'
  error_msg  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_agency ON webhook_logs (agency_id, created_at DESC);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_logs_agency_owns" ON webhook_logs;
CREATE POLICY "webhook_logs_agency_owns" ON webhook_logs
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );
