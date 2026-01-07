-- Création de la table documents pour LeadQualif IA
-- Structure minimale et fonctionnelle

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES profiles(agency_id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type_document TEXT NOT NULL CHECK (type_document IN ('devis', 'contrat', 'mandat', 'facture', 'autre')),
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'généré', 'envoyé', 'signé')),
  fichier_url TEXT,
  contenu TEXT, -- Pour stocker le contenu temporaire ou les métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) pour la sécurité
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politique de sécurité : les utilisateurs ne voient que les documents de leur agence
CREATE POLICY "Users can view their agency documents"
  ON documents FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Politique de sécurité : les utilisateurs peuvent insérer des documents pour leur agence
CREATE POLICY "Users can insert their agency documents"
  ON documents FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Politique de sécurité : les utilisateurs peuvent modifier les documents de leur agence
CREATE POLICY "Users can update their agency documents"
  ON documents FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Politique de sécurité : les utilisateurs peuvent supprimer les documents de leur agence
CREATE POLICY "Users can delete their agency documents"
  ON documents FOR DELETE
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );
