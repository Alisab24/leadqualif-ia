-- ============================================================
-- Migration : Colonnes email pour la table conversations
-- À exécuter dans : Supabase → SQL Editor
-- ============================================================

-- 1. Créer la table conversations si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
    agency_id   UUID REFERENCES agencies(id) ON DELETE CASCADE,
    channel     VARCHAR(50)  DEFAULT 'whatsapp',
    direction   VARCHAR(50)  DEFAULT 'inbound',
    content     TEXT,
    status      VARCHAR(50)  DEFAULT 'received',
    sender_name VARCHAR(255),
    read_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ajouter les colonnes email manquantes (safe à re-exécuter)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS subject        TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS from_email     TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS to_email       TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS html_content   TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS imap_uid       BIGINT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS email_thread_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS thread_status  VARCHAR(50);

-- 3. Index pour déduplication
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id
    ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_gmail_msg
    ON conversations(gmail_message_id)
    WHERE gmail_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_imap_uid
    ON conversations(lead_id, imap_uid)
    WHERE imap_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel
    ON conversations(lead_id, channel);

-- 4. RLS (activer si pas encore fait)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Supprimer les vieilles politiques si elles existent
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations from their agency" ON conversations;
DROP POLICY IF EXISTS "Users can insert conversations for their agency" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations from their agency" ON conversations;

-- Créer les politiques RLS
CREATE POLICY "conversations_select" ON conversations
    FOR SELECT USING (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "conversations_insert" ON conversations
    FOR INSERT WITH CHECK (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "conversations_update" ON conversations
    FOR UPDATE USING (
        agency_id IN (
            SELECT agency_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- Vérification : liste des colonnes de conversations
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;
