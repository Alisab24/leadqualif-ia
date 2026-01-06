-- FIX COMPLET - RECÉATION TABLE DOCUMENTS
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Supprimer l'ancienne table si elle existe (pour nettoyer)
DROP TABLE IF EXISTS documents CASCADE;

-- 2. Recréer la table documents avec la structure complète
CREATE TABLE documents (
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

-- 3. Index pour optimiser les performances
CREATE INDEX idx_documents_agency_id ON documents(agency_id);
CREATE INDEX idx_documents_lead_id ON documents(lead_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_lead_type_version ON documents(lead_id, type, version);

-- 4. Activer RLS (Row Level Security)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS pour les documents
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

-- 6. Trigger pour mettre à jour updated_at
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

-- 7. Vérification de la création
SELECT 
    'documents' as table_name,
    'Table créée avec succès' as status,
    NOW() as created_at;

-- 8. Test d'insertion (optionnel - à décommenter pour tester)
-- INSERT INTO documents (lead_id, agency_id, type, title, content, metadata, version, status, created_by, updated_by)
-- VALUES (
--   gen_random_uuid(), 
--   gen_random_uuid(), 
--   'TEST', 
--   'Document de test', 
--   '{"test": true}', 
--   '{"debug": true}', 
--   1, 
--   'Généré', 
--   auth.uid(), 
--   auth.uid()
-- );

-- 9. Vérification du test
-- SELECT COUNT(*) as test_documents FROM documents WHERE type = 'TEST';
