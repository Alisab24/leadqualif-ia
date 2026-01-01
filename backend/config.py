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
    
    # Configuration de la base de données
    # Priorité à DATABASE_URL (Render) avec fallback SQLite (local)
    BASE_DIR = Path(__file__).parent
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # Fix Render : remplacer postgres:// par postgresql:// pour SQLAlchemy
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = database_url
    else:
        # Fallback SQLite pour les tests locaux
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{BASE_DIR}/leadqualif_ia.db'
    
    # Désactiver le suivi des modifications SQLAlchemy (améliore les performances)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Configuration CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')


