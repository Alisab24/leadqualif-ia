"""
Script de test pour vérifier la configuration CORS
Teste que le serveur Flask accepte bien les requêtes depuis le frontend
"""

import requests
import json

# URL du serveur Flask
BASE_URL = 'http://localhost:5000'

def test_cors():
    """Teste la configuration CORS"""
    print("🧪 Test de la configuration CORS\n")
    
    # Test 1: Requête simple GET
    print("1. Test GET /health")
    try:
        response = requests.get(f'{BASE_URL}/health')
        print(f"   ✅ Status: {response.status_code}")
        print(f"   ✅ Headers CORS présents: {'Access-Control-Allow-Origin' in response.headers}")
        if 'Access-Control-Allow-Origin' in response.headers:
            print(f"   ✅ Origin autorisée: {response.headers['Access-Control-Allow-Origin']}")
        print(f"   ✅ Réponse: {response.json()}\n")
    except Exception as e:
        print(f"   ❌ Erreur: {e}\n")
    
    # Test 2: Requête OPTIONS (preflight)
    print("2. Test OPTIONS (preflight)")
    try:
        response = requests.options(
            f'{BASE_URL}/api/leads-chauds',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET'
            }
        )
        print(f"   ✅ Status: {response.status_code}")
        print(f"   ✅ Headers CORS présents: {'Access-Control-Allow-Origin' in response.headers}")
        print(f"   ✅ Méthodes autorisées: {response.headers.get('Access-Control-Allow-Methods', 'N/A')}\n")
    except Exception as e:
        print(f"   ❌ Erreur: {e}\n")
    
    # Test 3: Requête GET avec Origin
    print("3. Test GET /api/leads-chauds avec Origin")
    try:
        response = requests.get(
            f'{BASE_URL}/api/leads-chauds',
            headers={'Origin': 'http://localhost:5173'}
        )
        print(f"   ✅ Status: {response.status_code}")
        print(f"   ✅ Headers CORS présents: {'Access-Control-Allow-Origin' in response.headers}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Nombre de leads chauds: {data.get('count', 0)}\n")
        else:
            print(f"   ⚠️  Réponse: {response.text}\n")
    except Exception as e:
        print(f"   ❌ Erreur: {e}\n")
    
    print("✅ Tests CORS terminés")

if __name__ == '__main__':
    print("=" * 50)
    print("Test de Configuration CORS - LeadQualif IA")
    print("=" * 50)
    print("\n⚠️  Assurez-vous que le serveur Flask est lancé sur le port 5000\n")
    
    test_cors()


