# 📄 Design Facture Professionnelle IMMO/SMMA

## 🎯 Objectif
Créer une facture crédible et professionnelle pour les agences IMMO et SMMA avec un design type Stripe.

---

## ✅ Contenu Obligatoire Implémenté

### **🏢 Entête Professionnelle**

#### **Logo agence**
```jsx
{agencyProfile?.logo_url && (
  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
    <img 
      src={agencyProfile.logo_url} 
      alt="Logo agence" 
      className="max-w-full max-h-full object-contain rounded"
    />
  </div>
)}
```

#### **Nom agence**
```jsx
<h1 className="text-2xl font-bold text-gray-900 mb-2">
  {agencyProfile?.name || 'Agence'}
</h1>
```

#### **Adresse complète**
```jsx
<div className="text-sm text-gray-600 space-y-1">
  {agencyProfile?.address && <p>{agencyProfile.address}</p>}
  {agencyProfile?.email && <p>{agencyProfile.email}</p>}
  {agencyProfile?.phone && <p>{agencyProfile.phone}</p>}
  {agencyProfile?.registrationNumber && (
    <p className="text-xs text-gray-500">{agencyProfile.registrationNumber}</p>
  )}
</div>
```

### **👤 Bloc Client Structuré**

#### **Grid 2 colonnes**
```jsx
<div className="grid grid-cols-2 gap-8">
  <div className="space-y-2">
    <div className="flex">
      <span className="text-sm font-semibold text-gray-700 w-20">Nom:</span>
      <span className="text-sm text-gray-900">{lead?.nom || 'Non spécifié'}</span>
    </div>
    <div className="flex">
      <span className="text-sm font-semibold text-gray-700 w-20">Email:</span>
      <span className="text-sm text-gray-900">{lead.email}</span>
    </div>
    <div className="flex">
      <span className="text-sm font-semibold text-gray-700 w-20">Tél:</span>
      <span className="text-sm text-gray-900">{lead.telephone}</span>
    </div>
  </div>
  <div className="space-y-2">
    <div className="flex">
      <span className="text-sm font-semibold text-gray-700 w-20">Budget:</span>
      <span className="text-sm text-gray-900">{formatAmount(lead.budget)}</span>
    </div>
    <div className="flex">
      <span className="text-sm font-semibold text-gray-700 w-20">Projet:</span>
      <span className="text-sm text-gray-900">{lead.type_bien}</span>
    </div>
  </div>
</div>
```

### **📋 Tableau Clair Type Stripe**

#### **Structure complète**
```jsx
<table className="w-full border-collapse">
  <thead>
    <tr className="bg-gray-50 border-b-2 border-gray-200">
      <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Description</th>
      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700 w-24">Quantité</th>
      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 w-32">Montant (€)</th>
    </tr>
  </thead>
  <tbody>
    {items.map((item, index) => (
      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-4 px-6 text-sm text-gray-900 font-medium">
          {item.description}
        </td>
        <td className="py-4 px-6 text-sm text-center text-gray-600">
          {item.quantity || '1'}
        </td>
        <td className="py-4 px-6 text-sm text-right font-semibold text-gray-900">
          {formatAmountPlain(item.amount)}
        </td>
      </tr>
    ))}
  </tbody>
  <tfoot>
    {totals.map((total, index) => {
      const isTotalTTC = total.label.includes('TOTAL TTC');
      const isBold = total.label.includes('TOTAL');
      
      return (
        <tr key={index} className={isTotalTTC ? 'bg-blue-50 border-t-2 border-blue-200' : 'border-t border-gray-200'}>
          <td colSpan="2" className={`py-4 px-6 text-sm ${
            isTotalTTC ? 'font-bold text-blue-700 text-lg' : 
            isBold ? 'font-semibold text-gray-800' : 
            'text-gray-600'
          }`}>
            {total.label}
          </td>
          <td className={`py-4 px-6 text-sm text-right ${
            isTotalTTC ? 'font-bold text-blue-700 text-lg' : 
            isBold ? 'font-semibold text-gray-800' : 
            'text-gray-600'
          }`}>
            {formatAmountPlain(total.amount)} €
          </td>
        </tr>
      );
    })}
  </tfoot>
</table>
```

#### **Rendu visuel**
```
Description              Quantité   Montant (€)
─────────────────────────────────────────────
Honoraires négo          1          12 500
Frais annexes           1            200
─────────────────────────────────────────────
Montant HT                         12 700
TVA (20%)                          2 540
TOTAL TTC                          15 240  ← Bleu + gras + text-lg
```

### **💰 Totaux Bien Alignés**

#### **Alignement à droite**
```jsx
<td className="py-4 px-6 text-sm text-right font-semibold text-gray-900">
  {formatAmountPlain(item.amount)}
</td>
```

#### **TOTAL TTC très visible**
```jsx
// Style spécial pour TOTAL TTC
className={isTotalTTC ? 'font-bold text-blue-700 text-lg' : 'font-semibold text-gray-800'}

// Fond bleu pour mise en évidence
className={isTotalTTC ? 'bg-blue-50 border-t-2 border-blue-200' : 'border-t border-gray-200'}

// Texte plus grand et bleu
{formatAmountPlain(total.amount)} €
```

### **✍️ Signature et Date**

#### **Zone signature professionnelle**
```jsx
<div className="mb-8">
  <p className="text-sm font-semibold text-gray-700 mb-3">Signature et cachet</p>
  <div className="border-b-2 border-gray-400 w-64 h-12"></div>
</div>
```

#### **Date formatée**
```jsx
<p className="text-sm text-gray-600">
  Fait à {agencyProfile?.address?.split(',')[0] || 'Paris'}, le {getCurrentDate()}
</p>
```

---

## 🎨 Règles de Design Appliquées

### **🎯 Typographie Sobre**

#### **Polices hiérarchiques**
```jsx
// Titres principaux
text-2xl font-bold text-gray-900

// Sous-titres
text-xl font-bold text-gray-900

// En-têtes tableau
text-sm font-semibold text-gray-700

// Contenu normal
text-sm text-gray-900

// Totaux
font-semibold text-gray-800
font-bold text-blue-700 text-lg  // TOTAL TTC
```

#### **Couleurs professionnelles**
```css
/* Gris neutre pour le texte */
text-gray-900  /* Contenu principal */
text-gray-800  /* Totaux importants */
text-gray-700  /* En-têtes */
text-gray-600  /* Texte secondaire */
text-gray-500  /* Texte tertiaire */

/* Bleu pour les éléments importants */
text-blue-700  /* TOTAL TTC */
bg-blue-50   /* Fond TOTAL TTC */
border-blue-200  /* Bordure TOTAL TTC */

/* Fond gris clair */
bg-gray-50   /* En-tête tableau */
bg-gray-100  /* Fond logo */
bg-yellow-50 /* Conditions paiement facture */
```

### **📐 Montants alignés à droite**

#### **Formatage monétaire**
```javascript
const formatAmountPlain = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true  // Espaces français : 40 000
  }).format(amount || 0);
};
```

#### **Alignement CSS**
```jsx
<td className="py-4 px-6 text-sm text-right font-semibold text-gray-900">
  {formatAmountPlain(item.amount)}
</td>
```

### **👁️ TOTAL TTC très visible**

#### **Mise en évidence maximale**
```jsx
// Taille de police plus grande
text-lg

// Couleur bleue proéminente
text-blue-700

// Fond bleu subtil
bg-blue-50

// Bordure bleue épaisse
border-t-2 border-blue-200

// Gras pour accentuer
font-bold
```

### **🚫 Zéro barre SaaS visible**

#### **Full screen indépendant**
```jsx
<div className="fixed inset-0 bg-white z-50 overflow-hidden">
  {/* Document complet sans sidebar/header */}
</div>
```

#### **Header caché à l'impression**
```jsx
<div className="bg-gray-100 border-b border-gray-200 px-6 py-4 flex justify-between items-center print:hidden">
  {/* Actions uniquement en mode preview */}
</div>
```

#### **Pas de branding SaaS**
```jsx
<div ref={componentRef} className="bg-white max-w-4xl mx-auto shadow-lg print:shadow-none">
  {/* Document pur sans éléments SaaS */}
</div>
```

---

## 📊 Résultat Final

### **🏠 Facture IMMO**
- ✅ **Logo agence** : Affiché avec cadre professionnel
- ✅ **Infos complètes** : Adresse, email, téléphone, SIRET
- ✅ **Client structuré** : Grid 2 colonnes, informations claires
- ✅ **Tableau Stripe** : Bordures, alignement, hiérarchie
- ✅ **Totaux alignés** : Montants à droite, TOTAL TTC proéminent
- ✅ **Signature** : Zone dédiée avec date et ville

### **📱 Facture SMMA**
- ✅ **Design adaptable** : Convient aussi aux services digitaux
- ✅ **Prestations claires** : Description des services marketing
- ✅ **Montants justifiés** : HT, TVA, TTC bien détaillés
- ✅ **Conditions paiement** : Zone jaune pour visibilité
- ✅ **Professionnel** : Même design que factures IMMO

---

## 🎯 Avantages du Design

### **✅ Crédibilité professionnelle**
- **Design cohérent** : Type Stripe/Pipedrive
- **Informations complètes** : Tout ce qu'il faut pour une facture
- **Mise en page stable** : HTML/CSS, plus de problèmes jsPDF
- **Branding agence** : Logo et infos bien intégrés

### **✅ Lisibilité optimale**
- **Typographie hiérarchique** : Tailles et poids logiques
- **Contrastes modérés** : Gris sur fond blanc, bleu pour accents
- **Alignement parfait** : Montants alignés à droite
- **Espacements aérés** : Marges et padding généreux

### **✅ Impression native**
- **Full screen** : Document indépendant du layout SaaS
- **Print-friendly** : CSS optimisé pour impression
- **A4 standard** : Format et marges corrects
- **Qualité PDF** : Via impression navigateur native

---

## 🚀 Déploiement Validé

### **✅ Build réussi**
```bash
✓ 1301 modules transformed.
✓ built in 16.18s
```

### **✅ Fonctionnalités testées**
- **Génération HTML** : Instantanée et stable
- **Preview plein écran** : Full screen sans sidebar
- **Impression navigateur** : Via react-to-print
- **Téléchargement PDF** : "Enregistrer en PDF" natif

### **✅ Design professionnel**
- **Tableau financier** : Type Stripe avec bordures
- **Montants formatés** : 40 000 € avec espaces
- **TOTAL TTC visible** : Bleu, gras, text-lg
- **Signature/date** : Zone dédiée et professionnelle

---

## 🏆 Mission Accomplie

### **✅ Contenu obligatoire**
- **Logo agence** ✅
- **Nom agence** ✅  
- **Adresse** ✅
- **Email** ✅
- **Bloc client** ✅
- **Tableau clair** ✅
- **Description/Quantité/Montant** ✅
- **Totaux alignés** ✅
- **HT/TVA/TOTAL TTC** ✅
- **Signature/date** ✅

### **✅ Règles de design**
- **Typographie sobre** ✅
- **Montants alignés à droite** ✅
- **TOTAL TTC très visible** ✅
- **Zéro barre SaaS visible** ✅

### **✅ Résultat final**
- **Facture crédible** : Design professionnel type Stripe
- **Adaptable IMMO/SMMA** : Convient à tous types d'agences
- **Mise en page stable** : HTML/CSS robuste
- **Impression native** : Qualité optimale

---

**La facture professionnelle est maintenant prête pour la production !** 📄✨

*Design crédible, professionnel et adapté aux agences IMMO/SMMA* 🏢📱
