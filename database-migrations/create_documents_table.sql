-- Création de la table documents (source unique des documents)
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- 'Bon de Visite', 'Mandat de Vente', etc.
  title VARCHAR(255) NOT NULL,
  content TEXT, -- contenu JSON du document
  metadata JSONB DEFAULT '{}', -- métadonnées supplémentaires
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'Généré', -- 'Brouillon', 'Généré', 'Envoyé', 'Signé'
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT documents_status_check CHECK (status IN ('Brouillon', 'Généré', 'Envoyé', 'Signé')),
  CONSTRAINT documents_version_positive CHECK (version > 0)
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_lead_type_version ON documents(lead_id, type, version);

-- RLS (Row Level Security)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour les documents
CREATE POLICY "Les utilisateurs peuvent voir les documents de leur agence" ON documents
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Les utilisateurs peuvent créer des documents pour leur agence" ON documents
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Les utilisateurs peuvent mettre à jour les documents de leur agence" ON documents
  FOR UPDATE USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
