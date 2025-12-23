# 🐍 Guide Rapide - Environnement Virtuel Python

## ⚡ Démarrage Rapide (WSL/Linux)

### Méthode 1 : Script automatique (Recommandé)

```bash
cd backend
chmod +x start.sh
./start.sh
```

Le script va :
1. ✅ Créer l'environnement virtuel si nécessaire
2. ✅ Activer l'environnement virtuel
3. ✅ Installer les dépendances
4. ✅ Lancer le serveur Flask

### Méthode 2 : Manuel

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

Une fois l'environnement virtuel créé, vous devez seulement l'activer :

```bash
cd backend
source venv/bin/activate
python run.py
```

**Important** : Vous devez voir `(venv)` au début de votre ligne de commande.

---

## ❓ Pourquoi utiliser un environnement virtuel ?

- ✅ Évite l'erreur "externally-managed-environment"
- ✅ Isole les dépendances du projet
- ✅ Ne modifie pas votre Python système
- ✅ Meilleure pratique Python

---

## 🆘 Dépannage

### "python3: command not found"

```bash
sudo apt update
sudo apt install python3 python3-venv python3-pip
```

### "venv/bin/activate: No such file or directory"

Vous n'êtes pas dans le dossier `backend/` :
```bash
cd backend
source venv/bin/activate
```

### L'environnement virtuel n'est pas activé

Vérifiez que vous voyez `(venv)` dans votre terminal. Si non :
```bash
source venv/bin/activate
```

---

## 📚 Plus d'informations

Consultez `backend/SETUP_VENV.md` pour un guide détaillé.






