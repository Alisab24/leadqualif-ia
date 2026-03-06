# Documentation du Système de Traitement Automatique des Leads

## Vue d'ensemble

Le système de traitement automatique des leads analyse chaque nouveau lead qui arrive via le formulaire du site et détermine automatiquement son niveau d'intérêt selon trois catégories : **CHAUD**, **TIÈDE**, ou **FROID**.

## Architecture

### Fichiers principaux

1. **`src/services/leadProcessor.js`** - Module principal de traitement et classification
2. **`src/services/ai.js`** - Service IA amélioré avec intégration du processeur
3. **`src/components/LeadForm.jsx`** - Formulaire intégrant le traitement automatique
4. **`src/utils/format.js`** - Utilitaires d'affichage pour la classification

## Classification des Leads

### 🔥 Lead CHAUD

**Critères de qualification :**
- Intentions d'achat explicites dans le message
- Demande urgente mentionnée
- Budget clair et défini
- Réponses complètes aux champs du formulaire
- Score de qualification ≥ 75

**Action recommandée :** Contacter immédiatement

**Exemple de message :**
> "Je souhaite acheter un appartement à Paris dans les 2 prochaines semaines. Mon budget est de 350 000€. Je suis disponible pour une visite dès cette semaine."

### 🌡️ Lead TIÈDE

**Critères de qualification :**
- Intérêt présent mais hésitation détectée
- Questions posées sans engagement ferme
- Pas de budget défini
- Informations partielles
- Score de qualification entre 40 et 74

**Action recommandée :** Contacter sous 24-48h avec des informations pertinentes

**Exemple de message :**
> "Bonjour, je réfléchis à l'achat d'un bien immobilier. J'aimerais avoir plus d'informations sur les biens disponibles dans votre secteur."

### ❄️ Lead FROID

**Critères de qualification :**
- Peu d'informations fournies
- Pas d'intérêt direct détecté
- Message suspect ou spam potentiel
- Score de qualification < 40

**Action recommandée :** Ajouter à la liste de suivi longue durée ou archiver

**Exemple de message :**
> "Bonjour"

## Fonctionnement du Système

### 1. Analyse Automatique

Lorsqu'un nouveau lead est soumis via le formulaire :

1. **Analyse de l'intention d'achat** (`analyzePurchaseIntent`)
   - Détection de mots-clés chauds/tièdes/froids
   - Identification de l'urgence
   - Analyse de la longueur du message

2. **Analyse de complétude** (`analyzeCompleteness`)
   - Vérification des champs obligatoires
   - Qualité et détail du message
   - Présence d'informations spécifiques (budget, localisation, type de bien)

3. **Détection de spam** (`detectSpam`)
   - Vérification des emails suspects
   - Détection de messages suspects
   - Analyse de cohérence des données

4. **Qualification IA** (optionnel)
   - Utilisation d'OpenAI GPT-4 pour une analyse approfondie
   - En cas d'erreur IA, utilisation du processeur automatique uniquement

5. **Classification finale** (`classifyLeadInterest`)
   - Combinaison de toutes les analyses
   - Attribution du niveau d'intérêt (CHAUD/TIÈDE/FROID)
   - Génération de recommandations

### 2. Structure de l'Évaluation JSON

Chaque lead traité génère une évaluation complète au format JSON :

```json
{
  "niveau_interet": "CHAUD",
  "score_qualification": 85,
  "raison_classification": "Intention d'achat forte avec informations complètes et urgence détectée",
  "metriques": {
    "score_global": 85,
    "score_completude": 90,
    "score_intention": 80,
    "probabilite_spam": 0
  },
  "analyse_intention": {
    "intention_achat_detectee": true,
    "mots_cles_chauds": ["acheter", "urgent", "budget"],
    "mots_cles_tiedes": [],
    "mots_cles_froids": [],
    "urgence_detectee": true,
    "longueur_message": 156
  },
  "analyse_completude": {
    "score": 90,
    "pourcentage": 90,
    "champs_complets": ["nom", "email", "telephone", "message", "budget_mentionne"],
    "champs_manquants": []
  },
  "detection_spam": {
    "est_spam": false,
    "score": 0,
    "indicateurs": []
  },
  "recommandations": {
    "action_immediate": "Contacter immédiatement. Lead très prometteur...",
    "priorite": "HAUTE",
    "delai_contact": "Immédiat"
  }
}
```

## Utilisation

### Dans le code

```javascript
import { processLead, classifyLeadInterest } from './services/leadProcessor'
import { aiService } from './services/ai'

// Traitement complet d'un lead
const leadData = {
  nom: "Jean Dupont",
  email: "jean.dupont@example.com",
  telephone: "0612345678",
  message: "Je souhaite acheter un appartement urgent",
  source: "site_web"
}

// Option 1: Avec qualification IA
const qualification = await aiService.qualifyLead(leadData)
// La qualification inclut déjà l'évaluation complète

// Option 2: Traitement automatique uniquement
const evaluation = processLead(leadData, null)
```

### Affichage dans l'interface

Le système fournit des utilitaires pour l'affichage :

```javascript
import { 
  getInterestLevelColor, 
  getInterestLevelIcon, 
  getInterestLevelDescription 
} from './utils/format'

// Obtenir les classes CSS pour le badge
const badgeClasses = getInterestLevelColor('CHAUD') // "text-red-700 bg-red-100..."

// Obtenir l'icône
const icon = getInterestLevelIcon('CHAUD') // "🔥"

// Obtenir la description
const description = getInterestLevelDescription('CHAUD') // "Lead très prometteur..."
```

## Améliorations Apportées

### 1. Système de Classification Robuste
- Analyse multi-critères combinant plusieurs indicateurs
- Fallback automatique si l'IA n'est pas disponible
- Détection de spam intégrée

### 2. Intégration Transparente
- Le système fonctionne automatiquement lors de la soumission du formulaire
- Aucune action manuelle requise
- Les données sont sauvegardées dans la base de données

### 3. Documentation Complète
- Code commenté et documenté
- Fonctions explicites avec JSDoc
- Structure modulaire et maintenable

### 4. Interface Utilisateur Améliorée
- Badges visuels pour la classification (🔥/🌡️/❄️)
- Couleurs distinctes pour chaque niveau
- Descriptions contextuelles

## Maintenance et Évolution

### Ajouter de nouveaux critères

Pour ajouter de nouveaux mots-clés ou critères, modifier les tableaux dans `leadProcessor.js` :

```javascript
// Dans analyzePurchaseIntent()
const hotKeywords = [
  'nouveau_mot_cle',
  // ...
]
```

### Ajuster les seuils

Les seuils de classification peuvent être ajustés dans `classifyLeadInterest()` :

```javascript
// Modifier ces valeurs pour ajuster la sensibilité
if (finalScore >= 75 && ...) { // Seuil pour CHAUD
  niveauInteret = 'CHAUD'
}
```

### Personnaliser les recommandations

Les recommandations sont générées dans `getRecommendation()`. Modifier cette fonction pour adapter les messages selon vos besoins.

## Notes Importantes

- ⚠️ **Sécurité API** : En production, déplacez l'appel à l'API OpenAI vers un backend pour sécuriser la clé API
- 📊 **Performance** : Le traitement automatique est rapide même sans IA
- 🔄 **Évolutivité** : Le système peut être étendu avec d'autres critères ou analyses

## Support

Pour toute question ou amélioration, référez-vous aux commentaires dans le code source ou contactez l'équipe de développement.

