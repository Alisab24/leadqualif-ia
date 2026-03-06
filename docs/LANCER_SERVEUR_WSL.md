# 🚀 Guide Rapide - Lancer le Serveur dans WSL

## ⚡ Solution Immédiate

### Option 1 : Commandes manuelles (Recommandé)

```bash
# 1. Aller dans le dossier backend
cd /mnt/c/Users/hp/Hp/nexap/backend

# 2. Supprimer l'ancien venv s'il existe
rm -rf venv

# 3. Installer python3-venv si nécessaire
sudo apt update
sudo apt install -y python3-venv python3-full

# 4. Créer l'environnement virtuel
python3 -m venv venv

# 5. Activer l'environnement virtuel
source venv/bin/activate

# 6. Mettre à jour pip
pip install --upgrade pip

# 7. Installer les dépendances
pip install -r requirements.txt

# 8. Lancer le serveur
python run.py
```

### Option 2 : Utiliser le script (après correction)

Si le script `start.sh` ne fonctionne pas à cause des fins de ligne :

```bash
cd /mnt/c/Users/hp/Hp/nexap/backend

# Corriger les fins de ligne
dos2unix start.sh
# OU si dos2unix n'est pas installé :
sed -i 's/\r$//' start.sh

# Rendre exécutable
chmod +x start.sh

# Lancer
./start.sh
```

---

## 🔧 Correction des Fins de Ligne

Le problème "cannot execute: required file not found" vient souvent des fins de ligne Windows (CRLF) au lieu de Linux (LF).

### Solution 1 : Installer dos2unix

```bash
sudo apt install dos2unix
dos2unix backend/start.sh
chmod +x backend/start.sh
```

### Solution 2 : Utiliser sed

```bash
sed -i 's/\r$//' backend/start.sh
chmod +x backend/start.sh
```

### Solution 3 : Recréer le fichier dans WSL

```bash
cd /mnt/c/Users/hp/Hp/nexap/backend
cat > start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python run.py
EOF
chmod +x start.sh
```

---

## ✅ Vérification

Après avoir lancé le serveur, vous devriez voir :

```
🚀 LeadQualif IA - Démarrage du serveur Flask
📍 URL locale : http://localhost:5000
```

Testez dans votre navigateur : `http://localhost:5000/health`

---

## 🐛 Si ça ne fonctionne toujours pas

### Vérifier que vous êtes dans le bon dossier

```bash
pwd
# Doit afficher : /mnt/c/Users/hp/Hp/nexap/backend

ls -la
# Doit montrer : requirements.txt, run.py, app.py, start.sh
```

### Vérifier l'environnement virtuel

```bash
source venv/bin/activate
which python
# Doit afficher : /mnt/c/Users/hp/Hp/nexap/backend/venv/bin/python

which pip
# Doit afficher : /mnt/c/Users/hp/Hp/nexap/backend/venv/bin/pip
```

### Installer les dépendances manuellement

```bash
cd /mnt/c/Users/hp/Hp/nexap/backend
source venv/bin/activate
./venv/bin/pip install -r requirements.txt
```

---

## 💡 Astuce : Créer un alias

Ajoutez dans votre `~/.bashrc` :

```bash
alias start-flask='cd /mnt/c/Users/hp/Hp/nexap/backend && source venv/bin/activate && python run.py'
```

Puis :
```bash
source ~/.bashrc
start-flask
```





