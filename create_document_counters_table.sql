-- Table pour les compteurs de documents (indépendante et safe)
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

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_document_counters_lookup ON document_counters(user_id, type, year);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_document_counters_updated_at 
    BEFORE UPDATE ON document_counters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Commentaires sur la table
COMMENT ON TABLE document_counters IS 'Compteurs de documents pour numérotation légale';
COMMENT ON COLUMN document_counters.id IS 'Identifiant unique du compteur';
COMMENT ON COLUMN document_counters.user_id IS 'ID de l\'utilisateur (lié à profiles)';
COMMENT ON COLUMN document_counters.type IS 'Type de document : facture ou devis';
COMMENT ON COLUMN document_counters.year IS 'Année comptable';
COMMENT ON COLUMN document_counters.last_number IS 'Dernier numéro utilisé';
COMMENT ON COLUMN document_counters.created_at IS 'Date de création';
COMMENT ON COLUMN document_counters.updated_at IS 'Date de dernière mise à jour';
