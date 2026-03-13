-- ============================================================
-- FIX: Contrainte CHECK sur la colonne 'type' de la table documents
-- Permet les nouveaux types : bon_visite, contrat_gestion, compromis, rapport, contrat, autre
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Supprimer l'ancienne contrainte CHECK si elle existe
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'documents'::regclass
    AND contype = 'c'
    AND conname ILIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE documents DROP CONSTRAINT ' || quote_ident(constraint_name);
    RAISE NOTICE 'Contrainte % supprimée', constraint_name;
  ELSE
    RAISE NOTICE 'Aucune contrainte CHECK sur type trouvée';
  END IF;
END $$;

-- 2. Ajouter une contrainte étendue acceptant tous les types Nexap
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN (
    'devis',
    'facture',
    'mandat',
    'bon_visite',
    'bon_de_visite',
    'compromis',
    'contrat_gestion',
    'contrat',
    'rapport',
    'autre'
  ));

-- 3. Mettre à jour les lignes existantes avec type='autre' (celles insérées en fallback)
-- (optionnel — ne change rien si aucune ligne 'autre' n'existe)
UPDATE documents SET type = 'mandat'          WHERE type = 'autre' AND titre ILIKE 'Mandat%';
UPDATE documents SET type = 'bon_visite'      WHERE type = 'autre' AND titre ILIKE 'Bon de visite%';
UPDATE documents SET type = 'compromis'       WHERE type = 'autre' AND titre ILIKE 'Compromis%';
UPDATE documents SET type = 'contrat_gestion' WHERE type = 'autre' AND titre ILIKE 'Contrat de gestion%';
UPDATE documents SET type = 'contrat'         WHERE type = 'autre' AND titre ILIKE 'Contrat de prestation%';
UPDATE documents SET type = 'rapport'         WHERE type = 'autre' AND titre ILIKE 'Rapport%';

-- 4. Vérification
SELECT type, COUNT(*) FROM documents GROUP BY type ORDER BY type;
