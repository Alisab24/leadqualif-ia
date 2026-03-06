# 🏗️ ARCHITECTURE MODULE DOCUMENTS - PLAN DE FINALISATION

## 📋 **ANALYSE DE L'ÉTAT ACTUEL**

### ✅ **Ce qui fonctionne déjà**
- **Service de numérotation** : `DocumentCounterService` complet et fonctionnel
- **Conversion en lettres** : Implémentée avec support EUR/FCFA
- **Génération PDF** : Fonctionnelle via `react-to-print`
- **Logo agence** : Déjà intégré depuis `agencyProfile.logo_url`
- **Structure des pages** : InvoiceQuoteDocument.jsx bien architecturé

### ❌ **Problèmes identifiés**
1. **Numérotation temporaire** : `getDocumentNumber()` utilise `Date.now()` au lieu du service
2. **Bouton Télécharger** : Non fonctionnel (simule `window.print()`)
3. **Nom de fichier** : Non personnalisé avec numéro de document
4. **Couleur principale** : Non utilisée dans les documents
5. **Enregistrement** : Logique manquante pour sauvegarder en base

---

## 🎯 **PLAN DE FINALISATION PROFESSIONNELLE**

### **1️⃣ LOGIQUE MÉTIER CLAIRE**

#### **Flux de création de document**
```
1️⃣ Préparation → Aperçu (sans numéro)
   ↓
2️⃣ Validation → Enregistrement (génère numéro)
   ↓
3️⃣ Affichage final (avec numéro)
   ↓
4️⃣ Impression/Téléchargement (avec numéro)
```

#### **Cycle de vie du numéro**
- **Aperçu** : `Aperçu - ${type}` (pas de numéro)
- **Enregistrement** : Génère `TYPE-ANNEE-000XXX`
- **Affichage** : Affiche le numéro généré
- **Fichier PDF** : `Facture_FAC-2026-000123.pdf`

---

## 🔧 **POINTS PRÉCIS À MODIFIER**

### **A. CÔTÉ FRONTEND**

#### **1. Supprimer bouton Télécharger**
```javascript
// ❌ À SUPPRIMER dans InvoiceQuoteDocument.jsx (lignes 786-797)
<button onClick={() => window.print();}>
  <span>Télécharger PDF</span>
</button>
```

#### **2. Corriger la numérotation**
```javascript
// ❌ ACTUEL (ligne 394-397)
const getDocumentNumber = () => {
  const prefix = type === 'devis' ? 'DEV' : 'FAC';
  return `${prefix}-${Date.now().toString().slice(-6)}`;
};

// ✅ NOUVEAU
const getDocumentNumber = () => {
  return document?.document_number || `${type === 'devis' ? 'DEVIS' : 'FACTURE'} (Aperçu)`;
};
```

#### **3. Ajouter fonction d'enregistrement**
```javascript
const handleSaveDocument = async () => {
  try {
    // 1. Générer numéro unique
    const documentNumber = await DocumentCounterService.generateDocumentNumber(
      type === 'devis' ? 'devis' : 'facture', 
      agencyProfile.user_id
    );
    
    // 2. Mettre à jour le document
    const updatedDocument = {
      ...document,
      document_number: documentNumber.formatted,
      document_type: type,
      created_at: new Date().toISOString(),
      status: 'saved'
    };
    
    // 3. Sauvegarder en base
    const { error } = await supabase
      .from('documents')
      .insert(updatedDocument);
    
    if (error) throw error;
    
    // 4. Mettre à jour l'état local
    setDocument(updatedDocument);
    
    // 5. Nettoyer localStorage
    localStorage.removeItem(`document_${id}`);
    
    console.log('✅ Document enregistré:', documentNumber.formatted);
    
  } catch (error) {
    console.error('❌ Erreur enregistrement:', error);
    alert('Erreur lors de l\'enregistrement du document');
  }
};
```

#### **4. Ajouter bouton Enregistrer**
```javascript
// ✅ À AJOUTER après le bouton Imprimer
{!document?.document_number && (
  <button
    onClick={handleSaveDocument}
    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
    </svg>
    <span>Enregistrer</span>
  </button>
)}
```

#### **5. Améliorer l'impression avec nom de fichier**
```javascript
const handlePrint = useReactToPrint({
  content: () => componentRef.current,
  documentTitle: DocumentCounterService.generatePdfFileName(
    document?.document_number || 'Aperçu',
    agencyProfile?.name || 'Agence',
    type
  ),
  onBeforeGetContent: () => {
    setIsPrinting(true);
  },
  onAfterPrint: () => {
    setIsPrinting(false);
  }
});
```

#### **6. Intégrer la couleur principale**
```javascript
// ✅ DANS LE STYLE DU HEADER
const headerStyle = {
  borderBottom: `3px solid ${agencyProfile?.primary_color || '#2563eb'}`
};

// ✅ DANS LES ÉLÉMENTS IMPORTANTS
const accentStyle = {
  color: agencyProfile?.primary_color || '#2563eb'
};
```

#### **7. Afficher le montant en lettres**
```javascript
// ✅ AJOUTER APRÈS LE TOTAL
{document?.show_amount_in_words && (
  <div className="amount-in-words">
    <p className="text-sm text-gray-600 italic">
      {DocumentCounterService.formatAmountInWords(
        document.total_amount,
        document.currency || 'EUR',
        true
      )}
    </p>
  </div>
)}
```

---

### **B. CÔTÉ BASE DE DONNÉES**

#### **1. Table `documents` (à créer/mettre à jour)**
```sql
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Informations document
  document_number VARCHAR(50) UNIQUE, -- FAC-2026-000123
  document_type VARCHAR(20) NOT NULL, -- 'facture', 'devis'
  title VARCHAR(200),
  
  -- Données client
  client_name VARCHAR(200),
  client_email VARCHAR(200),
  client_phone VARCHAR(50),
  client_address TEXT,
  
  -- Données financières
  total_amount DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'EUR',
  tax_rate DECIMAL(5,2) DEFAULT 20.0,
  amount_in_words TEXT,
  show_amount_in_words BOOLEAN DEFAULT true,
  
  -- Contenu JSON
  items JSONB, -- [{description, quantity, unit_price, total}]
  notes TEXT,
  payment_terms TEXT,
  
  -- Métadonnées
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'saved', 'sent', 'paid'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Fichier PDF
  pdf_url TEXT,
  pdf_filename VARCHAR(500)
);

-- Index pour performances
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_number ON documents(document_number);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_status ON documents(status);
```

#### **2. Table `document_counters` (déjà existante)**
```sql
-- Vérifier que la structure est correcte
CREATE TABLE document_counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'facture', 'devis'
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(user_id, type, year)
);
```

---

## 🎨 **POINTS D'IDENTITÉ VISUELLE**

### **1. Logo dynamique**
```javascript
// ✅ DÉJÀ IMPLÉMENTÉ - À VÉRIFIER
{agencyProfile?.logo_url && (
  <div className="agency-logo">
    <img 
      src={agencyProfile.logo_url} 
      alt="Logo agence" 
      style={{ maxHeight: '80px' }}
    />
  </div>
)}
```

### **2. Couleur principale**
```javascript
// ✅ À AJOUTER DANS LES STYLES
const DocumentHeader = () => (
  <div 
    className="document-header"
    style={{
      borderBottom: `3px solid ${agencyProfile?.primary_color || '#2563eb'}`
    }}
  >
    {/* Contenu */}
  </div>
);

// ✅ POUR LES TITRES
<h1 style={{ 
  color: agencyProfile?.primary_color || '#2563eb' 
}}>
  {type === 'devis' ? 'DEVIS' : 'FACTURE'}
</h1>
```

### **3. Nom du fichier PDF**
```javascript
// ✅ DÉJÀ DANS LE SERVICE - À UTILISER
DocumentCounterService.generatePdfFileName(
  documentNumber,      // FAC-2026-000123
  agencyName,         // "Nexap Immobilier"
  documentType        // 'facture'
);
// Résultat : "FAC-2026-000123-NEXAP-IMMOBILIER.pdf"
```

---

## 🔄 **LOGIQUE COMMUNE POUR AUTRES DOCUMENTS**

### **1. Service unifié**
```javascript
// ✅ DÉJÀ EXISTANT - DocumentCounterService
export class DocumentCounterService {
  // Génère numéro pour n'importe quel type
  static async generateDocumentNumber(type, userId) {
    // Supporte : facture, devis, avoir, bon, etc.
  }
  
  // Génère nom de fichier pour n'importe quel type
  static generatePdfFileName(number, agency, type) {
    const prefixes = {
      facture: 'FAC',
      devis: 'DEV',
      avoir: 'AVO',
      bon: 'BON',
      contrat: 'CTR'
    };
  }
}
```

### **2. Composant réutilisable**
```javascript
// ✅ À CRÉER : DocumentTemplate.jsx
const DocumentTemplate = ({ 
  type, 
  document, 
  agencyProfile, 
  onPrint, 
  onSave 
}) => {
  // Logique commune pour tous les documents
  return (
    <div className="document-template">
      <DocumentHeader agencyProfile={agencyProfile} />
      <DocumentContent type={type} document={document} />
      <DocumentFooter agencyProfile={agencyProfile} />
    </div>
  );
};
```

---

## 📋 **RÉCAPITULATIF DES MODIFICATIONS**

### **Frontend (InvoiceQuoteDocument.jsx)**
- ❌ Supprimer bouton "Télécharger"
- ✅ Corriger `getDocumentNumber()` pour utiliser le service
- ✅ Ajouter `handleSaveDocument()` avec génération de numéro
- ✅ Ajouter bouton "Enregistrer" (conditionnel)
- ✅ Améliorer `handlePrint` avec nom de fichier personnalisé
- ✅ Intégrer couleur principale dans les styles
- ✅ Afficher montant en lettres

### **Base de données**
- ✅ Créer/mettre à jour table `documents`
- ✅ Vérifier table `document_counters`
- ✅ Ajouter index pour performances

### **Services**
- ✅ Utiliser `DocumentCounterService` (déjà existant)
- ✅ Utiliser `generatePdfFileName()` (déjà existant)
- ✅ Utiliser `formatAmountInWords()` (déjà existant)

---

## 🎯 **LIVRABLES FINAUX**

### **1. Logique métier**
- Numérotation unique et incrémentale
- Génération uniquement à l'enregistrement
- Format TYPE-ANNEE-000XXX

### **2. Fonctionnalités**
- Enregistrer (génère numéro)
- Imprimer (utilise numéro)
- Plus de Télécharger

### **3. Identité visuelle**
- Logo depuis Paramètres
- Couleur principale depuis Paramètres
- Nom de fichier personnalisé

### **4. Extensibilité**
- Service commun pour tous types de documents
- Structure base de données évolutive
- Composants réutilisables

---

**Ce plan garantit un module Documents professionnel, conforme et évolutif !** 🏗️✨
