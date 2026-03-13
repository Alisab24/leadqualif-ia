-- ============================================================
-- FIX CIBLÉ — 2 erreurs console identifiées
--
-- ERREUR 1 : PGRST203 "Could not choose the best candidate function"
--   → Deux versions de generate_document_number coexistent en DB
--     (une avec VARCHAR(10), une avec TEXT)
--   → Supabase/PostgREST ne sait pas laquelle appeler
--
-- ERREUR 2 : 23514 "violates check constraint documents_statut_check"
--   → La colonne statut a une contrainte CHECK qui n'accepte pas 'généré'
--
-- ✅ Exécuter dans Supabase → SQL Editor → Run
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- FIX 1 : Supprimer TOUTES les versions de generate_document_number
--         et recréer une seule version canonique
-- ════════════════════════════════════════════════════════════

-- Supprimer les deux surcharges connues
DROP FUNCTION IF EXISTS generate_document_number(UUID, VARCHAR);
DROP FUNCTION IF EXISTS generate_document_number(UUID, TEXT);
-- Sécurité : supprimer toute autre surcharge éventuelle
DROP FUNCTION IF EXISTS generate_document_number(UUID, VARCHAR(10));
DROP FUNCTION IF EXISTS generate_document_number(uuid, varchar);
DROP FUNCTION IF EXISTS generate_document_number(uuid, text);

-- Recréer UNE SEULE version canonique (TEXT évite les ambiguïtés)
CREATE OR REPLACE FUNCTION generate_document_number(
  p_organization_id UUID,
  p_type            TEXT         -- TEXT (pas VARCHAR) pour éviter PGRST203
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year     INTEGER;
  v_counter  INTEGER;
  v_result   TEXT;

  -- Whitelist complète (inclut CMP et CGE)
  v_allowed_types TEXT[] := ARRAY[
    'FAC','DEV','MAN','BDV','OFF','RAP','CTR',
    'CMP',   -- Compromis
    'CGE'    -- Contrat de gestion
  ];
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

  -- Format : FAC-2026-000001
  v_result := p_type || '-' || v_year || '-' || LPAD(v_counter::TEXT, 6, '0');
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_document_number(UUID, TEXT) TO authenticated;

-- Vérification : doit retourner 1 seule ligne
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'generate_document_number';


-- ════════════════════════════════════════════════════════════
-- FIX 2 : Supprimer la contrainte CHECK sur statut
--         qui bloque l'insertion de 'généré'
-- ════════════════════════════════════════════════════════════

-- Supprimer la contrainte par son nom exact (visible dans l'erreur console)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_statut_check;

-- Supprimer aussi toutes les variantes connues
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS statut_check;

-- Supprimer par recherche dynamique (cas où le nom aurait été auto-généré)
DO $$
DECLARE v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'documents'::regclass
      AND contype = 'c'
      AND (conname ILIKE '%statut%' OR conname ILIKE '%status%')
  LOOP
    EXECUTE 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint);
    RAISE NOTICE 'Contrainte statut supprimée : %', v_constraint;
  END LOOP;
END $$;

-- Ajouter une contrainte permissive qui accepte tous les statuts utilisés
ALTER TABLE documents
  ADD CONSTRAINT documents_statut_check
  CHECK (statut IN (
    'brouillon',
    'généré',    -- valeur écrite par le code JS
    'genere',    -- alias sans accent (sécurité)
    'émis',
    'émise',
    'envoyé',
    'envoyée',
    'signé',
    'signée',
    'validé',
    'facturé',
    'converti',
    'payé',
    'payée',
    'annulé'
  ));

-- Vérification : contraintes restantes sur documents
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'documents'::regclass AND contype = 'c'
ORDER BY conname;
