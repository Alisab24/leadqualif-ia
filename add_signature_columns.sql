-- Migration : page de signature maison (sans DocuSeal)
-- Exécuter dans Supabase SQL Editor

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signature_token   UUID        UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS signature_data    TEXT        DEFAULT NULL,  -- base64 image PNG
  ADD COLUMN IF NOT EXISTS signer_confirmed  TEXT        DEFAULT NULL,  -- nom tapé par le client
  ADD COLUMN IF NOT EXISTS signed_at         TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS signer_ip         TEXT        DEFAULT NULL;

-- Index pour recherche rapide par token
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_signature_token
  ON documents (signature_token) WHERE signature_token IS NOT NULL;
