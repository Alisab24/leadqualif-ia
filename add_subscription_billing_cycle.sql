-- Migration : ajouter la colonne subscription_billing_cycle à profiles
-- À exécuter dans l'éditeur SQL Supabase (une seule fois)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_billing_cycle TEXT DEFAULT 'monthly';

-- Commentaire optionnel
COMMENT ON COLUMN profiles.subscription_billing_cycle IS
  'Cycle de facturation Stripe : monthly | annual (mis à jour par le webhook)';
