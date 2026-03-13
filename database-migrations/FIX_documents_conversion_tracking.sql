-- ============================================================
-- FIX: Suivi de conversion et CA dans la table documents
-- Ajoute la colonne parent_document_id (chaîne devis → facture)
-- et les colonnes de dates de facturation/échéance
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- Lien parent (Stripe-like : facture pointe vers son devis d'origine)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_facturation   DATE,
  ADD COLUMN IF NOT EXISTS date_echeance      DATE,
  ADD COLUMN IF NOT EXISTS conditions_paiement TEXT,
  ADD COLUMN IF NOT EXISTS mode_paiement      TEXT,
  ADD COLUMN IF NOT EXISTS content_json       JSONB;

-- Index pour retrouver rapidement les factures d'un devis
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_document_id);

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name IN ('parent_document_id','date_facturation','date_echeance','content_json')
ORDER BY column_name;
