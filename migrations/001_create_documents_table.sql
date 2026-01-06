-- Table pour la gestion documentaire des leads
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Mandat', 'Bon de visite', 'Facture', 'Devis', 'Contrat', 'Justificatif')),
  status VARCHAR(20) NOT NULL DEFAULT 'Généré' CHECK (status IN ('Généré', 'Envoyé', 'Signé', 'Archivé')),
  file_url TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Index pour optimiser les requêtes
  INDEX idx_documents_lead_id (lead_id),
  INDEX idx_documents_agency_id (agency_id),
  INDEX idx_documents_type (type),
  INDEX idx_documents_status (status),
  INDEX idx_documents_created_at (created_at)
);

-- Exemples de métadonnées pour le champ metadata
-- Pour un devis : {"montant": 150000, "tva": 20, "validite": "3 mois"}
-- Pour un mandat : {"duree": "6 mois", "type": "exclusif", "honoraires": "4%"}
-- Pour une facture : {"numero": "FAC-2024-001", "echeance": "2024-02-15", "regle": false}
