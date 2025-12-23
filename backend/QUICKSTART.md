# Guide de Démarrage Rapide - Backend LeadQualif IA

## Installation en 3 étapes

### 1. Installer les dépendances Python

```bash
cd backend
pip install -r requirements.txt
```

### 2. Lancer le serveur

```bash
python run.py
```

Ou directement :
```bash
python app.py
```

### 3. Tester l'API

Le serveur sera accessible sur `http://localhost:5000`

**Test de base :**
```bash
curl http://localhost:5000/
```

**Soumettre un lead :**
```bash
curl -X POST http://localhost:5000/api/submit-lead \
  -H "Content-Type: application/json" \
  -d '{
    "nom_client": "Jean Dupont",
    "email_client": "jean.dupont@email.com",
    "telephone": "0612345678",
    "adresse_bien_interesse": "123 Rue de la Paix, 75001 Paris"
  }'
```

**Récupérer les leads chauds :**
```bash
curl http://localhost:5000/api/get-leads-chauds
```

## Structure de la Base de Données

La base de données SQLite sera créée automatiquement dans `backend/leadqualif_ia.db` lors du premier lancement.

### Table Leads

| Colonne | Type | Description |
|---------|------|-------------|
| id | Integer | Identifiant unique (auto-incrémenté) |
| nom_client | String(200) | Nom du client (requis) |
| email_client | String(200) | Email du client (requis) |
| telephone | String(20) | Téléphone (optionnel) |
| adresse_bien_interesse | String(500) | Adresse du bien (optionnel) |
| score_qualification_ia | Integer | Score de qualification (1-10) |
| statut_rdv | String(50) | Statut du RDV ('Non Plannifié', 'Plannifié', 'Confirmé') |
| created_at | DateTime | Date de création |
| updated_at | DateTime | Date de mise à jour |

## Prochaines Étapes

1. **Intégrer l'IA réelle** : Remplacer `generer_score_qualification_simule()` par un appel à votre modèle IA
2. **Ajouter l'authentification** : Sécuriser les endpoints avec JWT ou OAuth
3. **Intégrer le calendrier** : Connecter Google Calendar API ou Calendly
4. **Déployer en production** : Utiliser PostgreSQL et un serveur WSGI (Gunicorn)


