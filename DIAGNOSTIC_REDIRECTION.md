# 🔧 DIAGNOSTIC - Problème de redirection vers login/home

## 🚨 Symptôme
Lors de la génération d'un document (devis ou facture), l'utilisateur est redirigé vers la page login/home au lieu d'arriver sur la page du document.

---

## 🔍 Causes possibles identifiées

### **1️⃣ Routes non protégées (CORRIGÉ ✅)**
```jsx
// AVANT (problème)
<Route path="/documents/:type(devis|facture)/:id" element={<InvoiceQuoteDocument />} />

// APRÈS (corrigé)
<Route element={<PrivateRoute />}>
  <Route path="/documents/preview/:id" element={<DocumentPreviewPage />} />
  <Route path="/documents/:type(devis|facture)/:id" element={<InvoiceQuoteDocument />} />
</Route>
```

### **2️⃣ Données non sauvegardées dans localStorage**
```javascript
// Vérification ajoutée dans DocumentGenerator.jsx
console.log('Sauvegarde du document avec ID:', documentId);
console.log('Données à sauvegarder:', documentToSave);

localStorage.setItem(`document_${documentId}`, JSON.stringify(documentToSave));

// Vérification immédiate
const savedData = localStorage.getItem(`document_${documentId}`);
console.log('Vérification sauvegarde:', savedData ? 'OK' : 'ÉCHEC');
```

### **3️⃣ Données non trouvées au chargement**
```javascript
// Vérification ajoutée dans InvoiceQuoteDocument.jsx
console.log('Tentative de chargement du document:', id);
console.log('Clé localStorage:', `document_${id}`);

const storedData = localStorage.getItem(`document_${id}`);
console.log('Données trouvées dans localStorage:', storedData ? 'OUI' : 'NON');

if (!storedData) {
  console.warn('Aucune donnée trouvée dans localStorage pour:', id);
  console.log('Contenu actuel de localStorage:', Object.keys(localStorage));
  alert('Document non trouvé. Veuillez générer un nouveau document.');
  navigate('/dashboard');
}
```

---

## 🛠️ Actions de diagnostic

### **Étape 1 : Ouvrir la console du navigateur**
1. **Ouvrir les outils de développement** (F12)
2. **Aller dans l'onglet Console**
3. **Générer un document** (devis ou facture)
4. **Observer les logs**

### **Étape 2 : Vérifier les logs de sauvegarde**
```bash
# Logs attendus dans DocumentGenerator.jsx
Sauvegarde du document avec ID: doc_1704789123456
Données à sauvegarder: {document: {...}, agencyProfile: {...}, lead: {...}}
Vérification sauvegarde: OK
Redirection vers: /documents/devis/doc_1704789123456
```

### **Étape 3 : Vérifier les logs de chargement**
```bash
# Logs attendus dans InvoiceQuoteDocument.jsx
Tentative de chargement du document: doc_1704789123456
Clé localStorage: document_doc_1704789123456
Données trouvées dans localStorage: OUI
Données parsées: {document: {...}, agencyProfile: {...}, lead: {...}}
Document chargé avec succès
```

---

## 🚨 Problèmes possibles et solutions

### **Problème A : Session expirée**
```bash
# Symptôme
PrivateRoute redirige vers "/" car !session

# Solution
1. Se reconnecter à l'application
2. Vérifier que la session est active
3. Regénérer le document
```

### **Problème B : localStorage plein ou inaccessible**
```bash
# Symptôme
Vérification sauvegarde: ÉCHEC
Données trouvées dans localStorage: NON

# Solutions
1. Vider le cache du navigateur
2. Vérifier l'espace disponible dans localStorage
3. Désactiver les extensions qui bloquent localStorage
```

### **Problème C : Erreur de parsing JSON**
```bash
# Symptôme
Erreur lors du chargement du document: Unexpected token

# Solutions
1. Vérifier que les données sont sérialisables
2. Éviter les objets circulaires
3. Utiliser JSON.stringify() avec try/catch
```

### **Problème D : Route incorrecte**
```bash
# Symptôme
Redirection vers: /documents/devis/doc_1704789123456
Mais erreur 404

# Solutions
1. Vérifier que la route est bien définie dans App.jsx
2. Vérifier la syntaxe des paramètres de route
3. Redémarrer le serveur de développement
```

---

## 🔧 Corrections apportées

### **✅ 1. Protection des routes**
```jsx
// App.jsx - Routes maintenant protégées
<Route element={<PrivateRoute />}>
  <Route path="/documents/preview/:id" element={<DocumentPreviewPage />} />
  <Route path="/documents/:type(devis|facture)/:id" element={<InvoiceQuoteDocument />} />
</Route>
```

### **✅ 2. Logs de diagnostic**
```jsx
// DocumentGenerator.jsx - Logs de sauvegarde
console.log('Sauvegarde du document avec ID:', documentId);
console.log('Données à sauvegarder:', documentToSave);
console.log('Vérification sauvegarde:', savedData ? 'OK' : 'ÉCHEC');
console.log('Redirection vers:', redirectUrl);
```

### **✅ 3. Logs de chargement**
```jsx
// InvoiceQuoteDocument.jsx - Logs de chargement
console.log('Tentative de chargement du document:', id);
console.log('Clé localStorage:', `document_${id}`);
console.log('Données trouvées dans localStorage:', storedData ? 'OUI' : 'NON');
console.log('Contenu actuel de localStorage:', Object.keys(localStorage));
```

### **✅ 4. Messages d'erreur utilisateur**
```jsx
// Alertes explicatives pour l'utilisateur
alert('Document non trouvé. Veuillez générer un nouveau document.');
alert('Erreur lors du chargement du document. Veuillez réessayer.');
```

---

## 🧪 Test étape par étape

### **Étape 1 : Vérifier l'authentification**
1. **Se connecter** à l'application
2. **Vérifier** que la session est active (dashboard accessible)
3. **Générer** un document

### **Étape 2 : Suivre les logs**
1. **Ouvrir la console** (F12)
2. **Générer un devis**
3. **Observer** les logs de sauvegarde
4. **Vérifier** la redirection dans l'URL

### **Étape 3 : Vérifier localStorage**
1. **Dans la console**, exécuter :
   ```javascript
   console.log('Clés localStorage:', Object.keys(localStorage));
   ```
2. **Chercher** les clés `document_doc_XXXXX`
3. **Vérifier** que les données sont présentes

### **Étape 4 : Test de navigation directe**
1. **Copier** l'URL générée dans les logs
2. **Coller** directement dans la barre d'adresse
3. **Vérifier** que la page s'affiche correctement

---

## 🚀 Solution si problème persiste

### **Option 1 : Recharger l'application**
```bash
# 1. Arrêter le serveur de développement
npm run dev

# 2. Vider le cache du navigateur
# 3. Redémarrer le serveur
npm run dev
```

### **Option 2 : Réinitialiser localStorage**
```javascript
// Dans la console du navigateur
localStorage.clear();
location.reload();
```

### **Option 3 : Vérifier la configuration**
```bash
# 1. Vérifier que le port est correct
# 2. Vérifier qu'il n'y a pas de conflit de routes
# 3. Vérifier que PrivateRoute fonctionne correctement
```

---

## 📞 Support technique

Si le problème persiste après ces vérifications :

1. **Faire une capture d'écran** des logs de la console
2. **Noter l'URL exacte** de redirection
3. **Vérifier la version** du navigateur
4. **Tester dans un autre navigateur** (Chrome/Firefox)

---

## 🎯 Résultat attendu

Une fois le problème résolu :

- **Génération** → Sauvegarde OK → Redirection vers page document
- **Chargement** → Données trouvées → Affichage du document
- **Pas de redirection** vers login/home
- **Logs propres** dans la console

---

**Le diagnostic est maintenant activé et les corrections sont en place !** 🔧✨

*Logs détaillés, routes protégées, messages utilisateur* 🚀🔍
