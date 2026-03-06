# Guide de Test - Formulaire et Dashboard

## 🚀 Démarrage Rapide

### Étape 1 : Lancer le Backend Flask

```bash
cd backend
python app.py
```

**Vérification :**
- Ouvrez `http://localhost:5000/health` dans votre navigateur
- Vous devriez voir : `{"status": "healthy", "database": "connected"}`

### Étape 2 : Lancer le Frontend React (Dashboard)

Dans un **nouveau terminal** :

```bash
npm run dev
```

Le Dashboard sera accessible sur `http://localhost:5173/dashboard`

### Étape 3 : Tester le Formulaire

#### Option A : Ouvrir directement le fichier HTML (Simple mais peut avoir des problèmes CORS)

1. Double-cliquez sur `formulaire.html` dans l'explorateur Windows
2. Remplissez le formulaire
3. Cliquez sur "Obtenir mon analyse personnalisée"

**⚠️ Si vous voyez l'erreur "Failed to fetch" :**
- Vérifiez que le serveur Flask est bien lancé (`python backend/app.py`)
- Ouvrez la console du navigateur (F12) pour voir les détails de l'erreur
- Utilisez plutôt l'**Option B** ci-dessous

#### Option B : Servir les fichiers HTML via un serveur HTTP (Recommandé)

**Avec Python (si installé) :**
```bash
# Depuis la racine du projet
python -m http.server 8080
```

Puis ouvrez dans votre navigateur : `http://localhost:8080/formulaire.html`

**Avec Node.js (si installé) :**
```bash
# Installez http-server globalement (une seule fois)
npm install -g http-server

# Puis servez les fichiers
http-server -p 8080
```

Puis ouvrez dans votre navigateur : `http://localhost:8080/formulaire.html`

### Étape 4 : Tester le Flux Complet

1. **Remplissez le formulaire** avec des données de test :
   - Nom : `Marie Dupont`
   - Email : `marie.dupont@email.com`
   - Téléphone : `06 12 34 56 78`
   - Adresse : `45 Avenue des Champs-Élysées, 75008 Paris`
   - Prix : `450 000 €` (optionnel, mais aide à avoir un score élevé)

2. **Soumettez le formulaire** → Vous êtes redirigé vers `merci.html`

3. **Sur la page de remerciement**, vous verrez :
   - Le commentaire IA généré
   - Si le lead est CHAUD (score >= 8) : un créneau proposé avec boutons CONFIRMER/ANNULER
   - Un bouton **"📊 Accéder au Tableau de bord"** qui vous mène au Dashboard

4. **Dans le Dashboard** (`http://localhost:5173/dashboard`) :
   - Le nouveau lead devrait apparaître dans le tableau si son score >= 8
   - Le KPI "Leads Qualifiés Chauds" devrait être mis à jour

## 🔧 Résolution des Problèmes

### Erreur "Failed to fetch"

**Causes possibles :**
1. Le serveur Flask n'est pas lancé
2. Problème CORS (si vous ouvrez directement `formulaire.html` avec `file://`)

**Solutions :**
1. **Vérifiez que Flask est lancé :**
   ```bash
   curl http://localhost:5000/health
   ```
   Doit retourner : `{"status": "healthy", "database": "connected"}`

2. **Utilisez un serveur HTTP** pour servir les fichiers HTML (voir Option B ci-dessus)

3. **Vérifiez la console du navigateur** (F12) pour voir les détails de l'erreur

### Le Dashboard n'affiche pas les nouveaux leads

1. **Vérifiez que le backend est lancé**
2. **Rechargez la page** du Dashboard (F5)
3. **Vérifiez la console du navigateur** (F12) pour les erreurs
4. **Vérifiez que le lead a un score >= 8** (sinon il n'apparaîtra pas dans "leads chauds")

### Le bouton "Accéder au Tableau de bord" ne fonctionne pas

- Vérifiez que le serveur React est lancé (`npm run dev`)
- Vérifiez que le Dashboard est accessible sur `http://localhost:5173/dashboard`

## 📝 Notes Importantes

- **Le backend doit être lancé AVANT** de tester le formulaire
- **Les fichiers HTML** (`formulaire.html`, `merci.html`) peuvent être ouverts directement, mais il est recommandé de les servir via un serveur HTTP pour éviter les problèmes CORS
- **Le Dashboard React** doit être lancé séparément pour voir les leads dans l'interface

## 🔗 URLs Importantes

- **Backend Flask** : `http://localhost:5000`
- **Dashboard React** : `http://localhost:5173/dashboard`
- **Formulaire** : `http://localhost:8080/formulaire.html` (si servi via http-server)
- **Page de remerciement** : `http://localhost:8080/merci.html` (si servi via http-server)

