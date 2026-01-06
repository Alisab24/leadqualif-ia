-- FIX COMPLET - RECÉATION TABLE CRM_EVENTS
-- Exécuter ce script dans l'éditeur SQL Supabase

-- 1. Supprimer l'ancienne table si elle existe
DROP TABLE IF EXISTS crm_events CASCADE;

-- 2. Recréer la table crm_events
CREATE TABLE crm_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- 'document_generated', 'document_status_updated', 'call', 'email', 'meeting', 'note'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}', -- métadonnées spécifiques à l'événement
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT crm_events_type_check CHECK (type IN ('document_generated', 'document_status_updated', 'call', 'email', 'meeting', 'note', 'whatsapp', 'rdv'))
);

-- 3. Index pour optimiser les performances
CREATE INDEX idx_crm_events_agency_id ON crm_events(agency_id);
CREATE INDEX idx_crm_events_lead_id ON crm_events(lead_id);
CREATE INDEX idx_crm_events_type ON crm_events(type);
CREATE INDEX idx_crm_events_created_at ON crm_events(created_at);
CREATE INDEX idx_crm_events_lead_created ON crm_events(lead_id, created_at);

-- 4. Activer RLS (Row Level Security)
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS pour les événements CRM
CREATE POLICY "Les utilisateurs peuvent voir les événements de leur agence" ON crm_events
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Les utilisateurs peuvent créer des événements pour leur agence" ON crm_events
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- 6. Vérification de la création
SELECT 
    'crm_events' as table_name,
    'Table créée avec succès' as status,
    NOW() as created_at;

-- 7. Test d'insertion (optionnel - à décommenter pour tester)
-- INSERT INTO crm_events (lead_id, agency_id, type, title, description, metadata, created_by)
-- VALUES (
--   gen_random_uuid(), 
--   gen_random_uuid(), 
--   'document_generated', 
--   'Test événement', 
--   'Description de test', 
--   '{"document_type": "TEST", "version": 1}', 
--   auth.uid()
-- );

-- 8. Vérification du test
-- SELECT COUNT(*) as test_events FROM crm_events WHERE type = 'document_generated';
