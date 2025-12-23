# 🔍 Diagnostic - Erreur de Connexion au Serveur

## ⚠️ Message d'erreur

```
Erreur de connexion
Impossible de se connecter au serveur. Vérifiez que le serveur Flask est lancé sur http://localhost:5000
```

## ✅ Checklist de Diagnostic (à suivre dans l'ordre)

### 1️⃣ Vérifier que le serveur Flask est lancé

**Ouvrez un terminal et vérifiez :**

```bash
# Dans WSL/Linux
cd backend
source venv/bin/activate  # Si vous utilisez un environnement virtuel
python run.py
```

**Vous devriez voir :**
```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
```

**⚠️ IMPORTANT :** Le terminal doit rester ouvert ! Le serveur doit être en cours d'exécution.

### 2️⃣ Tester l'accès au serveur dans le navigateur

Ouvrez votre navigateur et allez à :
```
http://localhost:5000/health
```

**Réponse attendue :**
```json
{"status":"healthy","database":"connected"}
```

**Si ça ne fonctionne pas :**
- ❌ Le serveur n'est pas lancé → Passez à l'étape 1
- ❌ Erreur de connexion → Vérifiez le port (étape 3)
- ❌ Page blanche → Vérifiez les logs du serveur

### 3️⃣ Vérifier que le port 5000 est libre

**Windows (PowerShell) :**
```powershell
netstat -ano | findstr :5000
```

**WSL/Linux :**
```bash
lsof -i :5000
# ou
netstat -tuln | grep 5000
```

**Si le port est utilisé :**
- Arrêtez le processus qui utilise le port
- Ou changez le port dans `backend/app.py` (ligne 91)

### 4️⃣ Vérifier les logs du serveur Flask

Regardez le terminal où vous avez lancé le serveur. Y a-t-il des erreurs ?

**Erreurs courantes :**
- `Address already in use` → Port 5000 occupé
- `ModuleNotFoundError` → Dépendances manquantes
- `ImportError` → Problème d'import

### 5️⃣ Vérifier que les dépendances sont installées

**WSL/Linux (avec venv) :**
```bash
cd backend
source venv/bin/activate
pip list | grep -i flask
```

**Vous devriez voir :**
- Flask
- flask-cors
- Flask-Login
- Flask-SQLAlchemy

**Si des packages manquent :**
```bash
pip install -r requirements.txt
```

### 6️⃣ Vérifier la configuration CORS

Ouvrez `backend/app.py` et vérifiez que la configuration CORS inclut votre origine :

```python
CORS(app, 
     origins=['http://localhost:5173', 'http://localhost:3000', ...],
     supports_credentials=True)
```

### 7️⃣ Tester avec curl (optionnel)

**Test de l'endpoint /health :**
```bash
curl http://localhost:5000/health
```

**Test de l'endpoint /login :**
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"agent01","password":"secretpass"}'
```

---

## 🚀 Solution Rapide

### Étape 1 : Arrêter tous les processus Flask

**Windows :**
```powershell
# Trouver le processus
netstat -ano | findstr :5000
# Arrêter le processus (remplacez PID par le numéro trouvé)
taskkill /PID <PID> /F
```

**WSL/Linux :**
```bash
# Trouver et arrêter le processus
pkill -f "python.*run.py"
# ou
killall python3
```

### Étape 2 : Relancer le serveur proprement

**WSL/Linux :**
```bash
cd backend
source venv/bin/activate
python run.py
```

**Windows :**
```bash
cd backend
python run.py
```

### Étape 3 : Vérifier dans le navigateur

Allez à `http://localhost:5000/health` - vous devriez voir la réponse JSON.

### Étape 4 : Réessayer la connexion

Retournez sur `http://localhost:5173/login` et réessayez.

---

## 🐛 Problèmes Spécifiques

### Problème : "Connection refused"

**Causes possibles :**
1. Le serveur Flask n'est pas lancé
2. Le serveur écoute sur un autre port
3. Un firewall bloque la connexion

**Solution :**
```bash
# Vérifier que le serveur est lancé
ps aux | grep python

# Vérifier le port
netstat -tuln | grep 5000
```

### Problème : Le serveur démarre mais le frontend ne peut pas se connecter

**Vérifications :**
1. Le serveur écoute sur `0.0.0.0` (pas seulement `127.0.0.1`)
2. CORS est configuré correctement
3. `supports_credentials=True` est présent
4. Les URLs dans le frontend sont correctes

### Problème : Erreur CORS dans la console du navigateur

**Solution :**
1. Vérifiez que `flask-cors` est installé
2. Vérifiez que votre origine est dans la liste `origins`
3. Vérifiez que `supports_credentials=True` est configuré

---

## 📋 Checklist Complète

- [ ] Le serveur Flask est lancé dans un terminal
- [ ] Le terminal affiche "Serveur Flask démarré"
- [ ] `http://localhost:5000/health` fonctionne dans le navigateur
- [ ] Le port 5000 n'est pas utilisé par un autre processus
- [ ] Toutes les dépendances sont installées
- [ ] Aucune erreur dans les logs du serveur
- [ ] Le frontend React est lancé (`npm run dev`)
- [ ] Aucune erreur CORS dans la console du navigateur (F12)

---

## 💡 Commandes Utiles

### Voir les processus Python en cours
```bash
ps aux | grep python
```

### Voir les ports en écoute
```bash
netstat -tuln | grep 5000
```

### Tester la connexion au serveur
```bash
curl http://localhost:5000/health
```

### Voir les logs en temps réel
Les logs s'affichent directement dans le terminal où vous avez lancé le serveur.

---

## 🆘 Si Rien Ne Fonctionne

1. **Redémarrez complètement :**
   - Arrêtez tous les processus Python
   - Fermez tous les terminaux
   - Relancez le serveur

2. **Vérifiez les fichiers de configuration :**
   - `backend/app.py` - Configuration du serveur
   - `backend/requirements.txt` - Dépendances
   - `src/context/AuthContext.jsx` - URLs du frontend

3. **Consultez les guides :**
   - `DEPANNAGE_RAPIDE.md` - Guide général
   - `DEMARRAGE_WSL.md` - Guide WSL/Linux
   - `VERIFIER_SERVEUR.md` - Vérification complète

4. **Vérifiez la console du navigateur (F12) :**
   - Onglet "Console" pour les erreurs JavaScript
   - Onglet "Network" pour voir les requêtes HTTP






