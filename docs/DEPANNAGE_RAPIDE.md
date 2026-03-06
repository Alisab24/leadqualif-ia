# 🚨 Dépannage Rapide - Erreur de Connexion au Serveur

## ⚡ Solution Rapide (3 étapes)

### 🔴 ERREUR : "Python est introuvable" sur Windows

Si vous voyez cette erreur dans PowerShell :
```
Python est introuvable ; exécutez sans arguments pour installer...
```

**Solution rapide :**
1. Installez Python depuis le Microsoft Store (recherchez "Python 3.12")
2. OU téléchargez depuis https://www.python.org/downloads/ (cochez "Add Python to PATH")
3. Redémarrez PowerShell
4. Vérifiez avec : `python --version`

**Guide complet :** Consultez `INSTALL_PYTHON_WINDOWS.md`

---

### 🔴 IMPORTANT : Vérifiez d'abord que le serveur est lancé

**Test rapide :** Ouvrez `http://localhost:5000/health` dans votre navigateur.

- ✅ **Si vous voyez** `{"status":"healthy","database":"connected"}` → Le serveur fonctionne, passez à l'étape 3
- ❌ **Si vous voyez une erreur** → Le serveur n'est pas lancé, suivez l'étape 1

### 1️⃣ Lancer le serveur Flask

**Si vous êtes sur Linux/WSL et rencontrez l'erreur "externally-managed-environment" :**

```bash
cd backend

# Créer l'environnement virtuel (une seule fois)
python3 -m venv venv

# Activer l'environnement virtuel
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python run.py
```

**Ou utilisez le script de démarrage automatique :**

```bash
cd backend
chmod +x start.sh
./start.sh
```

**Si vous êtes sur Windows :**

```bash
cd backend
python run.py
```

Vous devriez voir :
```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
```

**⚠️ IMPORTANT** : Gardez ce terminal ouvert ! Le serveur doit rester en cours d'exécution.

### 2️⃣ Vérifier que le serveur fonctionne

Ouvrez votre navigateur et allez à :
```
http://localhost:5000/health
```

Vous devriez voir :
```json
{"status":"healthy","database":"connected"}
```

### 3️⃣ Réessayer la connexion

Retournez sur la page de connexion (`http://localhost:5173/login`) et réessayez de vous connecter.

---

## 🔍 Si ça ne fonctionne toujours pas

### Vérifier les dépendances

**Sur Linux/WSL (avec environnement virtuel) :**

```bash
cd backend
source venv/bin/activate  # Activer l'environnement virtuel
pip install -r requirements.txt
```

**Sur Windows :**

```bash
cd backend
pip install -r requirements.txt
```

### Vérifier que le port 5000 est libre

**Windows (PowerShell)** :
```powershell
netstat -ano | findstr :5000
```

Si une ligne apparaît, un autre processus utilise le port. Arrêtez-le ou changez le port.

### Vérifier les logs du serveur

Regardez le terminal où vous avez lancé `python run.py`. Y a-t-il des erreurs ?

### Tester avec le script de vérification

```bash
# Installer requests si nécessaire
pip install requests

# Lancer la vérification
python backend/check_server.py
```

---

## 📋 Checklist Complète

- [ ] Le serveur Flask est lancé dans un terminal
- [ ] Le terminal affiche "Serveur Flask démarré"
- [ ] `http://localhost:5000/health` fonctionne dans le navigateur
- [ ] Toutes les dépendances sont installées (`pip install -r requirements.txt`)
- [ ] Le port 5000 n'est pas utilisé par un autre programme
- [ ] Le frontend React est lancé (`npm run dev`)
- [ ] Aucune erreur dans la console du navigateur (F12)

---

## 🆘 Messages d'erreur courants

### "ModuleNotFoundError: No module named 'flask_login'"

**Solution** :
```bash
pip install Flask-Login==0.6.3
```

### "Address already in use"

**Solution** : Un autre programme utilise le port 5000. Arrêtez-le ou changez le port.

### "Connection refused"

**Solution** : Le serveur Flask n'est pas lancé. Lancez `python backend/run.py`.

---

## 💡 Astuce

**Gardez toujours deux terminaux ouverts** :
1. **Terminal 1** : Serveur Flask (`python backend/run.py`)
2. **Terminal 2** : Frontend React (`npm run dev`)

Les deux doivent rester en cours d'exécution pour que l'application fonctionne !






