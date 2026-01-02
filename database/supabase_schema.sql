-- ========================================
-- STRUCTURE DE LA BASE DE DONNÉES SUPABASE
-- ========================================

-- Extension UUID si non présente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des agences
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom_agence VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des profils utilisateurs (liée à auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    nom_complet VARCHAR(255),
    telephone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table des leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telephone VARCHAR(50),
    budget INTEGER,
    type_bien VARCHAR(100),
    adresse TEXT,
    score_ia INTEGER DEFAULT 0 CHECK (score_ia >= 0 AND score_ia <= 10),
    statut_crm VARCHAR(50) DEFAULT 'À traiter',
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des interactions
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    type_action VARCHAR(50) NOT NULL,
    details TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- ========================================
-- SÉCURITÉ - ROW LEVEL SECURITY (RLS)
-- ========================================

-- Activer RLS sur toutes les tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour agencies
CREATE POLICY "Users can view their own agency" ON agencies
    FOR SELECT USING (
        id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their own agency" ON agencies
    FOR UPDATE USING (
        id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

-- Politiques RLS pour profiles
CREATE POLICY "Users can view profiles from their agency" ON profiles
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

-- Politiques RLS pour leads (CRUCIAL - ISOLATION DES DONNÉES)
CREATE POLICY "Users can view leads from their agency only" ON leads
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert leads for their agency" ON leads
    FOR INSERT WITH CHECK (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update leads from their agency" ON leads
    FOR UPDATE USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete leads from their agency" ON leads
    FOR DELETE USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

-- Politiques RLS pour interactions
CREATE POLICY "Users can view interactions from their agency leads" ON interactions
    FOR SELECT USING (
        lead_id IN (
            SELECT id FROM leads 
            WHERE agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert interactions for their agency leads" ON interactions
    FOR INSERT WITH CHECK (
        lead_id IN (
            SELECT id FROM leads 
            WHERE agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- ========================================
-- INDEXES POUR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_leads_agency_id ON leads(agency_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_score_ia ON leads(score_ia);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(date);

-- ========================================
-- TRIGGERS POUR updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour obtenir l'agency_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT agency_id FROM profiles 
        WHERE user_id = auth.uid() 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue pour simplifier les requêtes
CREATE OR REPLACE VIEW user_leads AS
SELECT 
    l.*,
    p.nom_complet as created_by_name
FROM leads l
LEFT JOIN profiles p ON l.created_by = p.id
WHERE l.agency_id = get_user_agency_id();
