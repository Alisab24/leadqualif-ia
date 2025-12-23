# 🔧 Résolution Erreur -102

## ⚠️ Erreur -102 sur http://localhost:5000/health

Cette erreur signifie que le **serveur Flask backend n'est pas accessible** ou s'est arrêté.

## ✅ Solutions Immédiates

### Solution 1 : Vérifier que le serveur est toujours lancé

**Dans votre terminal WSL où vous avez lancé le serveur :**

Vérifiez si le serveur est toujours en cours d'exécution. Vous devriez voir :
```
 * Running on http://127.0.0.1:5000
```

**Si le serveur s'est arrêté :**

```bash
cd /mnt/c/Users/hp/Hp/nexap/backend
source venv/bin/activate
python run.py
```

### Solution 2 : Vérifier dans le navigateur

Ouvrez directement dans votre navigateur :
```
http://localhost:5000/health
```

**Résultats possibles :**
- ✅ **Vous voyez** `{"status":"healthy","database":"connected"}` → Le serveur fonctionne
- ❌ **Erreur de connexion** → Le serveur n'est pas lancé (voir Solution 1)

### Solution 3 : Vérifier le port 5000

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

**Si aucune ligne n'apparaît** → Le serveur n'est pas lancé.

**Si une ligne apparaît** → Un processus utilise le port, mais ce n'est peut-être pas votre serveur Flask.

---

## 🚀 Relancer le Serveur Completement

### Étape 1 : Arrêter tous les processus Python

**WSL/Linux :**
```bash
pkill -f "python.*run.py"
# ou
killall python3
```

**Windows (PowerShell) :**
```powershell
Get-Process python | Where-Object {$_.Path -like "*nexap*"} | Stop-Process -Force
```

### Étape 2 : Relancer le serveur proprement

**Dans WSL :**
```bash
cd /mnt/c/Users/hp/Hp/nexap/backend
source venv/bin/activate
python run.py
```

**Vous devriez voir :**
```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
 * Running on http://127.0.0.1:5000
```

### Étape 3 : Vérifier dans le navigateur

Allez sur `http://localhost:5000/health` - vous devriez voir la réponse JSON.

---

## 🔍 Diagnostic Avancé

### Test avec curl (dans WSL)

```bash
curl http://localhost:5000/health
```

**Résultats :**
- ✅ `{"status":"healthy","database":"connected"}` → Le serveur fonctionne
- ❌ `Connection refused` → Le serveur n'est pas lancé
- ❌ `Connection timed out` → Un firewall bloque la connexion

### Vérifier les logs du serveur

Regardez le terminal où vous avez lancé `python run.py`. Y a-t-il des erreurs en rouge ?

**Erreurs courantes :**
- `Address already in use` → Port 5000 occupé
- `ModuleNotFoundError` → Dépendances manquantes
- `ImportError` → Problème d'import

---

## 💡 Utiliser le Script Automatique

Le script `start-all.ps1` lance automatiquement les deux serveurs :

```powershell
.\start-all.ps1
```

Ce script va :
1. ✅ Vérifier que Node.js est installé
2. ✅ Lancer le backend Flask dans WSL
3. ✅ Lancer le frontend React
4. ✅ Ouvrir deux terminaux séparés

---

## 📋 Checklist de Diagnostic

- [ ] Le serveur Flask est lancé dans un terminal WSL
- [ ] Le terminal affiche "Running on http://127.0.0.1:5000"
- [ ] `http://localhost:5000/health` fonctionne dans le navigateur
- [ ] Le port 5000 n'est pas utilisé par un autre processus
- [ ] Aucune erreur dans les logs du serveur
- [ ] L'environnement virtuel est activé (`(venv)` visible)

---

## 🆘 Si Rien Ne Fonctionne

1. **Redémarrez complètement :**
   - Arrêtez tous les processus Python
   - Fermez tous les terminaux
   - Relancez le serveur

2. **Vérifiez la configuration :**
   - `backend/app.py` - Configuration du serveur
   - `backend/requirements.txt` - Dépendances installées
   - `backend/venv/` - Environnement virtuel existe

3. **Consultez les guides :**
   - `LANCER_SERVEUR_WSL.md` - Guide WSL
   - `DEMARRAGE_COMPLET.md` - Guide complet
   - `DEPANNAGE_RAPIDE.md` - Dépannage général

---

## ✅ Vérification Finale

Après avoir relancé le serveur :

1. ✅ Terminal WSL affiche "Running on http://127.0.0.1:5000"
2. ✅ `http://localhost:5000/health` fonctionne dans le navigateur
3. ✅ `http://localhost:5000/` affiche le message de bienvenue
4. ✅ Le frontend peut se connecter au backend

**Le serveur doit rester en cours d'exécution !** 🎉




