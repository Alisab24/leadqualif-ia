-- Création de la table crm_events (historique CRM unifié)
CREATE TABLE IF NOT EXISTS crm_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- 'document_generated', 'document_status_updated', 'call', 'email', 'meeting', etc.
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}', -- métadonnées de l'événement
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_crm_events_agency_id ON crm_events(agency_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_lead_id ON crm_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_type ON crm_events(type);
CREATE INDEX IF NOT EXISTS idx_crm_events_created_at ON crm_events(created_at);

-- RLS (Row Level Security)
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour les événements CRM
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

-- Migration des anciens événements vers la nouvelle structure
-- (à exécuter une seule fois lors de la migration)
INSERT INTO crm_events (lead_id, agency_id, type, title, description, metadata, created_by, created_at)
SELECT 
  lead_id,
  agency_id,
  'legacy_event',
  title,
  description,
  COALESCE(metadata, '{}'),
  created_by,
  created_at
FROM old_events_table
WHERE NOT EXISTS (
  SELECT 1 FROM crm_events 
  WHERE crm_events.lead_id = old_events_table.lead_id 
  AND crm_events.created_at = old_events_table.created_at
);
