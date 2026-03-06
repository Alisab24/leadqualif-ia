# 🔧 Test et Dépannage CORS - Formulaires

## ✅ Modifications appliquées

### 1. CORS simplifié (`backend/app.py`)
```python
# AVANT (complexe)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# APRÈS (simple et efficace)
CORS(app, resources={r"/*": {"origins": "*"}})
```

### 2. Route OpenAI protégée ✅
```python
@app.route('/api/generate-annonce', methods=['POST', 'OPTIONS'])
def generate_annonce():
    try:
        # ... logique OpenAI ...
        return jsonify({'success': True, 'annonce': annonce_generee}), 200
    except openai.error.OpenAIError as e:
        return jsonify({'error': f'Erreur OpenAI: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500
```

## 🧪 Tests des formulaires

### Test 1 : Formulaire principal
```bash
curl -X POST https://votre-backend.onrender.com/api/submit-lead \
  -H "Content-Type: application/json" \
  -H "Origin: https://votre-domaine.com" \
  -d '{
    "nom": "Test User",
    "email": "test@email.com", 
    "telephone": "0612345678",
    "adresse": "Paris",
    "prix": "300000"
  }'
```

**Réponse attendue** :
```json
{"status": "success", "score": 9}
```

### Test 2 : Générateur d'annonces
```bash
curl -X POST https://votre-backend.onrender.com/api/generate-annonce \
  -H "Content-Type: application/json" \
  -H "Origin: https://votre-domaine.com" \
  -d '{
    "type": "appartement",
    "adresse": "Paris 75015",
    "prix": "350000",
    "surface": "85",
    "pieces": "3"
  }'
```

**Réponse attendue** :
```json
{
  "success": true,
  "annonce": "🏠 ✨ Exceptionnel Appartement..."
}
```

## 🚨 Erreurs CORS et solutions

### Erreur : `Access-Control-Allow-Origin`
**Cause** : CORS trop restrictif
**Solution** : ✅ CORS maintenant configuré pour `*`

### Erreur : `preflight request failed`
**Cause** : OPTIONS non géré
**Solution** : ✅ Toutes les routes ont `if request.method == 'OPTIONS'`

### Erreur : `credentials not allowed`
**Cause** : `supports_credentials=True` avec `*`
**Solution** : ✅ `supports_credentials` retiré

## 🔍 Vérification du frontend

### Dans le navigateur (F12 → Console)
```javascript
// Test du fetch
fetch('https://votre-backend.onrender.com/api/submit-lead', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    nom: 'Test',
    email: 'test@test.com',
    telephone: '0612345678',
    adresse: 'Paris',
    prix: '300000'
  })
})
.then(response => response.json())
.then(data => console.log('✅ Succès:', data))
.catch(error => console.error('❌ Erreur:', error));
```

### Variables d'environnement à vérifier
Dans votre frontend `.env.local` :
```env
VITE_API_BACKEND_URL=https://votre-backend.onrender.com/api
```

## 🎯 Validation complète

### 1. Test de santé
```bash
curl https://votre-backend.onrender.com/
# Expected: {"status": "online"}
```

### 2. Test CORS headers
```bash
curl -I -X OPTIONS https://votre-backend.onrender.com/api/submit-lead \
  -H "Origin: https://votre-domaine.com"
# Expected: Access-Control-Allow-Origin: *
```

### 3. Test formulaire complet
1. Allez sur votre site
2. Remplissez le formulaire
3. Cliquez sur "Obtenir mon analyse IA"
4. Vérifiez la console du navigateur

## 🚨 Si ça ne marche toujours pas

### Vérifiez les logs Render
- Allez sur Render → Logs
- Cherchez les erreurs 500 ou CORS

### Vérifiez l'URL du backend
- Assurez-vous que `VITE_API_BACKEND_URL` est correct
- Pas de `/` à la fin de l'URL

### Test avec Postman
- Importez les requêtes curl ci-dessus
- Testez depuis un outil externe

---
**Les formulaires devraient maintenant fonctionner avec CORS complètement ouvert !**
