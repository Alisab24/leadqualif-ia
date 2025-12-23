# Configuration CORS - Guide Complet

## Vue d'ensemble

CORS (Cross-Origin Resource Sharing) permet au frontend React (port 5173) de communiquer avec le backend Flask (port 5000).

## Configuration Actuelle

### Dans `app.py`

```python
CORS(app, 
     origins=['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True)
```

### Origines autorisées
- `http://localhost:5173` (Vite - port par défaut)
- `http://localhost:3000` (React standard)
- `http://127.0.0.1:5173` et `http://127.0.0.1:3000` (variantes)

### Méthodes autorisées
- GET, POST, PUT, DELETE, OPTIONS

## Vérification de la Configuration

### 1. Vérifier que flask-cors est installé

```bash
pip list | grep flask-cors
```

Si non installé :
```bash
pip install flask-cors
```

### 2. Tester avec le script de test

```bash
cd backend
python test_cors.py
```

Le script vérifie :
- ✅ Les headers CORS sont présents
- ✅ Les requêtes OPTIONS (preflight) fonctionnent
- ✅ Les requêtes GET/POST sont autorisées

### 3. Tester depuis le navigateur

1. Ouvrez le Dashboard dans le navigateur (http://localhost:5173)
2. Ouvrez les DevTools (F12)
3. Onglet Network
4. Vérifiez qu'il n'y a pas d'erreurs CORS (rouge)
5. Vérifiez les headers de réponse :
   - `Access-Control-Allow-Origin: http://localhost:5173`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

## Problèmes Courants

### Erreur : "Access to fetch blocked by CORS policy"

**Solution :**
1. Vérifiez que le serveur Flask est lancé
2. Vérifiez que `flask-cors` est installé
3. Vérifiez que l'origine du frontend est dans la liste des origines autorisées
4. Redémarrez le serveur Flask après modification de `app.py`

### Erreur : "No 'Access-Control-Allow-Origin' header"

**Solution :**
- Vérifiez que `CORS(app)` est appelé AVANT l'enregistrement des routes
- Vérifiez que les origines incluent exactement l'URL du frontend

### Erreur : "Method not allowed"

**Solution :**
- Vérifiez que la méthode (GET, POST, etc.) est dans la liste `methods` de CORS
- Vérifiez que l'endpoint accepte bien cette méthode

## Configuration pour la Production

En production, remplacez les origines par les vraies URLs :

```python
CORS(app, 
     origins=['https://votre-domaine.com'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True)
```

## Test Manuel

### Test avec curl

```bash
# Test OPTIONS (preflight)
curl -X OPTIONS http://localhost:5000/api/leads-chauds \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Test GET avec Origin
curl -X GET http://localhost:5000/api/leads-chauds \
  -H "Origin: http://localhost:5173" \
  -v
```

Vous devriez voir dans les headers de réponse :
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```


