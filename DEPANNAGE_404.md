# 🚨 Dépannage - Erreur 404 Dashboard/Formulaire

## ❌ Problème identifié
Le dashboard affiche une erreur 404 quand on clique sur "Ouvrir Formulaire"

## ✅ Solution immédiate

### 1. Corriger le lien dans le Dashboard (Déjà fait ✅)
- Fichier : `src/pages/Dashboard.jsx`
- Ligne 180 : `href="/formulaire.html"` (corrigé)

### 2. Configurer Supabase (Obligatoire)
Le formulaire ne fonctionne pas sans une vraie configuration Supabase :

**Étape A : Créer le fichier `.env.local`**
```bash
# Copiez le fichier d'exemple
cp .env.example .env.local
```

**Étape B : Remplir `.env.local` avec vos vraies clés**
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-ici
```

**Étape C : Mettre à jour le formulaire HTML**
Ouvrez `public/formulaire.html` et remplacez les lignes 135-136 :
```javascript
const SUPABASE_URL = 'https://votre-projet.supabase.co';
const SUPABASE_ANON_KEY = 'votre-cle-anon';
```

### 3. Démarrer le serveur de développement
```bash
npm run dev
```

## 🔧 Tests à effectuer

### Test 1 : Accès direct au formulaire
- URL : http://localhost:5173/formulaire.html
- ✅ Devrait afficher le formulaire sans erreur 404

### Test 2 : Lien depuis le dashboard
- Allez sur http://localhost:5173
- Cliquez sur "Ouvrir Formulaire"
- ✅ Devrait ouvrir le formulaire dans un nouvel onglet

### Test 3 : Soumission du formulaire
- Remplissez le formulaire
- Cliquez sur "Obtenir mon analyse IA"
- ✅ Devrait afficher "Votre demande a été sauvegardée avec succès !"

## 🚨 Si l'erreur persiste

### Vérifiez la structure des fichiers :
```
public/
├── formulaire.html  ✅
└── merci.html      ✅

src/
├── lib/
│   └── supabase.js ✅
└── pages/
    └── Dashboard.jsx ✅
```

### Vérifiez les logs du navigateur :
- Ouvrez les outils de développement (F12)
- Regardez l'onglet "Console"
- Cherchez les erreurs 404 ou Supabase

## 📞 Support rapide
1. **Erreur 404** = Problème de lien (déjà corrigé)
2. **Erreur Supabase** = Clés API manquantes
3. **Formulaire ne soumet pas** = Configuration Supabase incorrecte

---
**Le lien du dashboard est maintenant corrigé. Il ne reste plus qu'à configurer Supabase !**
