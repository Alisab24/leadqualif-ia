# LeadQualif IA - Backend API

Backend Flask pour l'application LeadQualif IA. Gère la base de données, les API endpoints et l'intégration avec l'IA.

## Structure du Projet

```
backend/
├── app.py              # Application Flask principale
├── config.py           # Configuration de l'application
├── models.py           # Modèles de base de données SQLAlchemy
├── requirements.txt    # Dépendances Python
├── api/
│   ├── __init__.py
│   └── routes.py      # Routes API
└── leadqualif_ia.db   # Base de données SQLite (créée automatiquement)
```

## Installation

1. Installer les dépendances Python :
```bash
pip install -r requirements.txt
```

2. Lancer le serveur :
```bash
python app.py
```

Le serveur sera accessible sur `http://localhost:5000`

## Endpoints API

### POST /api/submit-lead
Soumet un nouveau lead dans la base de données.

**Body JSON :**
```json
{
  "nom_client": "Jean Dupont",
  "email_client": "jean.dupont@email.com",
  "telephone": "0612345678",
  "adresse_bien_interesse": "123 Rue de la Paix, 75001 Paris"
}
```

**Réponse :**
```json
{
  "status": "success",
  "message": "Lead créé avec succès",
  "data": {
    "id": 1,
    "nom_client": "Jean Dupont",
    "email_client": "jean.dupont@email.com",
    "score_qualification_ia": 8,
    "statut_rdv": "Non Plannifié",
    ...
  }
}
```

### GET /api/get-leads
Récupère tous les leads.

### GET /api/get-leads-chauds
Récupère uniquement les leads chauds (score >= 8).

### GET /api/get-lead/<id>
Récupère un lead spécifique par son ID.

## Base de Données

Le modèle `Lead` contient les colonnes suivantes :
- `id` : Identifiant unique
- `nom_client` : Nom du client
- `email_client` : Email du client
- `telephone` : Téléphone (optionnel)
- `adresse_bien_interesse` : Adresse du bien (optionnel)
- `score_qualification_ia` : Score de qualification (1-10)
- `statut_rdv` : Statut du RDV ('Non Plannifié', 'Plannifié', 'Confirmé')
- `created_at` : Date de création
- `updated_at` : Date de mise à jour

## Configuration

Les paramètres de configuration sont dans `config.py`. Par défaut, la base de données SQLite est créée localement dans le dossier `backend/`.

Pour utiliser une base de données PostgreSQL en production, définissez la variable d'environnement `DATABASE_URL`.


