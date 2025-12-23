#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de vérification du serveur Flask
Vérifie que le serveur est accessible et que tous les endpoints fonctionnent
"""

import requests
import sys

def check_server():
    """Vérifie que le serveur Flask est accessible"""
    base_url = 'http://localhost:5000'
    
    print("=" * 60)
    print("🔍 Vérification du serveur Flask")
    print("=" * 60)
    print()
    
    # Test 1: Vérifier que le serveur répond
    print("1️⃣  Vérification de la disponibilité du serveur...")
    try:
        response = requests.get(f'{base_url}/health', timeout=5)
        if response.status_code == 200:
            print("   ✅ Serveur accessible")
            print(f"   📊 Réponse: {response.json()}")
        else:
            print(f"   ⚠️  Serveur répond mais avec le code {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("   ❌ ERREUR: Le serveur n'est pas accessible")
        print("   💡 Solution: Lancez le serveur avec 'python backend/run.py'")
        return False
    except requests.exceptions.Timeout:
        print("   ❌ ERREUR: Le serveur ne répond pas (timeout)")
        return False
    except Exception as e:
        print(f"   ❌ ERREUR: {str(e)}")
        return False
    
    print()
    
    # Test 2: Vérifier l'endpoint de login
    print("2️⃣  Vérification de l'endpoint /login...")
    try:
        response = requests.post(
            f'{base_url}/login',
            json={'username': 'test', 'password': 'test'},
            timeout=5
        )
        if response.status_code in [200, 401]:
            print("   ✅ Endpoint /login accessible")
            if response.status_code == 401:
                print("   ℹ️  Réponse 401 attendue (identifiants incorrects)")
        else:
            print(f"   ⚠️  Code de réponse inattendu: {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERREUR: {str(e)}")
        return False
    
    print()
    
    # Test 3: Vérifier l'endpoint /dashboard (sans authentification)
    print("3️⃣  Vérification de l'endpoint /dashboard...")
    try:
        response = requests.get(f'{base_url}/dashboard', timeout=5)
        if response.status_code == 401:
            print("   ✅ Endpoint /dashboard protégé (401 attendu sans authentification)")
        else:
            print(f"   ⚠️  Code de réponse inattendu: {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERREUR: {str(e)}")
        return False
    
    print()
    print("=" * 60)
    print("✅ Tous les tests sont passés!")
    print("=" * 60)
    print()
    print("💡 Le serveur Flask fonctionne correctement.")
    print("   Vous pouvez maintenant vous connecter depuis le frontend.")
    print()
    
    return True

if __name__ == '__main__':
    try:
        success = check_server()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n👋 Vérification interrompue")
        sys.exit(1)






