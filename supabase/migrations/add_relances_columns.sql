-- Migration: Relances automatiques
-- Ajouter les colonnes nécessaires pour le système de relances automatiques

-- 1. Colonne sur documents pour tracker quels jours de relance ont été envoyés
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS relances_sent JSONB DEFAULT '[]'::jsonb;

-- 2. Colonnes sur workspace_settings pour la config des relances
ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS relances_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS relances_devis JSONB DEFAULT '[3,7,14]'::jsonb,
  ADD COLUMN IF NOT EXISTS relances_facture JSONB DEFAULT '[7,14,30]'::jsonb;

-- 3. Index pour accélérer la requête cron (filtre sur status + type + updated_at)
CREATE INDEX IF NOT EXISTS idx_documents_relances
  ON documents (workspace_id, type, status, updated_at)
  WHERE status IN ('sent', 'overdue');

-- 5. Colonnes Vapi.ai (agent vocal IA)
ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS vapi_api_key TEXT,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_enabled BOOLEAN DEFAULT false;

-- 6. Commentaires descriptifs
COMMENT ON COLUMN documents.relances_sent IS
  'Array des jours de relance déjà envoyés, ex: [3, 7]. Évite les doublons.';

COMMENT ON COLUMN workspace_settings.relances_enabled IS
  'Active ou désactive les relances automatiques pour ce workspace';

COMMENT ON COLUMN workspace_settings.relances_devis IS
  'Jours de relance pour les devis en attente, ex: [3, 7, 14]';

COMMENT ON COLUMN workspace_settings.relances_facture IS
  'Jours de relance pour les factures impayées, ex: [7, 14, 30]';
