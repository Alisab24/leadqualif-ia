# 🚀 **INSTALLATION COMPLÈTE NUMÉROTATION DOCUMENTS**

## 📋 **ÉTAT ACTUEL**

✅ **Frontend déjà corrigé :**
- `DocumentCounterService.js` : Appel RPC sécurisé
- `InvoiceQuoteDocument.jsx` : Logique d'enregistrement complète
- Bouton "Enregistrer" avec génération de numéro
- Suppression bouton "Télécharger"

❌ **Backend manquant :**
- Fonction PostgreSQL `generate_document_number` non créée

---

## 🔧 **INSTALLATION ÉTAPE PAR ÉTAPE**

### **1️⃣ CRÉER LA FONCTION POSTGRESQL**

#### **Option A : Via Supabase Dashboard**
1. Aller sur [supabase.com](https://supabase.com)
2. Choisir votre projet
3. Aller dans **SQL Editor**
4. Copier-coller le contenu de `setup_document_numbering.sql`
5. Cliquer sur **Run**

#### **Option B : Via CLI (si installée)**
```bash
supabase db push
```

### **2️⃣ VÉRIFIER L'INSTALLATION**

#### **Tester la fonction RPC**
```sql
-- Dans Supabase SQL Editor
SELECT generate_document_number(
  'votre-user-id-uuid', 
  'facture', 
  2026
);
```

**Résultat attendu :** `FAC-2026-000001`

#### **Vérifier les permissions**
```sql
-- Confirmer que les utilisateurs peuvent exécuter la fonction
SELECT 
  routine_name, 
  privilege_type, 
  grantee
FROM information_schema.role_routine_grants 
WHERE routine_name = 'generate_document_number';
```

### **3️⃣ TESTER L'APPLICATION**

#### **Démarrer l'application**
```bash
npm run dev
```

#### **Tester le flux complet**
1. Créer un devis/facture
2. Cliquer sur "Enregistrer"
3. Vérifier que le numéro s'affiche
4. Tester l'impression (nom de fichier correct)

---

## 🧪 **TEST DE VALIDATION**

### **Test 1 : Génération de numéro**
```javascript
// Dans la console du navigateur
import { DocumentCounterService } from './src/services/documentCounterService.js';

// Tester avec un user ID fictif
DocumentCounterService.generateDocumentNumber('facture', 'user-test-uuid')
  .then(result => console.log('Numéro généré:', result))
  .catch(error => console.error('Erreur:', error));
```

### **Test 2 : Vérification base de données**
```sql
-- Vérifier que les compteurs sont créés
SELECT * FROM document_counters ORDER BY created_at DESC;

-- Vérifier les documents avec numéros
SELECT id, document_number, created_at FROM documents 
WHERE document_number IS NOT NULL 
ORDER BY created_at DESC;
```

---

## 🔍 **DÉBOGAGE SI PROBLÈME**

### **Erreur "Function not found"**
```sql
-- Vérifier si la fonction existe
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'generate_document_number';
```

### **Erreur "Permission denied"**
```sql
-- Donner les permissions manuellement
GRANT EXECUTE ON FUNCTION generate_document_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_document_number TO service_role;
```

### **Erreur RPC côté frontend**
```javascript
// Ajouter des logs détaillés dans handleSaveDocument
console.log('🔢 Appel RPC avec params:', {
  user_id: agencyProfile?.user_id,
  type: type,
  year: new Date().getFullYear()
});
```

---

## 📝 **RÉCAPITULATIF DES FICHIERS**

### **Fichiers créés/modifiés**
```
✅ src/services/documentCounterService.js          (déjà corrigé)
✅ src/pages/InvoiceQuoteDocument.jsx           (déjà corrigé)
✅ setup_document_numbering.sql                  (à exécuter)
```

### **Fonctionnalités implémentées**
- ✅ Génération numéro unique à l'enregistrement
- ✅ Format TYPE-ANNEE-000XXX
- ✅ Transactionnel (pas de doublons)
- ✅ Montant en lettres
- ✅ Nom de fichier PDF correct
- ✅ Boutons intelligents (Enregistrer/Imprimer)

---

## 🚀 **DÉPLOIEMENT**

### **1. Appliquer le SQL**
```bash
# Copier le contenu de setup_document_numbering.sql
# Le coller dans Supabase SQL Editor
# Cliquer sur "Run"
```

### **2. Redémarrer l'application**
```bash
npm run dev
```

### **3. Tester**
1. Créer un document
2. Cliquer "Enregistrer"
3. Vérifier le numéro généré
4. Tester l'impression

---

## 🎯 **RÉSULTAT FINAL**

Une fois l'installation terminée :
- ✅ Plus d'erreur "Impossible de lire le compteur"
- ✅ Numérotation automatique et unique
- ✅ Documents professionnels
- ✅ Flux utilisateur complet

**Le module sera 100% fonctionnel !** 🎉
