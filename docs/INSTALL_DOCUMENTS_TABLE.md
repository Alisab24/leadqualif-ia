# 📋 Installation Table Documents - LeadQualif IA

## 🎯 Objectif
Créer la table `documents` nécessaire pour le Centre de Documents fonctionnel.

## 📝 Instructions SQL pour Supabase

### 1. Accéder à l'éditeur SQL
- Connectez-vous à votre projet Supabase
- Allez dans "SQL Editor" dans le menu de gauche
- Créez une nouvelle requête

### 2. Copier-coller ce code SQL

```sql
-- Création de la table documents pour LeadQualif IA
-- Structure minimale et fonctionnelle

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES profiles(agency_id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type_document TEXT NOT NULL CHECK (type_document IN ('devis', 'contrat', 'mandat', 'facture', 'autre')),
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'généré', 'envoyé', 'signé')),
  fichier_url TEXT,
  contenu TEXT, -- Pour stocker le contenu temporaire ou les métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) pour la sécurité
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Politique de sécurité : les utilisateurs ne voient que les documents de leur agence
CREATE POLICY "Users can view their agency documents"
  ON documents FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Politique de sécurité : les utilisateurs peuvent insérer des documents pour leur agence
CREATE POLICY "Users can insert their agency documents"
  ON documents FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Politique de sécurité : les utilisateurs peuvent modifier les documents de leur agence
CREATE POLICY "Users can update their agency documents"
  ON documents FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Politique de sécurité : les utilisateurs peuvent supprimer les documents de leur agence
CREATE POLICY "Users can delete their agency documents"
  ON documents FOR DELETE
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  );
```

### 3. Exécuter la requête
- Cliquez sur "Run" ou "F5" pour exécuter
- Vérifiez que la table est créée dans "Table Editor"

## ✅ Vérification

### 1. Table créée
Dans "Table Editor", vous devriez voir :
- `documents` avec les colonnes : id, agency_id, lead_id, type_document, statut, fichier_url, contenu, created_at, updated_at

### 2. Test fonctionnel
1. Allez dans le Dashboard
2. Cliquez sur un lead
3. Dans la section "Documents", cliquez sur "Générer Devis"
4. Le PDF devrait se télécharger ET une entrée apparaître dans la table documents

## 🚀 Fonctionnalités disponibles

### Types de documents
- `devis` 💰
- `contrat` 📋  
- `mandat` ✍️
- `facture` 🧾
- `autre` 📄

### Statuts possibles
- `brouillon` (gris)
- `généré` (vert)
- `envoyé` (bleu)
- `signé` (violet)

## 🔧 Si problème

### Erreur "table documents does not exist"
- Vérifiez que vous avez bien exécuté le SQL
- Rafraîchissez la page Table Editor

### Erreur "permission denied"
- Vérifiez que les politiques RLS sont bien créées
- Assurez-vous que votre utilisateur est bien connecté

### Documents n'apparaissent pas
- Ouvrez la console du navigateur (F12)
- Cherchez des erreurs dans l'onglet "Console"
- Vérifiez que l'agency_id est correctement récupéré

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les étapes ci-dessus
2. Regardez la console du navigateur
3. Contactez le support technique

**Le Centre de Documents est maintenant prêt !** 🎉
