-- Migration pour ajouter l'option premium "montant en lettres"
-- Ajout du paramètre dans la table profiles

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS show_amount_in_words BOOLEAN DEFAULT FALSE;

-- Commentaire sur la nouvelle colonne
COMMENT ON COLUMN profiles.show_amount_in_words IS 'Afficher le montant total en lettres sur les documents (option premium)';

-- Mettre à jour les profils existants avec une valeur par défaut
UPDATE profiles 
SET show_amount_in_words = FALSE 
WHERE show_amount_in_words IS NULL;
