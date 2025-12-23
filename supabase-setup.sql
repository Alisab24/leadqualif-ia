-- Script de création de la table leads pour LeadQualif IA
-- Exécutez ce script dans l'éditeur SQL de votre dashboard Supabase

-- Créer la table leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  message TEXT,
  source TEXT DEFAULT 'site_web',
  score_qualification INTEGER,
  budget_estime TEXT,
  urgence TEXT,
  type_bien_recherche TEXT,
  localisation_souhaitee TEXT,
  points_forts JSONB,
  points_attention JSONB,
  recommandations JSONB,
  resume TEXT,
  resume_ia TEXT,
  qualification_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer un index sur email pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Créer un index sur created_at pour le tri
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Créer un index sur score_qualification pour filtrer les leads qualifiés
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score_qualification DESC);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON leads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Activer Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre INSERT aux utilisateurs anon (mode démo)
CREATE POLICY "Allow anon insert" ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Politique pour permettre SELECT aux utilisateurs anon (mode démo)
CREATE POLICY "Allow anon select" ON leads
  FOR SELECT
  TO anon
  USING (true);

-- Politique pour permettre toutes les opérations aux utilisateurs authentifiés
CREATE POLICY "Allow all operations for authenticated users" ON leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Alternative : Politique plus restrictive (décommentez si vous utilisez l'authentification)
-- CREATE POLICY "Users can view own leads" ON leads
--   FOR SELECT
--   USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can insert own leads" ON leads
--   FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update own leads" ON leads
--   FOR UPDATE
--   USING (auth.uid() = user_id);

