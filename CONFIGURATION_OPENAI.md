# 🤖 Configuration API OpenAI - Générateur d'Annonces

## ✅ Modifications implémentées

### Backend (backend/app.py)
- ✅ Import de la librairie `openai`
- ✅ Configuration de la clé API depuis `OPENAI_API_KEY`
- ✅ Nouvelle route `POST /api/generate-annonce`
- ✅ Utilisation du modèle `gpt-3.5-turbo`
- ✅ Gestion des erreurs OpenAI

### Frontend (src/pages/Dashboard.jsx)
- ✅ Remplacement de la simulation par appel API réel
- ✅ Appel `POST` vers `${API_BACKEND_URL}/generate-annonce`
- ✅ Gestion des états de chargement et d'erreur
- ✅ Affichage du résultat de l'IA

## 🔧 Configuration requise

### 1. Installer la dépendance OpenAI
```bash
cd backend
pip install openai
```

### 2. Configurer la clé API OpenAI
**Option A : Variables d'environnement (Recommandé)**
```bash
export OPENAI_API_KEY="votre-cle-api-openai-ici"
```

**Option B : Dans Render Dashboard**
- Allez dans votre service Render
- Environment → Add Environment Variable
- `OPENAI_API_KEY` = `sk-...`

### 3. Mettre à jour le frontend (si nécessaire)
Dans `.env.local` :
```env
VITE_API_BACKEND_URL=https://votre-backend.onrender.com/api
```

## 📝 Utilisation

### Dans le Dashboard :
1. Remplissez les champs du générateur d'annonces
2. Cliquez sur "Générer Annonce"
3. L'IA OpenAI crée une annonce professionnelle
4. Le texte s'affiche avec le temps économisé

### Exemple de sortie :
```
🏠 ✨ Exceptionnel Appartement en Centre-Ville ✨ 📍

Découvrez cette perle rare de 85m² avec 3 pièces lumineuses, idéalement située au cœur de la ville. 

🌟 Points forts :
- Cuisine entièrement équipée ouverte sur salon
- Deux chambres spacieuses avec rangements intégrés
- Balcon terrasse avec vue dégagée
- Proximité immédiate commerces et transports

💰 Prix : 320 000€
📞 Contactez-nous vite pour visiter !
```

## 🚨 Dépannage

### Erreur "Clé API OpenAI non configurée"
- Ajoutez `OPENAI_API_KEY` dans les variables d'environnement

### Erreur "Invalid API key"
- Vérifiez que votre clé commence par `sk-`
- Assurez-vous que la clé est active et a des crédits

### Erreur de connexion
- Vérifiez que `VITE_API_BACKEND_URL` est correct
- Assurez-vous que le backend est déployé et accessible

## 🎯 Avantages

- ⚡ **Génération instantanée** avec OpenAI
- 🎨 **Annonces professionnelles** et attractives
- 💰 **Suivi du temps économisé**
- 🔄 **Intégration transparente** dans le dashboard

---
**Le générateur d'annonces est maintenant alimenté par la vraie IA OpenAI !**
