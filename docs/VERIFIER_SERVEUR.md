# 🔍 Guide de Vérification du Serveur Flask

## Problème : "Erreur de connexion au serveur"

Si vous rencontrez cette erreur, suivez ces étapes pour diagnostiquer et résoudre le problème.

## ✅ Étape 1 : Vérifier que le serveur Flask est lancé

### Option A : Vérifier visuellement

Ouvrez un terminal et vérifiez que vous voyez un message comme :
```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
```

### Option B : Utiliser le script de vérification

```bash
# Installer requests si nécessaire
pip install requests

# Lancer le script de vérification
python backend/check_server.py
```

## ✅ Étape 2 : Lancer le serveur Flask

Si le serveur n'est pas lancé :

```bash
# Méthode 1 : Utiliser run.py (recommandé)
cd backend
python run.py

# Méthode 2 : Utiliser app.py directement
cd backend
python app.py
```

Le serveur doit démarrer sur `http://localhost:5000`

## ✅ Étape 3 : Vérifier les dépendances

Assurez-vous que toutes les dépendances sont installées :

```bash
cd backend
pip install -r requirements.txt
```

Dépendances requises :
- Flask==3.0.0
- flask-cors==4.0.0
- Flask-Login==0.6.3
- Flask-SQLAlchemy==3.1.1
- Werkzeug==3.0.1

## ✅ Étape 4 : Vérifier que le port 5000 est libre

Si le port 5000 est déjà utilisé :

### Windows (PowerShell)
```powershell
netstat -ano | findstr :5000
```

### Linux/Mac
```bash
lsof -i :5000
```

Si le port est utilisé, vous pouvez :
1. Arrêter le processus qui utilise le port
2. Changer le port dans `backend/app.py` :
   ```python
   port = int(os.environ.get('PORT', 5001))  # Changer 5000 en 5001
   ```
   Et mettre à jour les URLs dans le frontend.

## ✅ Étape 5 : Tester manuellement les endpoints

### Test 1 : Endpoint de santé
```bash
curl http://localhost:5000/health
```

Réponse attendue :
```json
{"status":"healthy","database":"connected"}
```

### Test 2 : Endpoint de login
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"agent01","password":"secretpass"}'
```

Réponse attendue (si identifiants corrects) :
```json
{"status":"success","message":"Connexion réussie","user":{"id":1,"username":"agent01"}}
```

## 🐛 Problèmes courants

### Problème 1 : "ModuleNotFoundError: No module named 'flask_login'"

**Solution** :
```bash
cd backend
pip install Flask-Login==0.6.3
```

### Problème 2 : "Address already in use"

**Solution** : Le port 5000 est déjà utilisé. Arrêtez l'autre processus ou changez le port.

### Problème 3 : "Erreur CORS"

**Solution** : Vérifiez que `flask-cors` est installé et que `supports_credentials=True` est configuré dans `app.py`.

### Problème 4 : Le serveur démarre mais le frontend ne peut pas se connecter

**Vérifications** :
1. Le serveur Flask écoute bien sur `0.0.0.0` (pas seulement `127.0.0.1`)
2. Aucun firewall ne bloque le port 5000
3. Les URLs dans le frontend pointent vers `http://localhost:5000`

## 📝 Checklist de diagnostic

- [ ] Le serveur Flask est lancé
- [ ] Le serveur répond sur `http://localhost:5000/health`
- [ ] Toutes les dépendances sont installées
- [ ] Le port 5000 n'est pas utilisé par un autre processus
- [ ] Aucune erreur dans la console du serveur Flask
- [ ] Les URLs dans le frontend sont correctes (`http://localhost:5000`)

## 💡 Commandes utiles

### Voir les logs du serveur Flask
Les logs s'affichent directement dans le terminal où vous avez lancé le serveur.

### Redémarrer le serveur
1. Arrêtez le serveur avec `Ctrl+C`
2. Relancez avec `python backend/run.py`

### Vérifier la base de données
```bash
cd backend
python -c "from app import create_app; from models import db, User; app = create_app(); app.app_context().push(); print('Users:', User.query.all())"
```

## 🆘 Si le problème persiste

1. Vérifiez les logs du serveur Flask dans le terminal
2. Ouvrez la console du navigateur (F12) et regardez les erreurs réseau
3. Vérifiez que vous utilisez bien `http://localhost:5000` (pas `https://`)
4. Essayez d'accéder directement à `http://localhost:5000/health` dans votre navigateur






