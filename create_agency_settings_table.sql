-- Création de la table agency_settings
CREATE TABLE IF NOT EXISTS agency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID UNIQUE NOT NULL,
  nom_legal TEXT NOT NULL,
  nom_commercial TEXT,
  adresse_legale TEXT,
  pays TEXT,
  devise TEXT DEFAULT 'EUR',
  telephone TEXT,
  email TEXT,
  logo_url TEXT,
  conditions_paiement TEXT,
  mention_legale TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_agency_settings_agency_id ON agency_settings(agency_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agency_settings_updated_at 
    BEFORE UPDATE ON agency_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Commentaires sur la table
COMMENT ON TABLE agency_settings IS 'Table des paramètres de l''agence pour la génération de documents';
COMMENT ON COLUMN agency_settings.id IS 'Identifiant unique de l''enregistrement';
COMMENT ON COLUMN agency_settings.agency_id IS 'Identifiant unique de l''agence (lien avec la table users/agencies)';
COMMENT ON COLUMN agency_settings.nom_legal IS 'Nom légal de l''agence (champ obligatoire)';
COMMENT ON COLUMN agency_settings.nom_commercial IS 'Nom commercial de l''agence (optionnel)';
COMMENT ON COLUMN agency_settings.adresse_legale IS 'Adresse légale de l''agence';
COMMENT ON COLUMN agency_settings.pays IS 'Pays de l''agence';
COMMENT ON COLUMN agency_settings.devise IS 'Devise utilisée par défaut (EUR)';
COMMENT ON COLUMN agency_settings.telephone IS 'Numéro de téléphone de l''agence';
COMMENT ON COLUMN agency_settings.email IS 'Email de contact de l''agence';
COMMENT ON COLUMN agency_settings.logo_url IS 'URL du logo de l''agence';
COMMENT ON COLUMN agency_settings.conditions_paiement IS 'Conditions de paiement par défaut';
COMMENT ON COLUMN agency_settings.mention_legale IS 'Mentions légales de l''agence';
COMMENT ON COLUMN agency_settings.created_at IS 'Date de création de l''enregistrement';
COMMENT ON COLUMN agency_settings.updated_at IS 'Date de dernière mise à jour';
