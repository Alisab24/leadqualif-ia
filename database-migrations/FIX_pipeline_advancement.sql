-- ============================================================
-- FIX : Avancement automatique du pipeline Kanban
-- EXÉCUTER DANS : Supabase → SQL Editor → Run
-- ============================================================

-- ── ÉTAPE 1 : Ajouter la colonne statut si elle n'existe pas ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'statut'
  ) THEN
    ALTER TABLE leads ADD COLUMN statut TEXT DEFAULT 'À traiter';
    RAISE NOTICE 'Colonne statut ajoutée à leads';
  ELSE
    RAISE NOTICE 'Colonne statut déjà présente';
  END IF;
END $$;

-- ── ÉTAPE 2 : Synchroniser statut depuis statut_crm pour les leads existants ─
UPDATE leads
SET statut = COALESCE(statut_crm, 'À traiter')
WHERE statut IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'statut_crm'
  );

-- ── ÉTAPE 3 : S'assurer que RLS est activé et les policies correctes ─
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies conflictuelles
DROP POLICY IF EXISTS "leads_update_own"                             ON leads;
DROP POLICY IF EXISTS "Users can update leads from their agency"     ON leads;
DROP POLICY IF EXISTS "leads_update_agency"                         ON leads;

-- Recréer la policy UPDATE propre
CREATE POLICY "leads_update_own" ON leads
  FOR UPDATE
  USING (
    agency_id = auth.uid()
    OR agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ── ÉTAPE 4 : Créer la fonction RPC advance_lead_statut ─────
-- Cette fonction est appelée depuis le frontend pour avancer
-- le statut pipeline d'un lead de façon atomique et sécurisée.
-- SECURITY DEFINER : contourne RLS pour garantir le fonctionnement.
-- La sécurité est assurée par le check agency_id dans la fonction.

CREATE OR REPLACE FUNCTION advance_lead_statut(
  p_lead_id     UUID,
  p_target      TEXT,
  p_force       BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current     TEXT;
  v_agency_id   UUID;
  v_pipeline    TEXT[] := ARRAY[
    'À traiter', 'Contacté', 'RDV fixé', 'Offre en cours',
    'Négociation', 'Gagné', 'Perdu', 'Archivé'
  ];
  v_cur_idx     INT;
  v_tgt_idx     INT;
  v_nego_idx    INT := 5; -- index 1-based de 'Négociation'
BEGIN
  -- Récupérer le lead et vérifier l'appartenance à l'agence
  SELECT statut, agency_id
  INTO v_current, v_agency_id
  FROM leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN NULL; -- lead introuvable
  END IF;

  -- Vérification sécurité : le lead appartient à l'utilisateur courant
  IF v_agency_id != auth.uid() AND v_agency_id NOT IN (
    SELECT agency_id FROM profiles WHERE user_id = auth.uid()
  ) THEN
    RETURN NULL; -- accès refusé
  END IF;

  -- Indices 1-based dans le tableau
  v_cur_idx := array_position(v_pipeline, v_current);
  v_tgt_idx := array_position(v_pipeline, p_target);

  -- Si statut inconnu → on autorise (lead avec ancienne valeur)
  IF v_cur_idx IS NULL THEN
    v_cur_idx := 0;
  END IF;

  -- Règles d'avancement :
  -- 1. Ne jamais rétrograder (current >= target)
  -- 2. Ne pas toucher Négociation/Gagné/Perdu/Archivé (sauf force=true)
  IF v_tgt_idx IS NULL THEN
    RETURN v_current; -- cible inconnue
  END IF;

  IF v_cur_idx >= v_tgt_idx THEN
    RETURN v_current; -- déjà à ce stade ou plus loin
  END IF;

  IF NOT p_force AND v_cur_idx >= v_nego_idx THEN
    RETURN v_current; -- statut terminal, pas de force
  END IF;

  -- Mettre à jour
  UPDATE leads
  SET statut = p_target
  WHERE id = p_lead_id;

  RETURN p_target;
END;
$$;

-- Autoriser les utilisateurs authentifiés à appeler la fonction
GRANT EXECUTE ON FUNCTION advance_lead_statut(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION advance_lead_statut(UUID, TEXT, BOOLEAN) TO anon;

-- ── VÉRIFICATION ──────────────────────────────────────────────
SELECT 'Colonne statut:' AS check_item,
       column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'statut';

SELECT 'Fonction RPC:' AS check_item, routine_name
FROM information_schema.routines
WHERE routine_name = 'advance_lead_statut';

SELECT 'Policies leads:' AS check_item, policyname, cmd
FROM pg_policies
WHERE tablename = 'leads'
ORDER BY cmd;
