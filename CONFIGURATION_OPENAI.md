# Configuration OpenAI - Instructions

## 🚨 Problème résolu : "OpenAI non disponible"

Le système utilise maintenant une architecture sécurisée :

### ✅ NOUVEAU SYSTÈME (SÉCURISÉ)
- **Développement local** : `VITE_OPENAI_API_KEY` dans `.env.local`
- **Production Vercel** : `OPENAI_API_KEY` dans Vercel Dashboard
- **Appels** : Via `/api/qualify` (serverless) - jamais côté client

### ❌ ANCIEN SYSTÈME (SUPPRIMÉ)
- Fichier `src/src/api/qualifyLead.js` supprimé
- Plus d'appels OpenAI directs côté navigateur

## 🛠️ Pour configurer OpenAI :

### 1. Développement local
Créez un fichier `.env.local` (déjà dans .gitignore) :
```env
VITE_OPENAI_API_KEY=sk-votre-clé-ici
```

### 2. Production Vercel
Allez dans Vercel Dashboard > Settings > Environment Variables :
- Nom : `OPENAI_API_KEY`
- Valeur : `sk-votre-clé-ici`

### 3. Redémarrez le serveur
```bash
npm run dev
```

## ✅ Vérification
L'IA devrait maintenant fonctionner avec :
- Qualification automatique des leads
- Classification chaud/tiède/froid
- Recommandations personnalisées

## 🔧 Si problème persiste :
1. Vérifiez que votre clé commence par `sk-`
2. Assurez-vous d'avoir des crédits sur votre compte OpenAI
3. Redémarrez complètement le serveur de développement
