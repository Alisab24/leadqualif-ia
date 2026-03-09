-- ============================================================
-- 🔧 FIX PHASE 1 FINAL — Script robuste avec vérifications
-- ============================================================


-- ============================================================
-- ÉTAPE 1 — document_counters : renommage conditionnel
-- ============================================================

DO $$
BEGIN
  -- Renomme "type" → "doc_type" seulement si "type" existe encore
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'document_counters'
      AND column_name  = 'type'
  ) THEN
    ALTER TABLE document_counters RENAME COLUMN "type" TO doc_type;
    RAISE NOTICE 'Colonne renommée : type → doc_type';
  ELSE
    RAISE NOTICE 'Colonne doc_type déjà en place, rien à faire.';
  END IF;
END $$;

-- Contrainte unique
ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_unique;
ALTER TABLE document_counters
  ADD CONSTRAINT document_counters_unique UNIQUE (organization_id, doc_type, year);

CREATE INDEX IF NOT EXISTS idx_doc_counters_org_type_year
  ON document_counters (organization_id, doc_type, year);

ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own document counters" ON document_counters;
CREATE POLICY "Users can manage their own document counters"
  ON document_counters FOR ALL
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());


-- ============================================================
-- ÉTAPE 2 — Fonction RPC generate_document_number
-- ============================================================

CREATE OR REPLACE FUNCTION generate_document_number(
  p_organization_id UUID,
  p_type            VARCHAR(10)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year     INTEGER;
  v_counter  INTEGER;
  v_result   TEXT;
  v_allowed_types VARCHAR(10)[] := ARRAY['FAC','DEV','MAN','BDV','OFF','RAP','CTR'];
BEGIN
  IF NOT (p_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Type de document non supporté : %', p_type;
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id ne peut pas être NULL';
  END IF;

  v_year := EXTRACT(YEAR FROM NOW());

  INSERT INTO document_counters (organization_id, doc_type, year, counter)
  VALUES (p_organization_id, p_type, v_year, 1)
  ON CONFLICT (organization_id, doc_type, year)
  DO UPDATE SET
    counter    = document_counters.counter + 1,
    updated_at = NOW()
  RETURNING counter INTO v_counter;

  v_result := p_type || '-' || v_year || '-' || LPAD(v_counter::TEXT, 6, '0');
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_document_number(UUID, VARCHAR) TO authenticated;


-- ============================================================
-- ÉTAPE 3 — documents : ajout des colonnes manquantes seulement
-- ============================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS numero_document VARCHAR(30);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_validite   DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_echeance   DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tva_enabled     BOOLEAN DEFAULT TRUE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes           TEXT;


-- ============================================================
-- ÉTAPE 4 — Index sur documents (colonnes réelles)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_agency   ON documents (agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead     ON documents (lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_type     ON documents (document_type);
CREATE INDEX IF NOT EXISTS idx_documents_statut   ON documents (statut);
CREATE INDEX IF NOT EXISTS idx_documents_created  ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_numero   ON documents (numero_document);


-- ============================================================
-- ÉTAPE 5 — Trigger updated_at
-- ============================================================

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
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- ÉTAPE 6 — RLS sur documents
-- ============================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can manage their documents" ON documents;
CREATE POLICY "Agency members can manage their documents"
  ON documents FOR ALL
  USING (agency_id = auth.uid())
  WITH CHECK (agency_id = auth.uid());


-- ============================================================
-- ✅ VÉRIFICATION FINALE
-- ============================================================

SELECT
  'document_counters' AS table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'document_counters'
UNION ALL
SELECT
  'documents' AS table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'documents'
  AND column_name IN ('numero_document','date_validite','date_echeance','tva_enabled','notes','document_type')
ORDER BY table_name, column_name;
