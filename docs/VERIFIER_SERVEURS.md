# ✅ Vérification des Serveurs - Erreur -102

## 🔍 Diagnostic Rapide

L'erreur -102 signifie que le serveur n'est **pas accessible**. Vérifiez étape par étape :

---

## 📋 Étape 1 : Vérifier le Backend Flask

### Test dans le navigateur

Ouvrez votre navigateur et allez à :
```
http://localhost:5000/health
```

**Résultats :**
- ✅ **Vous voyez** `{"status":"healthy","database":"connected"}` 
  → Le backend fonctionne ! Passez à l'étape 2.
  
- ❌ **Erreur de connexion** ou **page ne charge pas**
  → Le backend n'est PAS lancé. Suivez les instructions ci-dessous.

### Relancer le Backend Flask

**Dans WSL (terminal séparé) :**
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

**⚠️ GARDEZ CE TERMINAL OUVERT !**

---

## 📋 Étape 2 : Vérifier le Frontend React

### Test dans le navigateur

Ouvrez votre navigateur et allez à :
```
http://localhost:5173
```

**Résultats :**
- ✅ **Vous voyez** votre application React
  → Le frontend fonctionne ! Passez à l'étape 3.
  
- ❌ **Erreur de connexion** ou **page ne charge pas**
  → Le frontend n'est PAS lancé. Suivez les instructions ci-dessous.

### Relancer le Frontend React

**Dans PowerShell (nouveau terminal) :**
```powershell
cd C:\Users\hp\Hp\nexap
npm run dev
```

**Vous devriez voir :**
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

**⚠️ GARDEZ CE TERMINAL OUVERT !**

---

## 📋 Étape 3 : Accéder au Dashboard

Une fois les deux serveurs lancés :

1. **Ouvrez** : `http://localhost:5173/login`
2. **Connectez-vous** :
   - Username : `agent01`
   - Password : `secretpass`
3. **Accédez au dashboard** : `http://localhost:5173/dashboard`

---

## 🚀 Solution Rapide : Script Automatique

Pour lancer les deux serveurs automatiquement :

```powershell
.\start-all.ps1
```

Ce script va :
- ✅ Lancer le backend Flask dans WSL
- ✅ Lancer le frontend React
- ✅ Ouvrir deux terminaux séparés

---

## 📋 Checklist Complète

- [ ] **Terminal 1 (WSL)** : Backend Flask lancé → `http://localhost:5000/health` fonctionne
- [ ] **Terminal 2 (PowerShell)** : Frontend React lancé → `http://localhost:5173` fonctionne
- [ ] Les deux terminaux restent ouverts
- [ ] Aucune erreur dans les terminaux

---

## 🐛 Problèmes Courants

### Le backend démarre puis s'arrête

**Cause :** Erreur dans le code Python

**Solution :** Regardez les logs dans le terminal WSL pour voir l'erreur exacte.

### Le frontend ne démarre pas

**Cause :** Node.js non installé ou dépendances manquantes

**Solution :**
```powershell
node --version  # Vérifier Node.js
npm install     # Installer les dépendances
```

### Les deux serveurs démarrent mais ne communiquent pas

**Cause :** Problème CORS ou URLs incorrectes

**Solution :** Vérifiez que :
- Le backend écoute sur `0.0.0.0:5000` (pas seulement `127.0.0.1`)
- CORS est configuré dans `backend/app.py`
- Les URLs dans le frontend pointent vers `http://localhost:5000`

---

## 📚 Guides de Référence

- `DEMARRAGE_COMPLET.md` : Guide complet de démarrage
- `RESOLUTION_ERREUR_102.md` : Résolution détaillée de l'erreur -102
- `LANCER_SERVEUR_WSL.md` : Guide pour le backend WSL

---

## ✅ Vérification Finale

Après avoir lancé les deux serveurs :

1. ✅ `http://localhost:5000/health` → JSON
2. ✅ `http://localhost:5173` → Page React
3. ✅ `http://localhost:5173/login` → Formulaire de connexion
4. ✅ `http://localhost:5173/dashboard` → Dashboard (après connexion)

**Les deux serveurs doivent rester en cours d'exécution !** 🎉




