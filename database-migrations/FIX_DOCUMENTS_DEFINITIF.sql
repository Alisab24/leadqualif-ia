-- ============================================================
-- FIX DÉFINITIF — Table documents
-- Corrige TOUS les problèmes en une seule exécution :
--   1. Colonnes manquantes (titre, statut, reference, client_nom…)
--   2. Contrainte CHECK étendue (tous types acceptés)
--   3. RLS simplifié (agency_id = auth.uid())
--   4. Colonnes de conversion (parent_document_id…)
--   5. Colonne devise
--
-- ✅ Sûr à ré-exécuter (IF NOT EXISTS partout)
-- À exécuter : Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ── 1. Colonnes de base manquantes ─────────────────────────

-- Colonne titre (code écrit 'titre' pas 'title')
ALTER TABLE documents ADD COLUMN IF NOT EXISTS titre        TEXT;
-- Colonne statut (code écrit 'statut' pas 'status')
ALTER TABLE documents ADD COLUMN IF NOT EXISTS statut       TEXT DEFAULT 'généré';
-- Informations client
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_nom   TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_telephone TEXT;
-- Devise
ALTER TABLE documents ADD COLUMN IF NOT EXISTS devise       TEXT DEFAULT 'EUR';
-- Référence (numéro légal : FAC-2026-000001 etc.)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reference    TEXT;
-- Montants financiers
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_ttc    NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_ht     NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tva_amount   NUMERIC(12,2);
-- HTML persisté (architecture Stripe-like)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS preview_html TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS fichier_url  TEXT;


-- ── 2. Colonnes de conversion (devis → facture) ─────────────

ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_facturation   DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_echeance      DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS conditions_paiement TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mode_paiement      TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_json       JSONB;

-- Index pour la conversion
CREATE INDEX IF NOT EXISTS idx_documents_parent_id
  ON documents (parent_document_id);


-- ── 3. Contrainte CHECK sur type — supprimer l'ancienne ─────

DO $$
DECLARE v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'documents'::regclass AND contype = 'c'
    AND (conname ILIKE '%type%' OR conname ILIKE '%status%' OR conname ILIKE '%statut%');
  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE documents DROP CONSTRAINT ' || quote_ident(v_constraint);
    RAISE NOTICE 'Ancienne contrainte supprimée : %', v_constraint;
  END IF;
END $$;

-- Supprimer la contrainte CHECK sur statut (bloque 'généré')
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_statut_check;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;

-- Ajouter une contrainte permissive sur type
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN (
    'devis','facture','mandat','bon_visite','bon_de_visite',
    'compromis','contrat_gestion','contrat','rapport','autre'
  ));

-- Pas de contrainte CHECK sur statut — trop fragile avec les données existantes.
-- La normalisation est gérée côté application via normalizeStatut().


-- ── 4. RLS — politique simplifiée (agency_id = auth.uid()) ──

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Supprimer TOUTES les politiques existantes sur documents (évite les conflits)
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir les documents de leur agence" ON documents;
DROP POLICY IF EXISTS "Les utilisateurs peuvent créer des documents pour leur agence" ON documents;
DROP POLICY IF EXISTS "Les utilisateurs peuvent mettre à jour les documents de leur agence" ON documents;
DROP POLICY IF EXISTS "Agency members can manage their documents" ON documents;
DROP POLICY IF EXISTS "Users manage own documents" ON documents;

-- Nouvelle politique unique : l'utilisateur gère ses propres documents
CREATE POLICY "Users manage own documents"
  ON documents FOR ALL
  USING   (agency_id = auth.uid())
  WITH CHECK (agency_id = auth.uid());


-- ── 5. Rétablir les index utiles ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documents_agency_id  ON documents (agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id    ON documents (lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_type       ON documents (type);
CREATE INDEX IF NOT EXISTS idx_documents_statut     ON documents (statut);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_reference  ON documents (reference);


-- ── 6. Trigger updated_at ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 7. Vérification finale ──────────────────────────────────
-- Exécutez la commande suivante pour confirmer les colonnes présentes :

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'documents'
ORDER BY ordinal_position;
