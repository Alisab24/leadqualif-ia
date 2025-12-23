"""
Configuration de l'application Flask
Gère les paramètres de la base de données et autres configurations
"""

import os
from pathlib import Path

class Config:
    """Configuration de base pour l'application"""
    
    # Clé secrète pour Flask (à changer en production)
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Configuration de la base de données SQLite (locale pour l'instant)
    # Le fichier sera créé dans le dossier backend/
    BASE_DIR = Path(__file__).parent
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f'sqlite:///{BASE_DIR}/leadqualif_ia.db'
    
    # Désactiver le suivi des modifications SQLAlchemy (améliore les performances)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Configuration CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')


