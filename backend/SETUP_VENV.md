# 🔧 Configuration de l'Environnement Virtuel Python

## Problème : "externally-managed-environment"

Cette erreur apparaît sur les systèmes Linux modernes (Ubuntu 23.04+, Debian 12+) qui protègent l'environnement Python système.

## ✅ Solution : Utiliser un environnement virtuel

### Étape 1 : Créer un environnement virtuel

```bash
cd backend
python3 -m venv venv
```

### Étape 2 : Activer l'environnement virtuel

**Linux/WSL :**
```bash
source venv/bin/activate
```

**Windows (PowerShell) :**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD) :**
```cmd
venv\Scripts\activate.bat
```

Vous devriez voir `(venv)` apparaître au début de votre ligne de commande.

### Étape 3 : Installer les dépendances

```bash
pip install -r requirements.txt
```

### Étape 4 : Lancer le serveur

```bash
python run.py
```

### Étape 5 : Désactiver l'environnement virtuel (quand vous avez terminé)

```bash
deactivate
```

---

## 🚀 Script de démarrage rapide

Créez un fichier `start.sh` dans le dossier `backend` :

```bash
#!/bin/bash
# Script de démarrage avec environnement virtuel

# Activer l'environnement virtuel
source venv/bin/activate

# Installer les dépendances si nécessaire
if [ ! -d "venv/lib/python3.*/site-packages/flask" ]; then
    echo "📦 Installation des dépendances..."
    pip install -r requirements.txt
fi

# Lancer le serveur
echo "🚀 Démarrage du serveur Flask..."
python run.py
```

Rendez-le exécutable :
```bash
chmod +x backend/start.sh
```

Puis lancez-le :
```bash
./backend/start.sh
```

---

## 📝 Notes importantes

- **Toujours activer l'environnement virtuel** avant de lancer le serveur
- L'environnement virtuel doit être créé **une seule fois**
- Le dossier `venv/` ne doit **pas** être commité dans Git (déjà dans `.gitignore`)
- Si vous supprimez le dossier `venv/`, recréez-le avec `python3 -m venv venv`

---

## 🐛 Dépannage

### "python3: command not found"

Installez Python 3 :
```bash
sudo apt update
sudo apt install python3 python3-venv python3-pip
```

### "venv/bin/activate: No such file or directory"

Vous n'êtes pas dans le bon dossier. Assurez-vous d'être dans `backend/` :
```bash
cd backend
source venv/bin/activate
```

### Les packages ne s'installent pas

Vérifiez que l'environnement virtuel est activé (vous devriez voir `(venv)` dans votre terminal).






