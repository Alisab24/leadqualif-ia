# 🚀 Comment Démarrer le Serveur Flask

## Méthode 1 : Avec le script run.py (Recommandé)

```bash
cd backend
python run.py
```

**OU sur Windows si `python` ne fonctionne pas :**

```bash
cd backend
py run.py
```

Ce script :
- ✅ Vérifie automatiquement que toutes les dépendances sont installées
- ✅ Affiche des messages d'erreur clairs si quelque chose ne va pas
- ✅ Te montre exactement sur quelle URL le serveur est accessible

## Méthode 2 : Avec app.py directement

```bash
cd backend
python app.py
```

## ⚠️ Si tu vois une erreur "Module not found"

Cela signifie que les dépendances ne sont pas installées. Exécute :

```bash
cd backend
pip install -r requirements.txt
```

**OU sur Windows si `pip` ne fonctionne pas :**

```bash
cd backend
py -m pip install -r requirements.txt
```

## ✅ Vérification que le serveur fonctionne

Une fois le serveur démarré, tu devrais voir dans le terminal :

```
🌐 Serveur Flask démarré
📍 URL locale :   http://localhost:5173
```

**Teste dans ton navigateur :**
- Ouvre `http://localhost:5173/health`
- Tu devrais voir : `{"status": "healthy", "database": "connected"}`

## 🔧 Dépannage

### Le port 5000 est déjà utilisé

Si tu vois une erreur comme "Address already in use", cela signifie qu'un autre programme utilise le port 5000.

**Solutions :**
1. Ferme l'autre programme qui utilise le port 5173
2. OU change le port dans `app.py` ligne 58 : `port = int(os.environ.get('PORT', 5001))` (puis utilise le port 5174)

### Erreur "No module named 'flask'"

Installe les dépendances :
```bash
pip install -r requirements.txt
```

### Le serveur démarre mais le navigateur ne peut pas se connecter

1. Vérifie que le serveur affiche bien "Running on http://0.0.0.0:5173"
2. Essaie `http://127.0.0.1:5173/health` au lieu de `localhost`
3. Vérifie ton pare-feu Windows

