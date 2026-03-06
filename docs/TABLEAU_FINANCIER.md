# 📋 Tableau Financier Type Stripe - Documentation

## 🎯 Objectif
Créer un tableau financier professionnel dans les documents PDF (devis/factures) avec un design type Stripe, incluant :
- Bordures complètes et propres
- Alignement correct des montants
- Formatage professionnel des totaux
- Hiérarchie visuelle claire

## 🔧 Fonction `createFinancialTable`

### Paramètres
```javascript
createFinancialTable(doc, items, totals, startY, margin, pageWidth)
```

- `doc` : Instance jsPDF
- `items` : Array des lignes de prestations
- `totals` : Array des totaux (HT, TVA, TTC)
- `startY` : Position Y de départ
- `margin` : Marge latérale
- `pageWidth` : Largeur de la page

### Structure des données

#### Items (prestations)
```javascript
items = [
  {
    description: "Honoraires de négociation immobilière",
    quantity: "1", 
    amount: 12500
  },
  {
    description: "Frais annexes",
    quantity: "1",
    amount: 200
  }
]
```

#### Totaux
```javascript
totals = [
  { label: "Montant HT", amount: 12700 },
  { label: "TVA (20%)", amount: 2540 },
  { label: "TOTAL TTC", amount: 15240 }
]
```

## 🎨 Design Implémenté

### 1️⃣ Structure du tableau
```
┌─────────────────────────────────────────────────────────┐
│ Description              Quantité   Montant (€)    │ ← En-tête gris
├─────────────────────────────────────────────────────────┤
│ Prestation 1            1          12 500        │ ← Lignes données
│ Prestation 2            1            200          │
├─────────────────────────────────────────────────────────┤
│ Montant HT                         12 700        │ ← Totaux
│ TVA (20%)                         2 540        │
│ TOTAL TTC                          15 240        │ ← Bleu + gras
└─────────────────────────────────────────────────────────┘
```

### 2️⃣ Caractéristiques visuelles

#### Bordures et cadres
- **Cadre extérieur** : `rgb(226, 232, 240)` épaisseur 1px
- **Colonnes** : Bordures verticales complètes
- **Lignes** : Séparation entre chaque rangée
- **TOTAL TTC** : Cadre bleu `rgb(59, 130, 246)`

#### Couleurs et typographie
- **En-tête** : Fond gris `rgb(248, 250, 252)` + texte `rgb(71, 84, 103)`
- **Données** : Texte noir `rgb(31, 41, 55)` taille 11px
- **Totaux** : Gras 13px pour les montants importants
- **TOTAL TTC** : Bleu `rgb(59, 130, 246)` avec fond subtil

#### Alignement et espacement
- **Hauteur lignes** : 22px pour une bonne lisibilité
- **Colonnes** : 55% / 15% / 30% répartition optimale
- **Montants** : Alignés à droite avec espaces `40 000`
- **Descriptions** : Tronquées à 40 caractères avec "..."

## 🚀 Améliorations Techniques

### 1️⃣ Formatage des montants
```javascript
// Fonction de formatage avec espaces
const formatAmountPlain = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(amount || 0);
};

// Résultat : 40 000 au lieu de 40000
```

### 2️⃣ Gestion des descriptions longues
```javascript
// Tronquer les descriptions trop longues
let description = item.description;
if (description.length > 40) {
  description = description.substring(0, 37) + '...';
}
```

### 3️⃣ Calcul dynamique de la hauteur
```javascript
// Hauteur automatique selon le contenu
const tableHeight = (items.length + 1) * rowHeight + totals.length * 20 + 8;
doc.rect(margin, currentY, tableWidth, tableHeight, 'S');
```

## 📊 Résultat Visuel

### Avant les améliorations
- ❌ Pas de tableau structuré
- ❌ Montants sans espaces : `40000€`
- ❌ Pas de hiérarchie visuelle
- ❌ Design basique

### Après les améliorations
- ✅ Tableau professionnel complet
- ✅ Montants formatés : `40 000 €`
- ✅ Hiérarchie claire avec couleurs
- ✅ Design type Stripe/Pipedrive

## 🎯 Cas d'usage

### Devis immobilier
```javascript
items = [
  { description: "Honoraires de négociation immobilière", quantity: "1", amount: 12500 },
  { description: "Frais de dossier", quantity: "1", amount: 500 }
]

totals = [
  { label: "Montant HT", amount: 13000 },
  { label: "TVA (20%)", amount: 2600 },
  { label: "TOTAL TTC", amount: 15600 }
]
```

### Facture SMMA
```javascript
items = [
  { description: "Stratégie marketing digitale complète", quantity: "1", amount: 2000 },
  { description: "Gestion réseaux sociaux", quantity: "3", amount: 1500 }
]

totals = [
  { label: "Montant HT", amount: 3500 },
  { label: "TVA (20%)", amount: 700 },
  { label: "TOTAL TTC", amount: 4200 }
]
```

## 🔍 Intégration

### Appel dans les documents
```javascript
// Dans generateDocumentDirectly()
if (financialData && (docType.id === 'devis' || docType.id === 'facture')) {
  currentY += 20;
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('RÉCAPITULATIF FINANCIER', margin, currentY);
  
  currentY += 25;
  currentY = createFinancialTable(doc, financialData.items, financialData.totals, currentY, margin, pageWidth);
}
```

## 🎉 Résultat Final

Le tableau financier généré présente :
- ✅ **Design professionnel** : Type Stripe avec bordures nettes
- ✅ **Montants corrects** : Formatage `40 000 €` avec espaces
- ✅ **Hiérarchie visuelle** : Totaux en gras et couleur
- ✅ **Alignement parfait** : Montants alignés à droite
- ✅ **Responsive** : S'adapte au contenu dynamique
- ✅ **Lisibilité** : Espacement et tailles optimales

---

*Document généré avec succès dans les devis et factures* 📄✨
