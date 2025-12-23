# Guide d'Intégration API Backend-Frontend

## Configuration

### URL de l'API Backend
L'URL de l'API Flask est définie dans `Dashboard.jsx` :
```javascript
const API_BACKEND_URL = 'http://localhost:5000/api'
```

**Important** : Assurez-vous que le serveur Flask est lancé sur le port 5000 avant d'utiliser le Dashboard.

## Endpoints Utilisés

### GET /api/leads-chauds
Récupère tous les leads avec un score >= 8.

**Réponse :**
```json
{
  "status": "success",
  "count": 3,
  "data": [
    {
      "id": 1,
      "nom_client": "Jean Dupont",
      "email_client": "jean.dupont@email.com",
      "score_qualification_ia": 9,
      "recommandation_ia": "Lead TRÈS CHAUD : Appeler immédiatement...",
      "statut_rdv": "Non Plannifié",
      ...
    }
  ]
}
```

### POST /api/planifier-rdv
Planifie un RDV pour un lead.

**Body :**
```json
{
  "lead_id": 1
}
```

**Réponse :**
```json
{
  "status": "success",
  "message": "RDV planifié avec succès",
  "data": {
    "lead_id": 1,
    "nom_client": "Jean Dupont",
    "statut_rdv": "RDV Plannifié le Wednesday 22 January à 14h00",
    "date_rdv": "2024-01-22T14:00:00"
  }
}
```

## Fonctionnement du Dashboard

### Au Chargement
1. Le Dashboard appelle automatiquement `/api/leads-chauds`
2. Les données sont converties au format attendu (score 1-10 → 10-100)
3. Le KPI est mis à jour avec le nombre réel de leads chauds
4. Le tableau est rempli avec les leads récupérés

### Planification de RDV
1. Clic sur le bouton "Planifier RDV"
2. Appel à `/api/planifier-rdv` avec l'ID du lead
3. Le statut du lead est mis à jour dans la base de données
4. Les leads sont rechargés pour afficher le nouveau statut

## Gestion des Erreurs

Si l'API backend n'est pas disponible :
- Le Dashboard utilise les données simulées (`leadsSimules`)
- Un message d'erreur est affiché dans la console
- L'application continue de fonctionner en mode démo

## Format des Données

### Conversion Score
- **API Backend** : Score de 1 à 10
- **Dashboard** : Score de 10 à 100 (pour compatibilité)
- **Conversion** : `score_qualification = score_qualification_ia * 10`

### Mapping des Champs
- `nom_client` → `nom`
- `email_client` → `email`
- `score_qualification_ia` → `score_qualification` (×10)
- `recommandation_ia` → `recommandations`
- `statut_rdv` → `statut_rdv`

## Test de l'Intégration

1. **Lancer le backend Flask :**
   ```bash
   cd backend
   python run.py
   ```

2. **Lancer le frontend React :**
   ```bash
   npm run dev
   ```

3. **Vérifier la connexion :**
   - Ouvrir le Dashboard
   - Vérifier que les leads chauds s'affichent
   - Tester le bouton "Planifier RDV"

## Configuration CORS

Le serveur Flask est configuré pour accepter les requêtes depuis :
- `http://localhost:5173` (Vite - port par défaut)
- `http://localhost:3000` (React standard)
- `http://127.0.0.1:5173` et `http://127.0.0.1:3000`

Méthodes autorisées : GET, POST, PUT, DELETE, OPTIONS

### Test de CORS

Pour tester la configuration CORS, utilisez le script de test :
```bash
cd backend
python test_cors.py
```

## Dépannage

### Erreur CORS
Si vous voyez des erreurs CORS :

1. **Vérifiez que flask-cors est installé :**
   ```bash
   pip install flask-cors
   ```

2. **Vérifiez la configuration dans app.py :**
   - Les origines doivent inclure `http://localhost:5173`
   - Les méthodes doivent inclure GET et POST

3. **Vérifiez les headers dans la console du navigateur :**
   - Ouvrez les DevTools (F12)
   - Onglet Network
   - Vérifiez que les requêtes ont le header `Access-Control-Allow-Origin`

4. **Testez avec le script test_cors.py :**
   ```bash
   python backend/test_cors.py
   ```

### Erreur de connexion
- Vérifiez que le serveur Flask est lancé sur le port 5000
- Vérifiez l'URL dans `API_BACKEND_URL`
- Vérifiez les logs du serveur Flask pour les erreurs

### Données non affichées
- Vérifiez que la base de données contient des leads avec score >= 8
- Vérifiez la console du navigateur pour les erreurs
- Vérifiez que le format des données correspond


