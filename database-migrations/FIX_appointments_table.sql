-- ============================================================
-- Migration : Table appointments complète
-- À exécuter dans : Supabase → SQL Editor
-- ============================================================

-- 1. Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
    agency_id       UUID REFERENCES agencies(id) ON DELETE CASCADE,
    assigned_to     UUID,
    title           TEXT,
    type            TEXT DEFAULT 'Appel découverte',
    scheduled_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    notes           TEXT,
    status          TEXT DEFAULT 'confirmed',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ajouter les colonnes manquantes si la table existe déjà
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS agency_id       UUID REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_to     UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS title           TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type            TEXT DEFAULT 'Appel découverte';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Supprimer l'ancienne contrainte CHECK sur status si elle existe (elle bloque)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'appointments' AND column_name = 'status'
  ) THEN
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  END IF;
END $$;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id    ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agency_id  ON appointments(agency_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled  ON appointments(scheduled_at);

-- 5. RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

CREATE POLICY "appointments_select" ON appointments
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "appointments_insert" ON appointments
    FOR INSERT WITH CHECK (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "appointments_update" ON appointments
    FOR UPDATE USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "appointments_delete" ON appointments
    FOR DELETE USING (
        agency_id IN (SELECT agency_id FROM profiles WHERE user_id = auth.uid())
    );

-- 6. Vérification finale
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'appointments'
ORDER BY ordinal_position;
