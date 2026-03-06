# Vérification des Appels API - Dashboard

## ✅ Vérification Complète

### URL de Base Configurée

Dans `src/pages/Dashboard.jsx`, ligne 7 :
```javascript
const API_BACKEND_URL = 'http://localhost:5000/api'
```

**✅ URL complète configurée correctement**

### Appels API dans le Dashboard

Tous les appels fetch utilisent l'URL complète `${API_BACKEND_URL}` :

1. **GET /api/leads-chauds** (ligne 119)
   ```javascript
   fetch(`${API_BACKEND_URL}/leads-chauds`, ...)
   ```
   → `http://localhost:5000/api/leads-chauds` ✅

2. **POST /api/planifier-rdv** (ligne 312)
   ```javascript
   fetch(`${API_BACKEND_URL}/planifier-rdv`, ...)
   ```
   → `http://localhost:5000/api/planifier-rdv` ✅

3. **GET /api/leads-chauds** (rechargement, ligne 335)
   ```javascript
   fetch(`${API_BACKEND_URL}/leads-chauds`, ...)
   ```
   → `http://localhost:5000/api/leads-chauds` ✅

## 🔍 Configuration CORS

Tous les appels incluent :
- ✅ Headers : `Content-Type: application/json`
- ✅ Mode : `cors`
- ✅ Méthode HTTP spécifiée (GET ou POST)

## 📋 Checklist de Démarrage

### 1. Lancer le Serveur Flask

```bash
cd backend
python run.py
```

**Vérification :**
- Le serveur doit afficher : `🚀 Serveur démarré sur http://0.0.0.0:5000`
- Ouvrir `http://localhost:5000/health` dans le navigateur
- Doit retourner : `{"status": "healthy", "database": "connected"}`

### 2. Lancer le Frontend React

Dans un **nouveau terminal** :

```bash
npm run dev
```

**Vérification :**
- Le Dashboard doit être accessible sur `http://localhost:5173/dashboard`
- Pas d'erreurs CORS dans la console (F12)

### 3. Tester les Appels API

1. **Ouvrir les DevTools** (F12)
2. **Onglet Network**
3. **Recharger la page** (F5)
4. **Vérifier les requêtes :**
   - `leads-chauds` → Status 200 ✅
   - Headers de réponse incluent `Access-Control-Allow-Origin` ✅

### 4. Tester la Planification de RDV

1. Cliquer sur "Planifier RDV" sur un lead
2. Vérifier dans Network :
   - Requête POST vers `planifier-rdv` → Status 200 ✅
   - Requête GET vers `leads-chauds` (rechargement) → Status 200 ✅

## 🔧 Dépannage

### Le Dashboard n'appelle pas l'API

1. **Vérifiez que `API_BACKEND_URL` est défini :**
   ```javascript
   const API_BACKEND_URL = 'http://localhost:5000/api'
   ```

2. **Vérifiez la console du navigateur :**
   - Ouvrez F12 → Console
   - Cherchez les erreurs de connexion

3. **Vérifiez que le serveur Flask est lancé :**
   ```bash
   curl http://localhost:5000/health
   ```

### Erreur "Failed to fetch"

- Le serveur Flask n'est pas lancé
- Le port 5000 est occupé par un autre processus
- Vérifiez les logs du serveur Flask

### Erreur CORS

- Vérifiez la configuration dans `backend/app.py`
- Les origines doivent inclure `http://localhost:5173`
- Redémarrez le serveur Flask après modification

## 📝 Notes

- Tous les appels API utilisent l'URL complète `http://localhost:5000/api`
- Aucun chemin relatif n'est utilisé pour les appels backend
- Le Dashboard fonctionne en mode démo (données simulées) si le backend n'est pas disponible


