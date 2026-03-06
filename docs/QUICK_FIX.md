# ⚡ Solution Rapide - Erreur de Connexion

## 🚨 Message d'erreur

```
Erreur de connexion
Impossible de se connecter au serveur. Vérifiez que le serveur Flask est lancé sur http://localhost:5000
```

## ✅ Solution en 30 secondes

### ⚠️ Si vous voyez "Python est introuvable" sur Windows

**Solution rapide :**
1. Installez Python depuis le Microsoft Store
2. Redémarrez PowerShell
3. Vérifiez : `python --version`

**Guide complet :** `INSTALL_PYTHON_WINDOWS.md`

---

### Étape 1 : Vérifier si le serveur est lancé

**Ouvrez un nouveau terminal et testez :**

```bash
curl http://localhost:5000/health
```

**OU** ouvrez dans votre navigateur :
```
http://localhost:5000/health
```

**Résultats possibles :**

- ✅ **Vous voyez** `{"status":"healthy","database":"connected"}` 
  → Le serveur fonctionne ! Passez à l'étape 3.

- ❌ **Erreur "Connection refused" ou page ne charge pas**
  → Le serveur n'est PAS lancé. Passez à l'étape 2.

### Étape 2 : Lancer le serveur Flask

**Dans WSL/Linux :**
```bash
cd backend
source venv/bin/activate  # Si vous utilisez un environnement virtuel
python run.py
```

**Dans Windows :**
```bash
cd backend
python run.py
```

**Vous devriez voir :**
```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
```

**⚠️ GARDEZ CE TERMINAL OUVERT !** Le serveur doit rester en cours d'exécution.

### Étape 3 : Réessayer la connexion

1. Vérifiez que `http://localhost:5000/health` fonctionne dans le navigateur
2. Retournez sur `http://localhost:5173/login`
3. Réessayez de vous connecter avec :
   - Username : `agent01`
   - Password : `secretpass`

---

## 🔍 Si ça ne fonctionne toujours pas

### Test rapide avec le script

```bash
# Installer requests si nécessaire
pip install requests

# Lancer le test
python backend/test_connection.py
```

### Vérifier le port 5000

**Windows (PowerShell) :**
```powershell
netstat -ano | findstr :5000
```

**WSL/Linux :**
```bash
lsof -i :5000
```

Si une ligne apparaît, un autre processus utilise le port. Arrêtez-le.

### Voir les erreurs du serveur

Regardez le terminal où vous avez lancé `python run.py`. Y a-t-il des erreurs en rouge ?

---

## 📋 Checklist Express

- [ ] Le serveur Flask est lancé (terminal ouvert avec `python run.py`)
- [ ] `http://localhost:5000/health` fonctionne dans le navigateur
- [ ] Le port 5000 n'est pas utilisé par un autre programme
- [ ] Aucune erreur dans le terminal du serveur
- [ ] Le frontend React est lancé (`npm run dev`)

---

## 🆘 Besoin d'aide ?

Consultez `DIAGNOSTIC_CONNEXION.md` pour un guide de diagnostic complet.






