-- Création de la table documents pour LeadQualif IA
-- Structure minimale et fonctionnelle

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES profiles(agency_id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('devis', 'contrat', 'facture')),
  statut TEXT NOT NULL DEFAULT 'généré' CHECK (statut IN ('brouillon', 'généré', 'envoyé', 'signé')),
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

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
