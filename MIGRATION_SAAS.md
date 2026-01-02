# 🚀 Migration SaaS Multi-Tenant avec Supabase

## 📋 Étapes de Migration

### 1. Configuration Supabase

1. **Créer un projet Supabase** :
   - Allez sur https://supabase.com
   - Créez un nouveau projet
   - Notez votre URL et clé anon

2. **Exécuter le schéma SQL** :
   ```sql
   -- Copiez-collez le contenu de database/supabase_schema.sql
   -- dans l'éditeur SQL de Supabase
   ```

3. **Activer RLS** :
   - Le schéma active automatiquement le Row Level Security
   - Vérifiez que toutes les tables ont bien RLS activé

### 2. Configuration Backend Python

1. **Variables d'environnement** :
   ```bash
   # Ajouter à votre configuration Render/Heroku
   SUPABASE_DB_URL=postgresql://user:pass@host:port/postgres
   OPENAI_API_KEY=votre_clé_openai
   ```

2. **Installer les dépendances** :
   ```bash
   pip install sqlalchemy psycopg2-binary flask-cors
   ```

3. **Déployer le backend** :
   - Le code est déjà compatible Supabase
   - Les UUID sont gérés automatiquement

### 3. Configuration Frontend React

1. **Installer Supabase** :
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Variables d'environnement** :
   ```bash
   # .env.local
   REACT_APP_SUPABASE_URL=https://votre-projet.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=votre_clé_anon
   ```

3. **Déployer le frontend** :
   - Le routing est déjà configuré pour Vercel
   - Les routes sont protégées par Supabase Auth

## 🔐 Sécurité Multi-Tenant

### Isolation des Données
- **RLS (Row Level Security)** : Chaque agence ne voit que ses données
- **agency_id** : Clé étrangère dans toutes les tables
- **Politiques RLS** : Automatiques via le schéma SQL

### Authentification
- **Supabase Auth** : Gestion complète des utilisateurs
- **JWT Tokens** : Sécurité native
- **Sessions** : 24h par défaut

## 📊 Structure des Données

```
agencies (UUID PK)
├── id, nom_agence, plan, created_at

profiles (UUID PK)
├── user_id (FK auth.users), agency_id (FK agencies)
├── email, role, nom_complet

leads (UUID PK)
├── agency_id (FK agencies), nom, email
├── score_ia, statut_crm, created_at

interactions (UUID PK)
├── lead_id (FK leads), type_action
├── details, date, created_by
```

## 🌐 URLs du SaaS

### Vitrine Publique
- **Landing** : `https://votre-app.com/`
- **Inscription** : `https://votre-app.com/signup`
- **Connexion** : `https://votre-app.com/login`

### Application Protégée
- **Dashboard** : `https://votre-app.com/app`
- **Commercial** : `https://votre-app.com/app/commercial`

### Formulaires Publics
- **Estimation** : `https://votre-app.com/estimation?aid=UUID_AGENCE`
- **Merci** : `https://votre-app.com/merci`

## 🔄 Flux Utilisateur

1. **Inscription Agence** :
   - Crée compte + agence automatiquement
   - Redirection vers dashboard

2. **Connexion** :
   - Authentification Supabase
   - Accès aux données de l'agence uniquement

3. **Formulaire Public** :
   - URL personnalisée avec agency_id
   - Lead attribué automatiquement à l'agence

## 🛠️ Déploiement

### Backend (Render/Heroku)
```bash
git add .
git commit -m "Migration SaaS Supabase"
git push origin main
```

### Frontend (Vercel)
```bash
npm run build
vercel --prod
```

## ✅ Tests à Effectuer

1. **Créer 2 agences** différentes
2. **Vérifier l'isolation** des données
3. **Tester les URLs** de formulaires personnalisées
4. **Valider le RLS** en tentant d'accéder aux données d'une autre agence

## 🚨 Points d'Attention

- **Backup** : Sauvegardez vos données existantes avant migration
- **URLs** : Mettez à jour les liens dans vos communications
- **Environment** : Testez en staging avant production
- **RLS** : Vérifiez bien que les politiques s'appliquent

## 📞 Support

- **Documentation Supabase** : https://supabase.com/docs
- **Issues** : Créez un ticket sur GitHub
- **Urgences** : Contact direct par email

---

*Migration terminée ! Votre application est maintenant un SaaS multi-tenant sécurisé.*
