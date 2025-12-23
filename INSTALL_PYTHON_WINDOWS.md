# 🐍 Installation de Python sur Windows

## ⚠️ Erreur : "Python est introuvable"

Cette erreur signifie que Python n'est pas installé ou n'est pas dans le PATH système.

## ✅ Solution : Installer Python

### Méthode 1 : Installation depuis le Microsoft Store (Recommandé)

1. **Ouvrez le Microsoft Store** (recherchez "Microsoft Store" dans le menu Démarrer)

2. **Recherchez "Python 3.12"** ou "Python 3.11"

3. **Cliquez sur "Obtenir"** ou "Installer"

4. **Attendez la fin de l'installation**

5. **Redémarrez PowerShell** (fermez et rouvrez le terminal)

6. **Vérifiez l'installation :**
   ```powershell
   python --version
   ```
   Vous devriez voir quelque chose comme : `Python 3.12.x`

### Méthode 2 : Installation depuis python.org (Alternative)

1. **Téléchargez Python :**
   - Allez sur https://www.python.org/downloads/
   - Cliquez sur "Download Python 3.12.x" (ou la dernière version)

2. **Lancez l'installateur :**
   - ⚠️ **IMPORTANT** : Cochez la case **"Add Python to PATH"** en bas de la fenêtre d'installation
   - Cliquez sur "Install Now"

3. **Attendez la fin de l'installation**

4. **Redémarrez PowerShell**

5. **Vérifiez l'installation :**
   ```powershell
   python --version
   ```

---

## 🔧 Vérification de l'installation

### Test rapide avec le script PowerShell

Dans PowerShell, depuis le dossier du projet :

```powershell
.\backend\check_python.ps1
```

Le script vérifie automatiquement :
- ✅ Si Python est installé
- ✅ Si pip est installé
- ✅ Si Python fonctionne correctement

### Test manuel : Version de Python

```powershell
python --version
```

**Résultat attendu :** `Python 3.11.x` ou `Python 3.12.x`

### Test 2 : pip est installé

```powershell
pip --version
```

**Résultat attendu :** `pip 23.x.x from ...`

### Test 3 : Python fonctionne

```powershell
python -c "print('Python fonctionne !')"
```

**Résultat attendu :** `Python fonctionne !`

---

## 🚀 Après l'installation : Lancer le serveur Flask

Une fois Python installé, vous pouvez lancer le serveur :

```powershell
cd backend
python run.py
```

**Si vous êtes sur WSL/Linux**, utilisez plutôt :

```bash
cd backend
source venv/bin/activate
python run.py
```

---

## 🐛 Si Python n'est toujours pas reconnu

### Vérifier le PATH

1. **Ouvrez les Variables d'environnement :**
   - Appuyez sur `Win + R`
   - Tapez `sysdm.cpl` et appuyez sur Entrée
   - Cliquez sur l'onglet "Avancé"
   - Cliquez sur "Variables d'environnement"

2. **Vérifiez la variable PATH :**
   - Dans "Variables système", trouvez "Path"
   - Cliquez sur "Modifier"
   - Vérifiez que ces chemins sont présents :
     - `C:\Users\VotreNom\AppData\Local\Programs\Python\Python312\`
     - `C:\Users\VotreNom\AppData\Local\Programs\Python\Python312\Scripts\`

3. **Si les chemins ne sont pas là :**
   - Cliquez sur "Nouveau"
   - Ajoutez les chemins ci-dessus (remplacez `VotreNom` par votre nom d'utilisateur)
   - Cliquez sur "OK" partout

4. **Redémarrez PowerShell** (fermez complètement et rouvrez)

### Réinstaller Python avec PATH

Si Python n'est toujours pas reconnu :

1. **Désinstallez Python** (Paramètres > Applications)

2. **Réinstallez Python** en cochant **"Add Python to PATH"**

3. **Redémarrez PowerShell**

---

## 💡 Alternative : Utiliser WSL (Windows Subsystem for Linux)

Si vous préférez utiliser Linux dans Windows :

1. **Installez WSL :**
   ```powershell
   wsl --install
   ```

2. **Redémarrez votre ordinateur**

3. **Ouvrez Ubuntu** (ou votre distribution Linux)

4. **Suivez le guide** `DEMARRAGE_WSL.md` pour configurer Python dans WSL

---

## 📋 Checklist Complète

- [ ] Python est installé (Microsoft Store ou python.org)
- [ ] "Add Python to PATH" était coché lors de l'installation
- [ ] PowerShell a été redémarré après l'installation
- [ ] `python --version` fonctionne
- [ ] `pip --version` fonctionne
- [ ] Le serveur Flask peut être lancé avec `python run.py`

---

## 🆘 Besoin d'aide ?

- **Documentation officielle Python :** https://docs.python.org/3/using/windows.html
- **Guide WSL :** `DEMARRAGE_WSL.md`
- **Guide de démarrage :** `DEPANNAGE_RAPIDE.md`






