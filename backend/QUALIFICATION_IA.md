# Logique de Qualification IA

## Vue d'ensemble

Le système de qualification IA analyse automatiquement chaque lead soumis et génère :
1. Un **score de qualification** (1-10)
2. Une **recommandation** pour l'agent

## Critères de Scoring

### Score 9-10 (Lead TRÈS CHAUD)
- **Condition** : DPE de classe A ou B
- **Recommandation** : "Appeler immédiatement, potentiel mandat élevé. Priorité absolue."

### Score 8 (Lead CHAUD)
- **Condition** : Score calculé = 8
- **Recommandation** : "Contacter dans les 24h, bon potentiel de conversion. Planifier un RDV rapidement."

### Score 6-7 (Lead TIÈDE)
- **Condition** : Score calculé entre 6 et 7
- **Recommandation** : "Email de suivi personnalisé recommandé. Relancer dans 48h si pas de réponse."

### Score 4-5 (Lead FROID)
- **Condition** : Score calculé entre 4 et 5
- **Recommandation** : "Email de suivi automatique. Ajouter à la campagne de nurturing."

### Score 1-3 (Lead TRÈS FROID)
- **Condition** : Score calculé entre 1 et 3
- **Recommandation** : "Email de suivi automatique uniquement. Faible priorité."

## Calcul du Score

Le score est calculé selon les critères suivants :

1. **DPE A ou B** : Score automatique de 9-10 (lead très chaud)
2. **Prix > 500 000€** : Bonus de +2 points
3. **Téléphone fourni** : Bonus de +1 point
4. **Score de base** : Aléatoire entre 1 et 7 (si aucun critère spécial)

Le score final est limité entre 1 et 10.

## Exemple d'utilisation

### Requête POST /api/submit-lead

```json
{
  "nom_client": "Jean Dupont",
  "email_client": "jean.dupont@email.com",
  "telephone": "0612345678",
  "adresse_bien_interesse": "123 Rue de la Paix, 75001 Paris",
  "dpe": "A",
  "prix": "650000"
}
```

### Réponse

```json
{
  "status": "success",
  "message": "Lead créé avec succès et qualifié par l'IA",
  "data": {
    "id": 1,
    "nom_client": "Jean Dupont",
    "email_client": "jean.dupont@email.com",
    "score_qualification_ia": 9,
    "recommandation_ia": "Lead TRÈS CHAUD : Appeler immédiatement, potentiel mandat élevé. Priorité absolue.",
    "statut_rdv": "Non Plannifié",
    ...
  },
  "score_ia": 9,
  "recommandation_ia": "Lead TRÈS CHAUD : Appeler immédiatement, potentiel mandat élevé. Priorité absolue."
}
```

## Cas d'usage

### Cas 1 : Lead avec DPE A
- **Input** : `dpe: "A"`
- **Score** : 9-10
- **Recommandation** : Lead TRÈS CHAUD

### Cas 2 : Lead avec prix élevé et téléphone
- **Input** : `prix: "600000"`, `telephone: "0612345678"`
- **Score** : 4-10 (base 1-7 + 2 points prix + 1 point téléphone)
- **Recommandation** : Selon le score final

### Cas 3 : Lead basique
- **Input** : Seulement nom et email
- **Score** : 1-7 (aléatoire)
- **Recommandation** : Lead FROID ou TRÈS FROID

## Prochaines améliorations

1. **Intégration ML** : Remplacer la logique de scoring par un modèle ML entraîné
2. **Critères supplémentaires** : Ajouter d'autres facteurs (localisation, type de bien, etc.)
3. **Historique** : Tracker l'évolution du score dans le temps
4. **A/B Testing** : Tester différentes stratégies de scoring


