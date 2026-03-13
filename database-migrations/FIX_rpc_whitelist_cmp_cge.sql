-- ============================================================
-- FIX : Ajouter CMP (Compromis) et CGE (Contrat de gestion)
--       au whitelist de la fonction RPC generate_document_number
--
-- Problème : le whitelist original était limité à
--   ['FAC','DEV','MAN','BDV','OFF','RAP','CTR']
--   → CMP et CGE levaient une exception → fallback timestamp
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → Run
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

  -- ✅ Whitelist étendue : CMP et CGE ajoutés
  v_allowed_types VARCHAR(10)[] := ARRAY[
    'FAC','DEV','MAN','BDV','OFF','RAP','CTR',
    'CMP',  -- Compromis
    'CGE'   -- Contrat de gestion
  ];
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

  -- Incrémenter le compteur atomiquement
  INSERT INTO document_counters (organization_id, doc_type, year, counter)
  VALUES (p_organization_id, p_type, v_year, 1)
  ON CONFLICT (organization_id, doc_type, year)
  DO UPDATE SET
    counter    = document_counters.counter + 1,
    updated_at = NOW()
  RETURNING counter INTO v_counter;

  -- Format : CMP-2026-000001
  v_result := p_type || '-' || v_year || '-' || LPAD(v_counter::TEXT, 6, '0');

  RETURN v_result;
END;
$$;

-- Maintenir le droit d'exécution
GRANT EXECUTE ON FUNCTION generate_document_number(UUID, VARCHAR) TO authenticated;


-- ============================================================
-- OPTIONNEL : Corriger les anciens documents sauvegardés avec
-- un mauvais préfixe (ex: référence type 'DEV-2026-...' pour
-- un document de type 'compromis' ou 'contrat_gestion')
--
-- Décommenter et adapter si nécessaire après avoir vérifié
-- vos données dans Table Editor → documents
-- ============================================================

-- Correction des compromis avec mauvais préfixe DEV-
-- UPDATE documents
--   SET reference = REPLACE(reference, 'DEV-', 'CMP-')
-- WHERE type = 'compromis'
--   AND reference LIKE 'DEV-%';

-- Correction des contrats de gestion avec mauvais préfixe DEV-
-- UPDATE documents
--   SET reference = REPLACE(reference, 'DEV-', 'CGE-')
-- WHERE type = 'contrat_gestion'
--   AND reference LIKE 'DEV-%';


-- ============================================================
-- Vérification : tester la génération des nouveaux types
-- ============================================================

-- ✅ Test CMP (remplacer par votre user_id depuis auth.users) :
-- SELECT generate_document_number('<votre-user-id>'::UUID, 'CMP');

-- ✅ Test CGE :
-- SELECT generate_document_number('<votre-user-id>'::UUID, 'CGE');

-- ✅ Voir les types autorisés vérifiés :
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'generate_document_number';
