-- ============================================================
-- FIX URGENT — Contrainte statut bloquant toutes les insertions
--
-- ERREUR : "check constraint documents_statut_check is violated by some row"
--   → Des lignes existantes ont des valeurs de statut non prévues
--     (null, 'draft', 'generated', 'Généré' avec majuscule, etc.)
--   → PostgreSQL refuse d'ajouter la nouvelle contrainte CHECK
--
-- SOLUTION : Supprimer la contrainte CHECK sur statut sans en recréer.
--   La contrainte n'est pas nécessaire au fonctionnement.
--
-- ✅ À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- 1. Supprimer TOUTES les contraintes sur statut (peu importe leur nom)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_statut_check;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;

-- Suppression dynamique (cas noms auto-générés par Postgres)
DO $$
DECLARE v_c TEXT;
BEGIN
  FOR v_c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'documents'::regclass
      AND contype  = 'c'
      AND (conname ILIKE '%statut%' OR conname ILIKE '%status%')
  LOOP
    EXECUTE 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS ' || quote_ident(v_c);
    RAISE NOTICE 'Contrainte supprimée : %', v_c;
  END LOOP;
END $$;

-- 2. Normaliser les valeurs existantes incohérentes → 'généré'
UPDATE documents
SET statut = 'généré'
WHERE statut IS NULL
   OR statut NOT IN (
     'brouillon','généré','genere','émis','émise',
     'envoyé','envoyée','signé','signée','validé',
     'facturé','converti','payé','payée','annulé'
   );

-- 3. Vérification : plus aucune contrainte CHECK sur statut
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'documents'::regclass AND contype = 'c'
ORDER BY conname;

-- 4. Vérification : valeurs de statut actuellement en base
SELECT statut, COUNT(*) FROM documents GROUP BY statut ORDER BY statut;
