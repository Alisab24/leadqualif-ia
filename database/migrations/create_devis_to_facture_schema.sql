/**
 * INGÉNIEUR SaaS - Migration SQL pour la conversion Devis → Facture
 * 
 * Architecture Stripe-like avec traçabilité complète
 */

-- Table pour l'audit trail des conversions (optionnel mais recommandé)
CREATE TABLE IF NOT EXISTS document_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'convert_devis_to_facture'
    devis_id UUID NOT NULL,
    devis_reference VARCHAR(50),
    facture_id UUID NOT NULL,
    facture_reference VARCHAR(50),
    montant_ht DECIMAL(12,2),
    montant_ttc DECIMAL(12,2),
    devise VARCHAR(3) DEFAULT 'EUR',
    agency_id UUID NOT NULL,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    
    -- Index pour les recherches
    CONSTRAINT fk_audit_trail_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_audit_trail_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Index pour optimisation
CREATE INDEX IF NOT EXISTS idx_audit_trail_transaction ON document_audit_trail(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_devis ON document_audit_trail(devis_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_facture ON document_audit_trail(facture_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_agency ON document_audit_trail(agency_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON document_audit_trail(timestamp);

-- Ajout de la colonne parent_document_id dans la table documents (si non existante)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'parent_document_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN parent_document_id UUID;
        
        -- Index pour les recherches de parent/enfant
        CREATE INDEX idx_documents_parent_id ON documents(parent_document_id);
        
        -- Index composé pour les conversions
        CREATE INDEX idx_documents_parent_type ON documents(parent_document_id, type);
        
        -- Commentaire pour la documentation
        COMMENT ON COLUMN documents.parent_document_id IS 'Lien vers le document parent (ex: devis pour une facture)';
    END IF;
END $$;

-- Ajout de colonnes pour la facturation (si non existantes)
DO $$
BEGIN
    -- Date de facturation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'date_facturation'
    ) THEN
        ALTER TABLE documents ADD COLUMN date_facturation DATE;
        COMMENT ON COLUMN documents.date_facturation IS 'Date de facturation pour les factures';
    END IF;
    
    -- Date d'échéance
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'date_echeance'
    ) THEN
        ALTER TABLE documents ADD COLUMN date_echeance DATE;
        COMMENT ON COLUMN documents.date_echeance IS 'Date d''échéance de paiement';
    END IF;
    
    -- Conditions de paiement
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'conditions_paiement'
    ) THEN
        ALTER TABLE documents ADD COLUMN conditions_paiement VARCHAR(100) DEFAULT '30 jours';
        COMMENT ON COLUMN documents.conditions_paiement IS 'Conditions de paiement (ex: 30 jours, 45 jours)';
    END IF;
    
    -- Mode de paiement
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'mode_paiement'
    ) THEN
        ALTER TABLE documents ADD COLUMN mode_paiement VARCHAR(50) DEFAULT 'Virement bancaire';
        COMMENT ON COLUMN documents.mode_paiement IS 'Mode de paiement (ex: Virement, Chèque, Carte)';
    END IF;
END $$;

-- Trigger pour mettre à jour le timestamp
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour la table documents
DROP TRIGGER IF EXISTS update_documents_timestamp ON documents;
CREATE TRIGGER update_documents_timestamp 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- Trigger pour la table audit_trail
CREATE TRIGGER update_audit_trail_timestamp 
    BEFORE UPDATE ON document_audit_trail 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- Vue pour les conversions (facilite les requêtes)
CREATE OR REPLACE VIEW v_conversions_devis_facture AS
SELECT 
    d.id as facture_id,
    d.reference as facture_reference,
    d.created_at as facture_date,
    d.total_ht,
    d.total_ttc,
    d.devise,
    d.client_nom,
    d.client_email,
    d.date_facturation,
    d.date_echeance,
    d.conditions_paiement,
    d.mode_paiement,
    d.agency_id,
    d.statut as facture_statut,
    
    -- Informations du devis parent
    parent.id as devis_id,
    parent.reference as devis_reference,
    parent.created_at as devis_date,
    parent.total_ht as devis_total_ht,
    parent.total_ttc as devis_total_ttc,
    parent.statut as devis_statut,
    
    -- Informations de conversion
    at.transaction_id,
    at.timestamp as conversion_timestamp,
    at.user_id as conversion_user_id,
    at.metadata as conversion_metadata,
    
    -- Calculs
    EXTRACT(EPOCH FROM (d.created_at - parent.created_at)) / 86400 as conversion_delay_days
    
FROM documents d
LEFT JOIN documents parent ON d.parent_document_id = parent.id
LEFT JOIN document_audit_trail at ON d.id = at.facture_id
WHERE d.type = 'facture' 
  AND d.parent_document_id IS NOT NULL;

-- Vue pour les statistiques de conversion
CREATE OR REPLACE VIEW v_stats_conversions_agence AS
SELECT 
    d.agency_id,
    COUNT(*) as total_conversions,
    SUM(d.total_ht) as total_montant_ht,
    SUM(d.total_ttc) as total_montant_ttc,
    AVG(d.total_ttc) as average_montant_ttc,
    MIN(d.total_ttc) as min_montant_ttc,
    MAX(d.total_ttc) as max_montant_ttc,
    DATE_TRUNC('month', d.created_at) as mois,
    EXTRACT(YEAR FROM d.created_at) as annee
FROM documents d
WHERE d.type = 'facture' 
  AND d.parent_document_id IS NOT NULL
GROUP BY d.agency_id, DATE_TRUNC('month', d.created_at), EXTRACT(YEAR FROM d.created_at)
ORDER BY d.agency_id, annee, mois;

-- Fonction pour vérifier l'intégrité des conversions
CREATE OR REPLACE FUNCTION verifier_integrite_conversion(facture_id UUID)
RETURNS TABLE(
    valid BOOLEAN,
    errors TEXT[],
    checks JSONB
) AS $$
DECLARE
    facture RECORD;
    devis RECORD;
    integrity_errors TEXT[] := '{}';
    checks JSONB := '{}';
    is_valid BOOLEAN := TRUE;
BEGIN
    -- Récupérer la facture
    SELECT * INTO facture FROM documents WHERE id = facture_id AND type = 'facture';
    
    IF NOT FOUND THEN
        integrity_errors := array_append(integrity_errors, 'Facture non trouvée');
        is_valid := FALSE;
    END IF;
    
    -- Récupérer le devis parent
    IF facture.parent_document_id IS NOT NULL THEN
        SELECT * INTO devis FROM documents WHERE id = facture.parent_document_id AND type = 'devis';
        
        IF NOT FOUND THEN
            integrity_errors := array_append(integrity_errors, 'Devis parent non trouvé');
            is_valid := FALSE;
        END IF;
    ELSE
        integrity_errors := array_append(integrity_errors, 'Pas de devis parent');
        is_valid := FALSE;
    END IF;
    
    -- Vérifications
    IF facture.parent_document_id IS NOT NULL AND devis.id IS NOT NULL THEN
        -- Vérification des montants
        IF facture.total_ht <> devis.total_ht THEN
            integrity_errors := array_append(integrity_errors, 'Montants HT différents');
            is_valid := FALSE;
        END IF;
        
        IF facture.total_ttc <> devis.total_ttc THEN
            integrity_errors := array_append(integrity_errors, 'Montants TTC différents');
            is_valid := FALSE;
        END IF;
        
        IF facture.tva_amount <> devis.tva_amount THEN
            integrity_errors := array_append(integrity_errors, 'Montants TVA différents');
            is_valid := FALSE;
        END IF;
        
        -- Vérification du client
        IF facture.client_nom <> devis.client_nom THEN
            integrity_errors := array_append(integrity_errors, 'Noms client différents');
            is_valid := FALSE;
        END IF;
        
        IF facture.client_email <> devis.client_email THEN
            integrity_errors := array_append(integrity_errors, 'Emails client différents');
            is_valid := FALSE;
        END IF;
        
        -- Vérification de l'agence
        IF facture.agency_id <> devis.agency_id THEN
            integrity_errors := array_append(integrity_errors, 'Agences différentes');
            is_valid := FALSE;
        END IF;
    END IF;
    
    -- Construction du JSON de checks
    checks := jsonb_build_object(
        'facture_exists', facture.id IS NOT NULL,
        'devis_exists', devis.id IS NOT NULL,
        'link_correct', facture.parent_document_id = devis.id,
        'montants_match', 
            CASE 
                WHEN facture.total_ht = devis.total_ht 
                     AND facture.total_ttc = devis.total_ttc 
                     AND facture.tva_amount = devis.tva_amount 
                THEN true 
                ELSE false 
            END,
        'client_match',
            CASE 
                WHEN facture.client_nom = devis.client_nom 
                     AND facture.client_email = devis.client_email 
                THEN true 
                ELSE false 
            END,
        'agency_match', facture.agency_id = devis.agency_id
    );
    
    RETURN QUERY SELECT is_valid, integrity_errors, checks;
END;
$$ LANGUAGE plpgsql;

-- Procédure pour le nettoyage des conversions orphelines
CREATE OR REPLACE FUNCTION nettoyer_conversions_orphelines()
RETURNS INTEGER AS $$
DECLARE
    count INTEGER := 0;
BEGIN
    -- Supprimer les factures qui n'ont pas de devis parent
    DELETE FROM documents 
    WHERE type = 'facture' 
      AND parent_document_id IS NOT NULL 
      AND parent_document_id NOT IN (SELECT id FROM documents WHERE type = 'devis');
    
    GET DIAGNOSTICS ROW_COUNT = count;
    
    -- Supprimer les audit trails sans documents
    DELETE FROM document_audit_trail 
    WHERE facture_id NOT IN (SELECT id FROM documents WHERE type = 'facture')
       OR devis_id NOT IN (SELECT id FROM documents WHERE type = 'devis');
    
    RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour la documentation
COMMENT ON TABLE document_audit_trail IS 'Audit trail pour les conversions de documents (Stripe-like)';
COMMENT ON VIEW v_conversions_devis_facture IS 'Vue des conversions devis→facture avec toutes les informations';
COMMENT ON VIEW v_stats_conversions_agence IS 'Vue des statistiques de conversion par agence';
COMMENT ON FUNCTION verifier_integrite_conversion(UUID) IS 'Vérifie l''intégrité d''une conversion devis→facture';
COMMENT ON FUNCTION nettoyer_conversions_orphelines() IS 'Nettoie les conversions orphelines';

-- Exemples de requêtes utiles
/*
-- 1. Lister toutes les conversions d'une agence
SELECT * FROM v_conversions_devis_facture WHERE agency_id = 'uuid-agence';

-- 2. Statistiques de conversion mensuelles
SELECT * FROM v_stats_conversions_agence WHERE agency_id = 'uuid-agence';

-- 3. Vérifier l'intégrité d'une conversion
SELECT * FROM verifier_integrite_conversion('uuid-facture');

-- 4. Historique des conversions pour un devis
SELECT * FROM document_audit_trail WHERE devis_id = 'uuid-devis';

-- 5. Conversions récentes
SELECT * FROM v_conversions_devis_facture 
ORDER BY facture_date DESC 
LIMIT 10;
*/
