# Guide de Démarrage Rapide - LeadQualif IA

## 🚀 Démarrage en 3 étapes

### Étape 1 : Lancer le Backend Flask

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Le serveur sera accessible sur `http://localhost:5000`

**Vérification :**
- Ouvrez `http://localhost:5000/health` dans votre navigateur
- Vous devriez voir : `{"status": "healthy", "database": "connected"}`

### Étape 2 : Lancer le Frontend React

Dans un **nouveau terminal** :

```bash
npm run dev
```

Le Dashboard sera accessible sur `http://localhost:5173`

### Étape 3 : Tester la Connexion

1. Ouvrez le Dashboard : `http://localhost:5173/dashboard`
2. Vérifiez que les leads chauds s'affichent (ou les données simulées)
3. Testez le bouton "Planifier RDV" sur un lead

## ✅ Vérification CORS

### Test automatique

```bash
cd backend
python test_cors.py
```

### Test manuel dans le navigateur

1. Ouvrez les DevTools (F12)
2. Onglet **Console**
3. Vérifiez qu'il n'y a **pas d'erreurs CORS** (rouge)
4. Onglet **Network**
5. Cliquez sur une requête vers `/api/leads-chauds`
6. Vérifiez les **Response Headers** :
   - `Access-Control-Allow-Origin: http://localhost:5173`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

## 🔧 Dépannage Rapide

### Le Dashboard n'affiche pas les données

1. **Vérifiez que le backend est lancé :**
   ```bash
   curl http://localhost:5000/health
   ```

2. **Vérifiez la console du navigateur :**
   - Ouvrez F12 → Console
   - Cherchez les erreurs en rouge

3. **Vérifiez l'URL de l'API :**
   - Dans `Dashboard.jsx`, ligne 7 : `const API_BACKEND_URL = 'http://localhost:5000/api'`
   - Doit correspondre au port du serveur Flask

### Erreur CORS dans la console

1. **Vérifiez que flask-cors est installé :**
   ```bash
   pip list | grep flask-cors
   ```

2. **Vérifiez la configuration dans `backend/app.py` :**
   - Les origines doivent inclure `http://localhost:5173`
   - Redémarrez le serveur Flask après modification

3. **Testez avec le script :**
   ```bash
   python backend/test_cors.py
   ```

### Le bouton "Planifier RDV" ne fonctionne pas

1. Vérifiez que le backend est lancé
2. Vérifiez la console du navigateur pour les erreurs
3. Vérifiez que la base de données contient des leads

## 📊 Structure des Ports

- **Frontend React** : `http://localhost:5173` (Vite)
- **Backend Flask** : `http://localhost:5000`

## 🔗 Endpoints Disponibles

- `GET http://localhost:5000/` - Status
- `GET http://localhost:5000/health` - Health check
- `GET http://localhost:5000/api/leads-chauds` - Leads chauds
- `POST http://localhost:5000/api/submit-lead` - Soumettre un lead
- `POST http://localhost:5000/api/planifier-rdv` - Planifier un RDV

## 📝 Notes Importantes

- Le backend doit être lancé **avant** le frontend pour éviter les erreurs CORS
- Si le backend n'est pas disponible, le Dashboard utilise les données simulées
- La base de données SQLite est créée automatiquement au premier lancement


