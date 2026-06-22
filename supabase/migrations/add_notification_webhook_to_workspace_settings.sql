-- Migration: colonnes notification dans workspace_settings
-- Ces colonnes étaient définies uniquement dans profiles (ADD_HOT_LEAD_ALERTS.sql)
-- mais handleSaveSettings écrit dans workspace_settings → champs ignorés silencieusement.

ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS notification_webhook  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS notification_email    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS notify_new_lead       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_hot_lead       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_new_message    BOOLEAN DEFAULT true;
