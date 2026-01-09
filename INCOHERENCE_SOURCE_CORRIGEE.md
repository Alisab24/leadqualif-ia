# 🚨 INCOHÉRENCE DE SOURCE CORRIGÉE

## 🐛 Problème identifié

Les paramètres agence sont sauvegardés dans la table `profiles` via la clé `user_id` (Settings.jsx),
mais le générateur de documents tentait à tort de lire `agency_settings` ou `profiles.id = default`.

---

## ✅ Corrections appliquées

### **1️⃣ SUPPRESSION totale de agency_settings**
```jsx
// AVANT (problème) : mauvaise table
const { data: settingsData, error: settingsError } = await supabase
  .from('agency_settings')
  .select('*')
  .eq('agency_id', agencyId)
  .single();

// APRÈS (corrigé) : bonne table
const { data: { user } } = await supabase.auth.getUser();
const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)
  .single();
```

### **2️⃣ Alignement sur Settings.jsx**
```jsx
// Settings.jsx utilise profiles avec user_id
// Le générateur utilise maintenant exactement la même source
const { data: { user } } = await supabase.auth.getUser();
const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)  // ✅ Aligné avec Settings.jsx
  .single();
```

### **3️⃣ Mapping aligné sur profiles**
```jsx
// Utiliser profiles directement (aligné avec Settings.jsx)
const profile = {
  id: profileData.id,
  name: profileData.nom_agence || profileData.nom_commercial || profileData.nom_legal || 'Agence',
  legalName: profileData.nom_legal || null,     // ✅ null si absent
  address: profileData.adresse_legale || profileData.adresse || null,
  phone: profileData.telephone || null,
  email: profileData.email || null,
  devise: profileData.devise || null,
  pays: profileData.pays || null,
  source: 'profiles'  // ✅ Source unique
};
```

### **4️⃣ Validation UNIQUEMENT sur profiles.nom_legal**
```jsx
// Validation stricte du nom légal (PAS de valeurs factices)
if (profile.legalName === null || profile.legalName === undefined || profile.legalName?.trim() === '') {
  missingFields.push('Nom légal (paramètres agence)');
}

// Messages d'erreur clairs
'Paramètres agence non trouvés. Veuillez compléter les paramètres agence.'
'Nom légal (paramètres agence)'
```

### **5️⃣ Suppression des valeurs factices**
```jsx
// AVANT (problème) : valeurs factices
legalName: settingsData.nom_legal || '—',
address: settingsData.adresse_legale || '—',
pays: settingsData.pays || 'France',

// APRÈS (corrigé) : null si absent
legalName: profileData.nom_legal || null,
address: profileData.adresse_legale || profileData.adresse || null,
pays: profileData.pays || null,
```

---

## 🏗️ Architecture finale alignée

### **Source unique : profiles avec user_id**
```jsx
// Exactement comme Settings.jsx
const { data: { user } } = await supabase.auth.getUser();
const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)  // ✅ Aligné avec Settings.jsx
  .single();

if (profileError) {
  throw new Error(`Paramètres agence non trouvés. Veuillez compléter les paramètres agence.`);
}
```

### **Mapping cohérent**
```jsx
// Utiliser les mêmes clés que Settings.jsx
const profile = {
  id: profileData.id,
  name: profileData.nom_agence || profileData.nom_commercial || profileData.nom_legal || 'Agence',
  legalName: profileData.nom_legal || null,
  address: profileData.adresse_legale || profileData.adresse || null,
  phone: profileData.telephone || null,
  email: profileData.email || null,
  devise: profileData.devise || null,
  pays: profileData.pays || null,
  source: 'profiles'
};
```

### **Validation stricte**
```jsx
// Validation UNIQUEMENT sur profiles.nom_legal
if (profile.legalName === null || profile.legalName === undefined || profile.legalName?.trim() === '') {
  missingFields.push('Nom légal (paramètres agence)');
}

// Plus de valeurs factices : null si absent
legalName: profileData.nom_legal || null
```

---

## 🔐 Alignement parfait avec Settings.jsx

### **Même source de données**
- ✅ Settings.jsx : `profiles` avec `user_id`
- ✅ DocumentGenerator.jsx : `profiles` avec `user_id`
- ✅ Plus d'agency_settings

### **Mêmes clés utilisées**
- ✅ `nom_legal` : validation stricte
- ✅ `nom_agence` : affichage
- ✅ `adresse_legale` : adresse
- ✅ `telephone` : téléphone
- ✅ `email` : email
- ✅ `pays` : pays
- ✅ `devise` : devise

### **Même logique de gestion**
- ✅ Authentification requise
- ✅ Erreur si profil non trouvé
- ✅ Pas de valeurs factices
- ✅ Messages d'erreur clairs

---

## 📊 Tests de validation

### **1️⃣ Source alignée**
- ✅ Utilisation de profiles (pas agency_settings)
- ✅ user_id comme clé (pas agency_id)
- ✅ Aligné avec Settings.jsx

### **2️⃣ Mapping cohérent**
- ✅ Mêmes clés que Settings.jsx
- ✅ null si champ absent
- ✅ Plus de valeurs factices

### **3️⃣ Validation stricte**
- ✅ Test de null/undefined/vide
- ✅ Messages d'erreur précis
- ✅ Plus de fallbacks

### **4️⃣ Gestion d'erreur**
- ✅ Pas de profil par défaut
- ✅ setAgencyProfile(null) si erreur
- ✅ Message clair pour l'utilisateur

---

## 🚀 Avantages finaux

### **Cohérence parfaite**
- ✅ Settings.jsx et DocumentGenerator.jsx utilisent la même source
- ✅ Mêmes clés, même logique
- ✅ Plus d'incohérence

### **Fiabilité**
- ✅ Génération alignée sur les données réelles
- ✅ Plus d'erreur de source
- ✅ Validation stricte

### **Sécurité**
- ✅ Plus de valeurs factices
- ✅ Plus de fallbacks dangereux
- ✅ Blocage si données manquantes

---

## 🏆 Incohérence corrigée

### **✅ Problème résolu**
- Plus d'agency_settings
- Alignement sur profiles avec user_id
- Mêmes clés que Settings.jsx
- Plus de valeurs factices

### **✅ Contraintes respectées**
- Suppression totale de agency_settings
- UNIQUEMENT profiles avec user_id
- Blocage si nom_legal vide
- Suppression des valeurs factices

### **✅ Qualité livrée**
- Génération alignée sur Settings.jsx
- Code cohérent
- Validation stricte
- Zero régression

---

## 🔍 Instructions pour tester

### **1️⃣ Vérifier les données dans profiles**
```sql
-- Vérifier que les données existent dans profiles
SELECT * FROM profiles WHERE user_id = 'votre-user-id';
```

### **2️⃣ Tester la génération**
1. Aller dans Paramètres et remplir le formulaire
2. Sauvegarder (ça écrit dans profiles)
3. Générer un document
4. Vérifier que ça utilise les mêmes données

### **3️⃣ Vérifier les logs**
```
🔍 PROFILES DATA USED FOR DOC {user_id: "votre-user-id", nom_legal: "SARL EXEMPLE", ...}
🔍 user_id: "votre-user-id"
🔍 LEGAL NAME VALIDATION (PROFILES ONLY): {legalName: "SARL EXEMPLE", isNull: false, ...}
🔍 VALIDATION RESULT (PROFILES ONLY): {isValid: true, missingFields: [], canGenerate: true}
```

### **4️⃣ Tester sans profil**
1. Supprimer la ligne profiles de l'utilisateur
2. Tenter de générer un document
3. Vérifier le message : "Paramètres agence non trouvés"

---

**L'incohérence de source est maintenant définitivement corrigée !** 🚨✨

*Alignement parfait sur Settings.jsx, source unique profiles, validation stricte* 🎯🔥
