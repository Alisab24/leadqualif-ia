# 🚀 Guide de Démarrage - WSL/Linux

## ⚠️ Erreur "externally-managed-environment"

Cette erreur apparaît car les systèmes Linux modernes protègent l'environnement Python système. **Solution : utiliser un environnement virtuel.**

**Si vous voyez toujours cette erreur même avec un venv activé**, consultez `FIX_VENV_WSL.md` pour la solution complète.

---

## ✅ Solution Rapide (WSL/Linux)

### Option 1 : Script automatique (Recommandé)

Dans votre terminal WSL :

```bash
cd backend
chmod +x start.sh
./start.sh
```

Le script fait tout automatiquement !

### Option 2 : Commandes manuelles

```bash
cd backend

# 1. Créer l'environnement virtuel (une seule fois)
python3 -m venv venv

# 2. Activer l'environnement virtuel
source venv/bin/activate

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Lancer le serveur
python run.py
```

---

## 🔄 À chaque nouvelle session

Une fois l'environnement virtuel créé, activez-le simplement :

```bash
cd backend
source venv/bin/activate
python run.py
```

**✅ Vérification** : Vous devez voir `(venv)` au début de votre ligne de commande.

---

## 📋 Checklist Complète

1. **Créer l'environnement virtuel** (une seule fois)
   ```bash
   cd backend
   python3 -m venv venv
   ```

2. **Activer l'environnement virtuel** (à chaque session)
   ```bash
   source venv/bin/activate
   ```

3. **Installer les dépendances** (une seule fois, après création du venv)
   ```bash
   pip install -r requirements.txt
   ```

4. **Lancer le serveur**
   ```bash
   python run.py
   ```

5. **Vérifier que ça fonctionne**
   - Ouvrez `http://localhost:5000/health` dans votre navigateur
   - Vous devriez voir : `{"status":"healthy","database":"connected"}`

---

## 🐛 Dépannage

### "python3: command not found"

Installez Python 3 :
```bash
sudo apt update
sudo apt install python3 python3-venv python3-pip
```

### "venv/bin/activate: No such file or directory"

Assurez-vous d'être dans le dossier `backend/` :
```bash
pwd  # Doit afficher quelque chose comme /mnt/c/Users/hp/Hp/nexap/backend
cd backend
source venv/bin/activate
```

### L'environnement virtuel n'est pas activé

Si vous ne voyez pas `(venv)` dans votre terminal :
```bash
source venv/bin/activate
```

### "pip: command not found" après activation du venv

Réinstallez l'environnement virtuel :
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 💡 Astuce

Créez un alias dans votre `~/.bashrc` ou `~/.zshrc` :

```bash
alias start-flask='cd ~/Hp/nexap/backend && source venv/bin/activate && python run.py'
```

Puis rechargez votre shell :
```bash
source ~/.bashrc
```

Maintenant vous pouvez simplement taper :
```bash
start-flask
```

---

## 📚 Fichiers de référence

- `backend/SETUP_VENV.md` : Guide détaillé de l'environnement virtuel
- `backend/README_VENV.md` : Guide rapide
- `DEPANNAGE_RAPIDE.md` : Dépannage général

---

## ✅ Vérification finale

Après avoir lancé le serveur, vous devriez voir :

```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
```

Le serveur est prêt ! 🎉






