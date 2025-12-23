#!/bin/bash
# Script de démarrage avec environnement virtuel pour LeadQualif IA
# Assurez-vous que ce fichier a des fins de ligne Unix (LF, pas CRLF)

# Vérifier que nous sommes dans le bon dossier
if [ ! -f "requirements.txt" ] || [ ! -f "run.py" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le dossier backend/"
    echo "   Utilisation: cd backend && ./start.sh"
    exit 1
fi

echo "=========================================="
echo "🚀 LeadQualif IA - Démarrage"
echo "=========================================="
echo ""

# Vérifier si l'environnement virtuel existe
if [ ! -d "venv" ]; then
    echo "📦 Création de l'environnement virtuel..."
    
    # Vérifier que python3-venv est disponible
    if ! python3 -m venv --help > /dev/null 2>&1; then
        echo "⚠️  python3-venv n'est pas disponible"
        echo "💡 Installation de python3-venv..."
        echo "   (Vous devrez peut-être entrer votre mot de passe)"
        sudo apt update && sudo apt install -y python3-venv python3-full
    fi
    
    python3 -m venv venv
    
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de la création de l'environnement virtuel"
        echo "💡 Essayez manuellement :"
        echo "   sudo apt install python3-venv python3-full"
        echo "   python3 -m venv venv"
        exit 1
    fi
    
    echo "✅ Environnement virtuel créé"
    echo ""
fi

# Activer l'environnement virtuel
echo "🔌 Activation de l'environnement virtuel..."
source venv/bin/activate

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'activation de l'environnement virtuel"
    exit 1
fi

echo "✅ Environnement virtuel activé"
echo ""

# Vérifier si les dépendances sont installées
if ! python -c "import flask" 2>/dev/null; then
    echo "📦 Installation des dépendances..."
    
    # Vérifier que nous utilisons bien le pip de l'environnement virtuel
    PIP_PATH=$(which pip)
    if [[ ! "$PIP_PATH" == *"venv/bin/pip"* ]]; then
        echo "⚠️  ATTENTION: pip ne vient pas de l'environnement virtuel"
        echo "   Chemin actuel: $PIP_PATH"
        echo "   Utilisation du pip de l'environnement virtuel directement..."
        ./venv/bin/pip install --upgrade pip
        ./venv/bin/pip install -r requirements.txt
    else
        pip install --upgrade pip
        pip install -r requirements.txt
    fi
    
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        echo "💡 Essayez manuellement :"
        echo "   source venv/bin/activate"
        echo "   pip install -r requirements.txt"
        exit 1
    fi
    
    echo "✅ Dépendances installées"
    echo ""
fi

# Lancer le serveur
echo "=========================================="
echo "🌐 Démarrage du serveur Flask..."
echo "=========================================="
echo ""

python run.py






