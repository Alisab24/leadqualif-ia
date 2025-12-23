# 🚀 Guide de Démarrage Complet - Backend + Frontend

## ⚠️ Erreur -102 sur http://localhost:5173/dashboard

Cette erreur signifie que le **serveur frontend React (Vite) n'est pas lancé**.

## ✅ Solution : Lancer les deux serveurs

Vous devez avoir **DEUX terminaux ouverts** :

### Terminal 1 : Serveur Flask (Backend)

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
```

**⚠️ GARDEZ CE TERMINAL OUVERT !**

### Terminal 2 : Serveur React (Frontend)

**Dans PowerShell ou un nouveau terminal Windows :**
```bash
cd C:\Users\hp\Hp\nexap
npm run dev
```

**Vous devriez voir :**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**⚠️ GARDEZ CE TERMINAL OUVERT AUSSI !**

---

## 📋 Checklist Complète

- [ ] **Terminal 1** : Serveur Flask lancé sur `http://localhost:5000`
- [ ] **Terminal 2** : Serveur React lancé sur `http://localhost:5173`
- [ ] Le backend répond sur `http://localhost:5000/health`
- [ ] Le frontend répond sur `http://localhost:5173`

---

## 🔍 Vérifications

### Vérifier que le backend fonctionne

Ouvrez dans votre navigateur :
```
http://localhost:5000/health
```

**Résultat attendu :** `{"status":"healthy","database":"connected"}`

### Vérifier que le frontend fonctionne

Ouvrez dans votre navigateur :
```
http://localhost:5173
```

**Résultat attendu :** La page d'accueil de votre application React

---

## 🚀 Accès au Tableau de Bord

Une fois les deux serveurs lancés :

1. **Ouvrez votre navigateur** : `http://localhost:5173`
2. **Naviguez vers** : `http://localhost:5173/login`
3. **Connectez-vous** avec :
   - Username : `agent01`
   - Password : `secretpass`
4. **Accédez au dashboard** : `http://localhost:5173/dashboard`

---

## 🐛 Si le frontend ne démarre pas

### Vérifier que Node.js est installé

```bash
node --version
npm --version
```

### Installer les dépendances Node.js

```bash
cd C:\Users\hp\Hp\nexap
npm install
```

### Vérifier que le port 5173 est libre

**Windows (PowerShell) :**
```powershell
netstat -ano | findstr :5173
```

Si une ligne apparaît, un autre processus utilise le port. Arrêtez-le.

---

## 💡 Astuce : Script de Démarrage Automatique

Créez un fichier `start-all.ps1` dans le dossier racine :

```powershell
# start-all.ps1
# Script pour lancer les deux serveurs

Write-Host "🚀 Démarrage de LeadQualif IA" -ForegroundColor Cyan
Write-Host ""

# Terminal 1 : Backend Flask
Write-Host "📦 Lancement du serveur Flask..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\hp\Hp\nexap\backend; wsl bash -c 'source venv/bin/activate && python run.py'"

# Attendre un peu pour que le backend démarre
Start-Sleep -Seconds 3

# Terminal 2 : Frontend React
Write-Host "⚛️  Lancement du serveur React..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\hp\Hp\nexap; npm run dev"

Write-Host ""
Write-Host "✅ Les deux serveurs sont en cours de démarrage" -ForegroundColor Green
Write-Host "   Backend  : http://localhost:5000" -ForegroundColor White
Write-Host "   Frontend : http://localhost:5173" -ForegroundColor White
```

Puis lancez :
```powershell
.\start-all.ps1
```

---

## 📚 Guides de Référence

- `LANCER_SERVEUR_WSL.md` : Guide pour lancer le backend dans WSL
- `DEPANNAGE_RAPIDE.md` : Dépannage général
- `GUIDE_AUTHENTIFICATION.md` : Guide d'authentification

---

## ✅ Vérification Finale

Après avoir lancé les deux serveurs :

1. ✅ Backend accessible : `http://localhost:5000/health` → JSON
2. ✅ Frontend accessible : `http://localhost:5173` → Page React
3. ✅ Connexion fonctionne : `http://localhost:5173/login` → Formulaire de connexion
4. ✅ Dashboard accessible : `http://localhost:5173/dashboard` → Après connexion

**Les deux serveurs doivent rester en cours d'exécution !** 🎉




