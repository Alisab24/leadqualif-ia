# 🚀 Déploiement PostgreSQL sur Render - Guide Complet

## ✅ Modifications effectuées pour la production

### 1. Configuration Base de Données (`backend/config.py`)
```python
# Priorité à DATABASE_URL (Render) avec fallback SQLite (local)
database_url = os.environ.get('DATABASE_URL')

if database_url:
    # Fix Render : remplacer postgres:// par postgresql:// pour SQLAlchemy
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = database_url
else:
    # Fallback SQLite pour les tests locaux
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{BASE_DIR}/leadqualif_ia.db'
```

### 2. Dépendances PostgreSQL (`backend/requirements.txt`)
```
flask
flask-cors
flask-sqlalchemy
flask-login
werkzeug
gunicorn
openai
psycopg2-binary  # ← Ajouté pour PostgreSQL
```

### 3. Serveur (`backend/app.py`)
```python
if __name__ == '__main__':
    # Render définit automatiquement le PORT
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
```
✅ **Déjà configuré correctement**

## 🔧 Étapes de déploiement sur Render

### Étape 1 : Créer la base de données PostgreSQL
1. Allez sur [Render Dashboard](https://dashboard.render.com)
2. Cliquez **"New +" → "PostgreSQL"**
3. Nom : `leadqualif-db`
4. Région : choisissez la plus proche de vos utilisateurs
5. Plan : **Free** (pour commencer)
6. Cliquez **"Create Database"**

### Étape 2 : Configurer le Backend
1. Allez sur votre service backend existant
2. **Environment → Add Environment Variable** :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | Copiez depuis votre base PostgreSQL Render |
| `OPENAI_API_KEY` | Votre clé OpenAI `sk-...` |
| `SECRET_KEY` | Clé secrète Flask (générez-en une) |

### Étape 3 : Mettre à jour le Build Command
Dans votre service backend :
- **Build Command** : `pip install -r requirements.txt`
- **Start Command** : `gunicorn app:app`

### Étape 4 : Déployer
1. **Push votre code** sur GitHub
2. Render va automatiquement détecter les changements
3. Attendez le déploiement (vert ✅)

## 🧪 Tests locaux

### Avec SQLite (par défaut)
```bash
cd backend
python app.py
# Utilise automatiquement leadqualif_ia.db
```

### Avec PostgreSQL local (optionnel)
```bash
# Installer PostgreSQL localement
brew install postgresql  # macOS
sudo apt-get install postgresql  # Ubuntu

# Créer une base de données
createdb leadqualif_local

# Configurer la variable
export DATABASE_URL=postgresql://user:pass@localhost/leadqualif_local

# Lancer
python app.py
```

## 🚨 Validation du déploiement

### 1. Vérifier la connexion DB
```bash
curl https://votre-backend.onrender.com/
# Devrait retourner : {"status": "online", "message": "Cerveau LeadQualif IA prêt"}
```

### 2. Tester la création de lead
```bash
curl -X POST https://votre-backend.onrender.com/api/submit-lead \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test","email":"test@test.com","telephone":"0123456789","adresse":"Paris","prix":300000}'
```

### 3. Vérifier les logs
- Allez sur le service Render → **Logs**
- Cherchez des erreurs de connexion DB
- Vérifiez que les tables sont créées

## 🔄 Migration des données (si nécessaire)

### Depuis SQLite vers PostgreSQL
```python
# Script de migration (à exécuter une fois)
import sqlite3
import psycopg2
from config import Config

# Export SQLite
conn_sqlite = sqlite3.connect('leadqualif_ia.db')
cursor_sqlite = conn_sqlite.cursor()
cursor_sqlite.execute("SELECT * FROM lead")
leads = cursor_sqlite.fetchall()

# Import PostgreSQL
conn_pg = psycopg2.connect(Config.SQLALCHEMY_DATABASE_URI)
cursor_pg = conn_pg.cursor()

for lead in leads:
    cursor_pg.execute("""
        INSERT INTO lead (nom, email, telephone, type_bien, budget, score_ia, statut)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, lead)

conn_pg.commit()
print("✅ Migration terminée")
```

## 🎯 Avantages PostgreSQL

- 🚀 **Performance** supérieure à SQLite
- 🔒 **Sécurité** renforcée
- 📈 **Scalabilité** pour la croissance
- 🔄 **Backups** automatiques sur Render
- 🌐 **Multi-utilisateurs** simultanés

---
**Votre backend est maintenant prêt pour PostgreSQL sur Render !**
