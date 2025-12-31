# Guide d'installation - LeadQualif IA avec Supabase

## 🎯 Objectif
Ce guide vous permet de configurer LeadQualif IA avec une base de données Supabase persistante.

## 📋 Étapes d'installation

### 1. Configuration Supabase

1. **Créez un compte sur [Supabase](https://supabase.com)**
2. **Créez un nouveau projet** :
   - Nom : `leadqualif-ia`
   - Database password : choisissez un mot de passe sécurisé
   - Région : choisissez la région la plus proche de vos utilisateurs

3. **Exécutez le script SQL** :
   - Allez dans le dashboard Supabase → SQL Editor
   - Copiez-collez le contenu du fichier `supabase-setup.sql`
   - Exécutez le script

4. **Récupérez vos clés** :
   - Allez dans Project Settings → API
   - Copiez l'URL du projet et la clé `anon` publique

### 2. Configuration du projet

1. **Créez le fichier d'environnement** :
   ```bash
   cp .env.example .env.local
   ```

2. **Remplissez `.env.local`** avec vos vraies valeurs :
   ```env
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre-cle-anon-ici
   VITE_OPENAI_API_KEY=votre-cle-openai-ici
   ```

3. **Mettez à jour le formulaire HTML** :
   - Ouvrez `public/formulaire.html`
   - Remplacez les lignes 115-116 :
   ```javascript
   const SUPABASE_URL = 'https://votre-projet.supabase.co';
   const SUPABASE_ANON_KEY = 'votre-cle-anon';
   ```

### 3. Installation et démarrage

1. **Installez les dépendances** :
   ```bash
   npm install
   ```

2. **Démarrez le développement** :
   ```bash
   npm run dev
   ```

3. **Testez l'application** :
   - Formulaire : http://localhost:5173/public/formulaire.html
   - Dashboard : http://localhost:5173
   - Page merci : http://localhost:5173/public/merci.html

## 🔧 Fonctionnalités implémentées

### ✅ Pied de page professionnel
- Présent sur toutes les pages (formulaire, merci, dashboard)
- Marque NexaPro avec mentions légales
- Lien WhatsApp de contact
- Texte de confidentialité

### ✅ Base de données persistante
- Table `leads` dans Supabase avec tous les champs nécessaires
- Sauvegarde automatique des soumissions du formulaire
- Lecture des données dans le dashboard
- Score de qualification automatique

### ✅ Compatible domaine personnalisé
- Liens relatifs uniquement
- Pas de hardcoding de domaine
- Prêt pour Vercel custom domain

## 📊 Structure de la base de données

La table `leads` contient :
- `id` : UUID unique
- `nom`, `email`, `telephone` : informations contact
- `score_qualification` : score 0-10 calculé automatiquement
- `budget_estime`, `urgence`, `type_bien_recherche` : détails du projet
- `qualification_data` : JSON avec les critères d'évaluation
- `created_at`, `updated_at` : timestamps

## 🚀 Déploiement sur Vercel

1. **Connectez votre repo GitHub à Vercel**
2. **Configurez les variables d'environnement** dans Vercel Dashboard
3. **Déployez** automatiquement ou manuellement
4. **Configurez votre domaine personnalisé** dans Vercel Settings

## 🔒 Sécurité

- Row Level Security (RLS) activé sur la table
- Politiques d'accès configurées pour les utilisateurs anon et authentifiés
- Clés API stockées dans les variables d'environnement

## 📞 Support

En cas de problème :
1. Vérifiez les logs de la console du navigateur
2. Contrôlez les variables d'environnement
3. Vérifiez la connexion Supabase dans le dashboard

---

**NexaPro – LeadQualif IA v2.0**
