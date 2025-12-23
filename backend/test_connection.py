#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de test de connexion au serveur Flask
Vérifie que le serveur est accessible et répond correctement
"""

import requests
import sys
import time

def test_connection():
    """Teste la connexion au serveur Flask"""
    base_url = 'http://localhost:5000'
    
    print("=" * 60)
    print("🔍 Test de Connexion au Serveur Flask")
    print("=" * 60)
    print()
    
    # Test 1: Vérifier que le serveur répond
    print("1️⃣  Test de connexion au serveur...")
    try:
        response = requests.get(f'{base_url}/health', timeout=3)
        if response.status_code == 200:
            print("   ✅ Serveur accessible et répond correctement")
            print(f"   📊 Réponse: {response.json()}")
            return True
        else:
            print(f"   ⚠️  Serveur répond mais avec le code {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ ERREUR: Impossible de se connecter au serveur")
        print()
        print("   💡 Solutions possibles :")
        print("      1. Le serveur Flask n'est pas lancé")
        print("         → Lancez : cd backend && python run.py")
        print()
        print("      2. Le serveur écoute sur un autre port")
        print("         → Vérifiez le port dans backend/app.py")
        print()
        print("      3. Un firewall bloque la connexion")
        print("         → Vérifiez vos paramètres de firewall")
        return False
    except requests.exceptions.Timeout:
        print("   ❌ ERREUR: Le serveur ne répond pas (timeout)")
        print("   💡 Le serveur est peut-être surchargé ou bloqué")
        return False
    except Exception as e:
        print(f"   ❌ ERREUR: {str(e)}")
        return False

if __name__ == '__main__':
    print()
    print("⚠️  Assurez-vous que le serveur Flask est lancé avant de lancer ce test")
    print("   Lancez dans un autre terminal : cd backend && python run.py")
    print()
    time.sleep(2)
    
    success = test_connection()
    
    print()
    if success:
        print("=" * 60)
        print("✅ Le serveur Flask fonctionne correctement !")
        print("=" * 60)
        print()
        print("💡 Vous pouvez maintenant vous connecter depuis le frontend.")
    else:
        print("=" * 60)
        print("❌ Le serveur Flask n'est pas accessible")
        print("=" * 60)
        print()
        print("📚 Consultez DIAGNOSTIC_CONNEXION.md pour plus d'aide")
    
    print()
    sys.exit(0 if success else 1)






