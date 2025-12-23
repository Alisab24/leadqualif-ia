# Guide d'Authentification - LeadQualif IA

## 📋 Vue d'ensemble

Le système d'authentification a été implémenté pour protéger l'accès au tableau de bord. Les utilisateurs doivent se connecter avant d'accéder au dashboard.

## 🚀 Démarrage rapide

### 1. Installer les dépendances backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Lancer le serveur Flask

```bash
python backend/app.py
# ou
python backend/run.py
```

Le serveur démarre sur `http://localhost:5000`

### 3. Lancer le frontend React

```bash
npm run dev
```

L'application démarre sur `http://localhost:5173`

## 🔐 Identifiants par défaut

Au premier lancement du serveur Flask, un utilisateur par défaut est automatiquement créé :

- **Username** : `agent01`
- **Password** : `secretpass`

Ces identifiants sont affichés sur la page de connexion.

## 📱 Comment utiliser l'authentification

### Accéder au tableau de bord

1. **Ouvrir l'application** : `http://localhost:5173`
2. **Naviguer vers le dashboard** : Cliquez sur "Tableau de bord" ou allez à `/dashboard`
3. **Redirection automatique** : Si vous n'êtes pas connecté, vous serez redirigé vers `/login`
4. **Se connecter** :
   - Entrez le nom d'utilisateur : `agent01`
   - Entrez le mot de passe : `secretpass`
   - Cliquez sur "Se connecter"
5. **Accès au dashboard** : Après connexion réussie, vous êtes redirigé vers le dashboard

### Fonctionnalités du dashboard

Une fois connecté, vous pouvez :

- ✅ **Voir les leads chauds** (score >= 8)
- ✅ **Planifier des RDV** pour les leads
- ✅ **Générer des annonces** immobilières
- ✅ **Voir les statistiques** des leads

### Se déconnecter

Cliquez sur le bouton **"Déconnexion"** dans la barre de navigation en haut à droite.

## 🔧 Architecture technique

### Backend (Flask)

- **Modèle User** : `backend/models.py`
  - `username` (unique)
  - `password_hash` (mot de passe haché avec Werkzeug)

- **Endpoints** :
  - `POST /login` : Connexion
  - `GET /dashboard` : Accès protégé au dashboard (nécessite authentification)
  - `POST /api/logout` : Déconnexion

- **Protection** : Utilise Flask-Login avec sessions sécurisées

### Frontend (React)

- **AuthContext** : `src/context/AuthContext.jsx`
  - Gère l'état d'authentification
  - Fournit les fonctions `login()`, `logout()`, `checkAuthStatus()`

- **Page Login** : `src/pages/Login.jsx`
  - Formulaire de connexion
  - Gestion des erreurs

- **ProtectedRoute** : `src/components/ProtectedRoute.jsx`
  - Composant qui protège les routes nécessitant une authentification
  - Redirige vers `/login` si non connecté

- **Dashboard** : `src/pages/Dashboard.jsx`
  - Toutes les requêtes incluent `credentials: 'include'` pour envoyer les cookies de session
  - Gère les erreurs 401 (non authentifié) en redirigeant vers `/login`

## 🔒 Sécurité

- ✅ Mots de passe hachés avec Werkzeug (algorithme pbkdf2:sha256)
- ✅ Sessions sécurisées avec Flask-Login
- ✅ Protection CSRF avec `session_protection = 'strong'`
- ✅ Cookies de session avec `credentials: 'include'` côté frontend
- ✅ Redirection automatique si non authentifié

## 🐛 Dépannage

### Erreur "Authentification requise"

- Vérifiez que le serveur Flask est lancé
- Vérifiez que vous êtes connecté (regardez la barre de navigation)
- Essayez de vous déconnecter et reconnecter

### Erreur CORS

- Vérifiez que `flask-cors` est installé
- Vérifiez que `supports_credentials=True` est configuré dans `app.py`
- Vérifiez que `credentials: 'include'` est présent dans toutes les requêtes fetch

### L'utilisateur par défaut n'est pas créé

- Vérifiez les logs du serveur Flask au démarrage
- Supprimez le fichier `backend/leadqualif_ia.db` et relancez le serveur
- Vérifiez que la fonction `create_default_user()` est appelée dans `app.py`

## 📝 Notes importantes

- Les sessions sont stockées dans des cookies HTTP-only (gérés par Flask-Login)
- Le mot de passe par défaut `secretpass` doit être changé en production
- Pour ajouter de nouveaux utilisateurs, créez-les directement dans la base de données ou ajoutez une fonction d'administration






