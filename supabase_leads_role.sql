-- Ajout du champ lead_role obligatoire pour distinguer clients et propriétaires
-- Migration pour la table leads

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS lead_role TEXT NOT NULL DEFAULT 'client';

-- Ajout d'une contrainte CHECK pour valider les valeurs
ALTER TABLE leads
ADD CONSTRAINT IF NOT EXISTS check_lead_role 
  CHECK (lead_role IN ('client', 'proprietaire'));

-- Création d'un index pour optimiser les requêtes par rôle
CREATE INDEX IF NOT EXISTS idx_leads_role ON leads(lead_role);

-- Commentaire pour documenter le champ
COMMENT ON COLUMN leads.lead_role IS 'Rôle du lead: client (acheteur/locataire) ou proprietaire (vendeur/bailleur)';

-- Mise à jour des leads existants sans rôle (optionnel)
-- UPDATE leads SET lead_role = 'client' WHERE lead_role IS NULL OR lead_role = '';
