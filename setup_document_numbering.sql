-- CRÉER LA FONCTION RPC POUR LA NUMÉROTATION DES DOCUMENTS
-- Exécuter ce script dans Supabase SQL Editor

-- 1. D'abord, s'assurer que la table document_counters existe
CREATE TABLE IF NOT EXISTS document_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('facture', 'devis')),
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contrainte unique : 1 ligne par user_id + type + année
  UNIQUE(user_id, type, year)
);

-- 2. Créer la fonction de génération de numéro
CREATE OR REPLACE FUNCTION generate_document_number(
    p_user_id UUID,
    p_type TEXT,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())
) RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_new_number INTEGER;
    v_formatted_number TEXT;
    v_counter_id UUID;
BEGIN
    -- Validation des entrées
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id est requis';
    END IF;
    
    IF p_type NOT IN ('facture', 'devis') THEN
        RAISE EXCEPTION 'Type doit être "facture" ou "devis"';
    END IF;
    
    -- Déterminer le préfixe
    CASE p_type
        WHEN 'facture' THEN v_prefix := 'FAC';
        WHEN 'devis' THEN v_prefix := 'DEV';
        ELSE v_prefix := 'DOC';
    END CASE;
    
    -- Verrouillage pour éviter les doublons (transactionnel)
    SELECT id, last_number INTO v_counter_id, v_new_number
    FROM document_counters
    WHERE user_id = p_user_id 
      AND type = p_type 
      AND year = p_year
    FOR UPDATE;
    
    -- Si aucun compteur n'existe, en créer un
    IF v_counter_id IS NULL THEN
        v_new_number := 1;
        
        INSERT INTO document_counters (
            user_id, type, year, last_number
        ) VALUES (
            p_user_id, p_type, p_year, v_new_number
        ) RETURNING id INTO v_counter_id;
    ELSE
        -- Incrémenter le compteur existant
        v_new_number := v_new_number + 1;
        
        UPDATE document_counters 
        SET last_number = v_new_number,
            updated_at = NOW()
        WHERE id = v_counter_id;
    END IF;
    
    -- Formater le numéro : TYPE-ANNEE-000XXX
    v_formatted_number := v_prefix || '-' || p_year || '-' || LPAD(v_new_number::TEXT, 6, '0');
    
    RETURN v_formatted_number;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur génération numéro document: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 3. Donner les droits d'exécution
GRANT EXECUTE ON FUNCTION generate_document_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_document_number TO service_role;

-- 4. Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_document_counters_lookup ON document_counters(user_id, type, year);

-- 5. Test de la fonction (optionnel)
-- SELECT generate_document_number('votre-user-id-uuid', 'facture', 2026);
