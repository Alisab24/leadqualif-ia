-- ============================================================
-- FIX : Colonnes IA manquantes sur la table leads
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- score_qualification : score issu de l'analyse IA (0-100)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score_qualification INTEGER;

-- score_ia : alias score_qualification (compatibilité ancienne API)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score_ia INTEGER;

-- niveau_interet : CHAUD / TIÈDE / FROID (renseigné par l'IA)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS niveau_interet TEXT;

-- suggestion_ia : recommandation texte IA
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS suggestion_ia TEXT;

-- resume_ia : résumé contextuel IA
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS resume_ia TEXT;

-- ia_processed_at : date dernière analyse IA
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS ia_processed_at TIMESTAMPTZ;

-- Synchro score → score_qualification pour les leads déjà scorés
UPDATE leads
  SET score_qualification = score
  WHERE score IS NOT NULL
    AND score > 0
    AND score_qualification IS NULL;

-- Synchro score_qualification → score pour l'inverse
UPDATE leads
  SET score = score_qualification
  WHERE score_qualification IS NOT NULL
    AND score_qualification > 0
    AND score IS NULL;

-- ============================================================
-- RÉTRO-CALCUL niveau_interet pour les leads déjà scorés
-- (nécessaire pour que Stats affiche les bons taux Chaud/Tiède/Froid)
-- ============================================================
UPDATE leads
  SET niveau_interet =
    CASE
      WHEN COALESCE(score_qualification, score::integer, 0) >= 70 THEN 'CHAUD'
      WHEN COALESCE(score_qualification, score::integer, 0) >= 40 THEN 'TIÈDE'
      ELSE 'FROID'
    END
  WHERE niveau_interet IS NULL
    AND (
      (score_qualification IS NOT NULL AND score_qualification > 0)
      OR (score IS NOT NULL AND score::text ~ '^[0-9]+$' AND score::integer > 0)
    );

-- Vérification finale
SELECT 'Migration IA columns OK — '
  || COUNT(*) FILTER (WHERE score_qualification IS NOT NULL) || ' leads avec score_qualification, '
  || COUNT(*) FILTER (WHERE niveau_interet IS NOT NULL)      || ' leads avec niveau_interet, '
  || COUNT(*) FILTER (WHERE niveau_interet = 'CHAUD')        || ' CHAUD, '
  || COUNT(*) FILTER (WHERE niveau_interet = 'TIÈDE')        || ' TIÈDE, '
  || COUNT(*) FILTER (WHERE niveau_interet = 'FROID')        || ' FROID'
  AS result
FROM leads;
