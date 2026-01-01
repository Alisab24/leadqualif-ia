# 🚨 Dépannage Déploiement Render - Status 1

## ✅ Corrections appliquées

### 1. Double correction URL Database
**Dans config.py** (déjà fait) :
```python
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
```

**Dans app.py** (sécurité supplémentaire) :
```python
# 0.5. CORRECTION URL DATABASE POUR RENDER (sécurité supplémentaire)
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
```

### 2. Dépendances vérifiées ✅
```
flask
flask-sqlalchemy
flask-cors
flask-login
psycopg2-binary  # ← Indispensable PostgreSQL
openai
gunicorn        # ← Indispensable Render
```

## 🔍 Diagnostic du Status 1

### Étape 1 : Vérifiez les logs Render
1. Allez sur votre service Render
2. Cliquez sur **"Logs"**
3. Cherchez ces erreurs :
   - `OperationalError: could not connect`
   - `ImportError: No module named 'psycopg2'`
   - `ValueError: invalid literal for int()`

### Étape 2 : Variables d'environnement
Dans Render Dashboard → **Environment** :

| Variable | Requise | Exemple |
|----------|---------|---------|
| `DATABASE_URL` | ✅ Oui | `postgresql://user:pass@host:5432/dbname` |
| `OPENAI_API_KEY` | ✅ Oui | `sk-...` |
| `SECRET_KEY` | ✅ Oui | `clé-secrete-aleatoire` |
| `PYTHON_VERSION` | ⚠️ Optionnel | `3.9.12` |

### Étape 3 : Build Command
```bash
pip install -r requirements.txt
```

### Étape 4 : Start Command
```bash
gunicorn app:app
```

## 🚨 Erreurs communes et solutions

### Erreur : `psycopg2.OperationalError`
**Cause** : URL DB incorrecte
**Solution** : 
- Vérifiez `DATABASE_URL` dans Render
- Assurez-vous qu'elle commence par `postgresql://`

### Erreur : `ImportError: No module named 'psycopg2'`
**Cause** : Dépendance manquante
**Solution** :
- `psycopg2-binary` est dans requirements.txt ✅
- Redéployez après l'ajout

### Erreur : `ModuleNotFoundError: No module named 'config'`
**Cause** : Structure des fichiers
**Solution** :
- Assurez-vous que `config.py` est dans le même dossier que `app.py`

### Erreur : `ValueError: invalid literal for int()`
**Cause** : Port incorrect
**Solution** :
- Le port est déjà configuré avec `os.environ.get("PORT", 5000)` ✅

## 🔄 Actions immédiates

### 1. Redéployez manuellement
```bash
git add .
git commit -m "Fix: Double correction URL Database pour Render"
git push origin main
```

### 2. Vérifiez la connexion DB
Testez localement avec l'URL Render :
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
python app.py
```

### 3. Créez la base si nécessaire
Si la base n'existe pas, exécutez :
```python
# Dans app.py, après db.create_all()
print("✅ Tables créées avec succès")
```

## 🎯 Validation finale

### Test de santé du backend
```bash
curl https://votre-backend.onrender.com/
# Expected: {"status": "online", "message": "Cerveau LeadQualif IA prêt"}
```

### Test de connexion DB
```bash
curl -X POST https://votre-backend.onrender.com/api/submit-lead \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test","email":"test@test.com"}'
```

---
**Le backend est maintenant protégé par une double correction d'URL Database pour Render !**
