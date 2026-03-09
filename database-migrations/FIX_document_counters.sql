-- ============================================================
-- 🔧 FIX — Correction de la table document_counters
-- ============================================================
-- PROBLÈME : La table document_counters existe déjà avec un
--            nom de colonne différent (ex: "type" au lieu de "doc_type")
--
-- ÉTAPE 1 : Exécuter ce script en PREMIER pour voir les colonnes actuelles
-- ÉTAPE 2 : Selon le résultat, choisir le bon bloc de correction ci-dessous
-- ============================================================


-- ============================================================
-- DIAGNOSTIC — Voir les colonnes actuelles de la table
-- (Exécuter UNIQUEMENT ce bloc d'abord)
-- ============================================================

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'document_counters'
  AND table_schema = 'public'
ORDER BY ordinal_position;


-- ============================================================
-- CORRECTION A — Si la colonne s'appelle "type" → renommer en "doc_type"
-- (Décommenter et exécuter si le diagnostic montre "type")
-- ============================================================

-- ALTER TABLE document_counters RENAME COLUMN "type" TO doc_type;

-- -- Supprimer l'ancienne contrainte unique (si elle existe avec l'ancien nom)
-- ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_unique;

-- -- Recréer la contrainte avec le bon nom de colonne
-- ALTER TABLE document_counters
--   ADD CONSTRAINT document_counters_unique UNIQUE (organization_id, doc_type, year);


-- ============================================================
-- CORRECTION B — Si la colonne s'appelle "document_type" → renommer
-- (Décommenter et exécuter si le diagnostic montre "document_type")
-- ============================================================

-- ALTER TABLE document_counters RENAME COLUMN document_type TO doc_type;

-- ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_unique;
-- ALTER TABLE document_counters
--   ADD CONSTRAINT document_counters_unique UNIQUE (organization_id, doc_type, year);


-- ============================================================
-- CORRECTION C — Si la colonne "doc_type" n'existe tout simplement pas
-- (Décommenter et exécuter si le diagnostic ne montre aucune colonne de type)
-- ============================================================

-- ALTER TABLE document_counters ADD COLUMN IF NOT EXISTS doc_type VARCHAR(10);

-- -- Mettre une valeur par défaut pour les lignes existantes (si nécessaire)
-- UPDATE document_counters SET doc_type = 'FAC' WHERE doc_type IS NULL;

-- -- Rendre la colonne NOT NULL
-- ALTER TABLE document_counters ALTER COLUMN doc_type SET NOT NULL;

-- -- Ajouter la contrainte unique
-- ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_unique;
-- ALTER TABLE document_counters
--   ADD CONSTRAINT document_counters_unique UNIQUE (organization_id, doc_type, year);


-- ============================================================
-- OPTION NUCLÉAIRE — Supprimer et recréer proprement
-- ⚠️  UNIQUEMENT si la table est vide ou si tu acceptes de perdre les données
-- (Décommenter et exécuter si tu veux repartir de zéro)
-- ============================================================

-- DROP TABLE IF EXISTS document_counters CASCADE;

-- CREATE TABLE document_counters (
--   id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
--   organization_id UUID    NOT NULL,
--   doc_type        VARCHAR(10) NOT NULL,
--   year            INTEGER NOT NULL,
--   counter         INTEGER NOT NULL DEFAULT 0,
--   created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   CONSTRAINT document_counters_unique UNIQUE (organization_id, doc_type, year)
-- );

-- CREATE INDEX IF NOT EXISTS idx_doc_counters_org_type_year
--   ON document_counters (organization_id, doc_type, year);

-- ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Users can manage their own document counters" ON document_counters;
-- CREATE POLICY "Users can manage their own document counters"
--   ON document_counters FOR ALL
--   USING (organization_id = auth.uid())
--   WITH CHECK (organization_id = auth.uid());
