-- ============================================================
-- 📄 PHASE 1 — Numérotation complète de tous les types de documents
-- ============================================================
-- OBJECTIF : Étendre le système de numérotation automatique pour
--            supporter TOUS les types : FAC, DEV, MAN, BDV, OFF, RAP, CTR
--
-- À EXÉCUTER dans : Supabase Dashboard → SQL Editor → Run
-- Safe à re-exécuter : CREATE TABLE IF NOT EXISTS + OR REPLACE
-- ============================================================


-- ============================================================
-- ÉTAPE 1 — Table des compteurs de documents (si pas encore créée)
-- ============================================================

CREATE TABLE IF NOT EXISTS document_counters (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID    NOT NULL,
  doc_type        VARCHAR(10) NOT NULL,   -- FAC, DEV, MAN, BDV, OFF, RAP, CTR
  year            INTEGER NOT NULL,
  counter         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT document_counters_unique UNIQUE (organization_id, doc_type, year)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_doc_counters_org_type_year
  ON document_counters (organization_id, doc_type, year);

-- Activer RLS
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- Politique : lecture et écriture uniquement pour le propriétaire
DROP POLICY IF EXISTS "Users can manage their own document counters" ON document_counters;
CREATE POLICY "Users can manage their own document counters"
  ON document_counters
  FOR ALL
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());


-- ============================================================
-- ÉTAPE 2 — Fonction RPC : generate_document_number
-- ============================================================
-- Appelée via : supabase.rpc('generate_document_number', { p_organization_id, p_type })
-- Retourne   : 'FAC-2026-000042'  /  'MAN-2026-000001'  etc.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_document_number(
  p_organization_id UUID,
  p_type            VARCHAR(10)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER  -- Contourne RLS pour les compteurs internes
AS $$
DECLARE
  v_year     INTEGER;
  v_counter  INTEGER;
  v_result   TEXT;

  -- Types autorisés (whitelist)
  v_allowed_types VARCHAR(10)[] := ARRAY['FAC','DEV','MAN','BDV','OFF','RAP','CTR'];
BEGIN
  -- Vérification du type
  IF NOT (p_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Type de document non supporté : %', p_type;
  END IF;

  -- Vérification de l'organisation
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id ne peut pas être NULL';
  END IF;

  v_year := EXTRACT(YEAR FROM NOW());

  -- Incrémenter le compteur atomiquement (évite les races conditions)
  INSERT INTO document_counters (organization_id, doc_type, year, counter)
  VALUES (p_organization_id, p_type, v_year, 1)
  ON CONFLICT (organization_id, doc_type, year)
  DO UPDATE SET
    counter    = document_counters.counter + 1,
    updated_at = NOW()
  RETURNING counter INTO v_counter;

  -- Format : FAC-2026-000042
  v_result := p_type || '-' || v_year || '-' || LPAD(v_counter::TEXT, 6, '0');

  RETURN v_result;
END;
$$;

-- Autoriser les utilisateurs authentifiés à appeler la fonction
GRANT EXECUTE ON FUNCTION generate_document_number(UUID, VARCHAR) TO authenticated;


-- ============================================================
-- ÉTAPE 3 — Table documents (ajout des colonnes manquantes)
-- ============================================================

-- S'assurer que la table documents existe avec les bonnes colonnes
CREATE TABLE IF NOT EXISTS documents (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       UUID    NOT NULL,
  lead_id         UUID,
  type_document   VARCHAR(50)  NOT NULL,    -- facture, devis, mandat, bon_de_visite, offre_achat, rapport, contrat
  numero_document VARCHAR(30),              -- FAC-2026-000001
  statut          VARCHAR(50)  DEFAULT 'brouillon',  -- brouillon, envoyé, signé, payé, annulé
  contenu         JSONB,                    -- Items, totaux, notes, etc.
  fichier_url     TEXT,                     -- Lien Supabase Storage (futur)
  date_validite   DATE,
  date_echeance   DATE,
  montant_ht      NUMERIC(12,2),
  montant_tva     NUMERIC(12,2),
  montant_ttc     NUMERIC(12,2),
  tva_enabled     BOOLEAN DEFAULT TRUE,
  tva_rate        NUMERIC(5,2) DEFAULT 20.00,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colonnes optionnelles ajoutées progressivement (IF NOT EXISTS = safe)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS numero_document VARCHAR(30);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_validite   DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_echeance   DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS montant_ht      NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS montant_tva     NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS montant_ttc     NUMERIC(12,2);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tva_enabled     BOOLEAN DEFAULT TRUE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tva_rate        NUMERIC(5,2) DEFAULT 20.00;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contenu         JSONB;

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_documents_agency    ON documents (agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead      ON documents (lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_type      ON documents (type_document);
CREATE INDEX IF NOT EXISTS idx_documents_statut    ON documents (statut);
CREATE INDEX IF NOT EXISTS idx_documents_created   ON documents (created_at DESC);

-- Trigger updated_at (réutilise la fonction si elle existe déjà)
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

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can manage their documents" ON documents;
CREATE POLICY "Agency members can manage their documents"
  ON documents
  FOR ALL
  USING (agency_id = auth.uid())
  WITH CHECK (agency_id = auth.uid());


-- ============================================================
-- ÉTAPE 4 — Vérification (décommenter pour tester après Run)
-- ============================================================

-- ✅ Tester la génération d'un numéro (remplacer l'UUID par votre user_id) :
-- SELECT generate_document_number('<votre-user-id>'::UUID, 'FAC');
-- SELECT generate_document_number('<votre-user-id>'::UUID, 'MAN');
-- SELECT generate_document_number('<votre-user-id>'::UUID, 'BDV');

-- ✅ Voir les compteurs :
-- SELECT * FROM document_counters ORDER BY updated_at DESC;

-- ✅ Voir les politiques RLS :
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('document_counters','documents');
