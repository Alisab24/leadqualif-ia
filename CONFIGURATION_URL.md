# 🔧 Configuration URL Backend - Guide

## ✅ Modifications effectuées

### 1. URL Backend mise à jour (`src/pages/Dashboard.jsx`)
```javascript
const API_BACKEND_URL = '[COLLEZ VOTRE URL RENDER ICI]/api'
```

### 2. Console.log détaillés ajoutés
- ✅ URL du backend affichée
- ✅ Données envoyées affichées
- ✅ Status de réponse affiché
- ✅ Headers de réponse affichés
- ✅ Données reçues affichées
- ✅ Erreurs complètes avec stack trace

## 🔍 Comment trouver votre URL Render

### Étape 1 : Allez sur Render Dashboard
1. Connectez-vous à [dashboard.render.com](https://dashboard.render.com)
2. Cliquez sur votre service backend

### Étape 2 : Copiez l'URL
Dans la page de votre service, cherchez :
- **Service URL** (format : `https://votre-backend.onrender.com`)
- Copiez cette URL

### Étape 3 : Remplacez dans le code
Dans `src/pages/Dashboard.jsx`, ligne 10 :
```javascript
const API_BACKEND_URL = 'https://votre-backend.onrender.com/api'
```

**Important** :
- ✅ Ajoutez `/api` à la fin
- ❌ Pas de double slash (`//api`)
- ✅ URL complète avec `https://`

## 🧪 Test de l'URL

### Test avec curl
```bash
curl https://votre-backend.onrender.com/api/
# Expected: {"status": "online", "message": "Cerveau LeadQualif IA prêt"}
```

### Test dans le navigateur
Ouvrez : `https://votre-backend.onrender.com/api/`
- Devrait afficher du JSON
- Si vous voyez du HTML → l'URL est fausse

## 🚨 Problèmes courants

### Erreur : HTML au lieu de JSON
**Cause** : URL incorrecte (page d'erreur Render)
**Solution** : Vérifiez que l'URL se termine par `/api`

### Erreur : 404 Not Found
**Cause** : Mauvais chemin ou service down
**Solution** : 
- Vérifiez que le service est "Live" sur Render
- Ajoutez `/api` à la fin

### Erreur : CORS
**Cause** : Frontend et backend sur domaines différents
**Solution** : CORS est déjà configuré pour `*`

### Erreur : 500 Internal Server Error
**Cause** : Problème backend (OpenAI, DB, etc.)
**Solution** : Vérifiez les logs Render

## 📊 Console.log à surveiller

Ouvrez la console du navigateur (F12) et cherchez :

### Logs normaux
```
🔗 URL du backend: https://votre-backend.onrender.com/api
📤 Données envoyées: {type: "appartement", ...}
📥 Status de la réponse: 200
📥 Données reçues: {success: true, annonce: "..."}
```

### Logs d'erreur
```
❌ Erreur complète: TypeError: Failed to fetch
❌ Erreur de connexion: NetworkError when attempting to fetch resource
```

## 🎯 Validation finale

1. **Remplacez** l'URL dans le code
2. **Déployez** le frontend
3. **Ouvrez** la console navigateur
4. **Testez** le générateur d'annonces
5. **Vérifiez** les logs

---
**Remplacez `[COLLEZ VOTRE URL RENDER ICI]` par votre vraie URL Render !**
