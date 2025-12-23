#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de démarrage simple pour le serveur Flask
Affiche des messages clairs en cas d'erreur
"""

import sys
import os

# Ajouter le dossier backend au path Python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def check_dependencies():
    """Vérifie que toutes les dépendances sont installées"""
    missing = []
    
    try:
        import flask
    except ImportError:
        missing.append('flask')
    
    try:
        import flask_cors
    except ImportError:
        missing.append('flask-cors')
    
    try:
        import flask_sqlalchemy
    except ImportError:
        missing.append('flask-sqlalchemy')
    
    if missing:
        print("=" * 60)
        print("❌ ERREUR : Dépendances manquantes")
        print("=" * 60)
        print("\nLes packages suivants ne sont pas installés :")
        for pkg in missing:
            print(f"  - {pkg}")
        print("\n📦 Pour installer les dépendances, exécutez :")
        print("   pip install -r requirements.txt")
        print("\nOu installez-les individuellement :")
        for pkg in missing:
            print(f"   pip install {pkg}")
        print("=" * 60)
        return False
    
    return True

def main():
    """Fonction principale de démarrage"""
    print("=" * 60)
    print("🚀 LeadQualif IA - Démarrage du serveur Flask")
    print("=" * 60)
    
    # Vérifier les dépendances
    print("\n📋 Vérification des dépendances...")
    if not check_dependencies():
        sys.exit(1)
    
    print("✅ Toutes les dépendances sont installées\n")
    
    # Importer et créer l'application
    try:
        print("📦 Chargement de l'application Flask...")
        from app import create_app
        
        app = create_app()
        print("✅ Application Flask chargée avec succès\n")
        
    except Exception as e:
        print("=" * 60)
        print("❌ ERREUR lors du chargement de l'application")
        print("=" * 60)
        print(f"\nErreur : {str(e)}")
        print("\nType d'erreur :", type(e).__name__)
        import traceback
        print("\nDétails complets :")
        traceback.print_exc()
        print("=" * 60)
        sys.exit(1)
    
    # Démarrer le serveur
    port = int(os.environ.get('PORT', 5005))
    host = '0.0.0.0'
    
    print("=" * 60)
    print(f"🌐 Serveur Flask démarré")
    print("=" * 60)
    print(f"\n📍 URL locale : http://localhost:{port}")
    print(f"📍 URL réseau : http://{host}:{port}")
    print(f"\n🔗 Endpoints disponibles :")
    print(f"   - http://localhost:{port}/")
    print(f"   - http://localhost:{port}/health")
    print(f"   - http://localhost:{port}/api/submit-lead")
    print(f"   - http://localhost:{port}/api/leads-chauds")
    print("\n💡 Pour arrêter le serveur, appuyez sur Ctrl+C")
    print("=" * 60)
    print()
    
    try:
        app.run(host=host, port=port, debug=True)
    except KeyboardInterrupt:
        print("\n\n👋 Arrêt du serveur Flask")
    except Exception as e:
        print("=" * 60)
        print("❌ ERREUR lors du démarrage du serveur")
        print("=" * 60)
        print(f"\nErreur : {str(e)}")
        import traceback
        traceback.print_exc()
        print("=" * 60)
        sys.exit(1)

if __name__ == '__main__':
    main()

