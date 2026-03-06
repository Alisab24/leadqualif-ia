# 🚀 Déploiement de LeadQualif IA

## 🔧 Configuration Requise

L'application nécessite la configuration des variables d'environnement Supabase pour fonctionner correctement.

### Variables d'Environnement Obligatoires

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-ici
```

## 📋 Instructions de Déploiement

### 1. Configuration Locale (Développement)

1. Copiez le fichier d'exemple :
```bash
cp .env.example .env.local
```

2. Remplissez avec vos vraies valeurs Supabase :
- Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
- Sélectionnez votre projet
- Allez dans Settings > API
- Copiez l'URL et la clé anon

3. Redémarrez le serveur :
```bash
npm run dev
```

### 2. Déploiement Vercel (Production)

1. Allez dans votre projet Vercel
2. Cliquez sur "Settings" > "Environment Variables"
3. Ajoutez les variables suivantes :

| Nom | Valeur |
|------|--------|
| `VITE_SUPABASE_URL` | URL de votre projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anon de votre projet Supabase |

4. Redéployez l'application :
```bash
vercel --prod
```

## 🐛 Dépannage

### Écran Blanc / Page de Configuration

Si vous voyez la page "Configuration Requise" au lieu de l'application :

1. **Vérifiez les variables** : Assurez-vous que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont correctement configurées
2. **Redéployez** : Après avoir ajouté les variables, redéployez l'application
3. **Cache** : Videz le cache de votre navigateur si nécessaire

### Erreurs Console

Ouvrez la console du navigateur (F12) et cherchez :
- `❌ ERREUR CRITIQUE: Variables Supabase manquantes!`
- Messages d'erreur réseau

### Test Local

Pour tester si les variables sont bien chargées localement :
```javascript
// Dans la console du navigateur
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
```

## 🔄 Workflow de Déploiement

1. **Développement** : Test local avec `.env.local`
2. **Build** : `npm run build`
3. **Déploiement** : Push vers Git → Auto-déploiement Vercel
4. **Vérification** : Test des variables en production

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs de la console
2. Consultez la page de configuration intégrée
3. Contactez l'administrateur avec les détails de l'erreur

---

**Important** : Ne jamais committer les vraies clés API dans Git ! Utilisez toujours les variables d'environnement.
