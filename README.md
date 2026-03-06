# LeadQualif IA — Application SaaS

> Module central de [NexaPro](https://nexapro.tech) — CRM intelligent pour agences SMMA, immobilières et entreprises de services B2B.

---

## 🏗️ Architecture des projets

```
Hp/
├── nexap/          → Application SaaS LeadQualif (React + Vite + Supabase)
└── sitenexap/      → Site marketing NexaPro (HTML statique, Vercel)
```

### Flux utilisateur

```
nexapro.tech                      →  Site marketing NexaPro (sitenexap/)
nexapro.tech/leadqualif.html      →  Page produit LeadQualif (page canonique)
www.leadqualif.com/               →  Redirige → nexapro.tech/leadqualif.html
www.leadqualif.com/login          →  App SaaS LeadQualif (nexap/)
```

---

## ⚙️ Stack technique

| Couche          | Technologie                      |
|-----------------|----------------------------------|
| Frontend App    | React 18, Vite, Tailwind CSS     |
| Backend IA      | Flask (Python), OpenAI API       |
| Base de données | Supabase (PostgreSQL + RLS)      |
| Hébergement     | Vercel                           |
| Versioning      | GitHub                           |

---

## 🚀 Démarrage rapide

### App LeadQualif (nexap/)

```bash
npm install
npm run dev       # développement local
npm run build     # build production → dist/
```

### Backend IA (nexap/backend/)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### Variables d'environnement

Copier `.env.example` → `.env.local` et renseigner :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENAI_API_KEY=...
```

---

## 📂 Structure du projet

```
nexap/
├── src/
│   ├── App.jsx                 → Router principal
│   ├── pages/                  → Dashboard, Login, Documents, Stats...
│   ├── components/             → Composants réutilisables
│   ├── services/               → Logique métier (PDF, IA, Supabase)
│   ├── context/                → Auth, Leads contexts
│   └── supabaseClient.js       → Connexion Supabase
├── backend/
│   ├── app.py                  → API Flask principale
│   ├── models.py               → Modèles de données
│   └── requirements.txt        → Dépendances Python
├── database/
│   └── supabase_schema.sql     → Schéma complet Supabase
├── docs/                       → Documentation technique interne (61 fichiers)
└── public/
    ├── estimation.html         → Formulaire prospect public
    └── merci.html              → Page confirmation
```

---

## 🔌 Modules principaux de LeadQualif

### 1. Collecte des leads
- Formulaire web (`/estimation/:agencyId`)
- API endpoint POST `/api/leads`
- Intégration WhatsApp (via webhook)

### 2. Qualification automatique (IA)
- Analyse des réponses via OpenAI
- Scoring : 🔴 Froid / 🟡 Tiède / 🟢 Chaud
- Catégorisation automatique du prospect

### 3. Dashboard CRM
- Pipeline visuel par statut
- Actions rapides (WhatsApp, Email, RDV)
- Historique des conversations

### 4. Génération de documents
- Devis, Factures, Mandats
- Templates personnalisables par agence
- Export PDF depuis la fiche lead

### 5. Gestion multi-agences
- Isolation des données par `agency_id` (RLS Supabase)
- Paramètres de profil agence
- Numérotation automatique des documents

---

## 🗄️ Schéma Supabase (tables principales)

| Table               | Description                              |
|---------------------|------------------------------------------|
| `leads`             | Prospects collectés et qualifiés         |
| `agencies`          | Profils des agences utilisatrices        |
| `documents`         | Devis, factures, mandats générés         |
| `document_counters` | Numérotation auto des documents          |
| `crm_events`        | Historique des actions sur les leads     |
| `agency_settings`   | Paramètres et préférences par agence     |

---

## 🔗 Liens

- **Site NexaPro** : [nexapro.tech](https://nexapro.tech)
- **Page produit LeadQualif** : [nexapro.tech/leadqualif.html](https://nexapro.tech/leadqualif.html)
- **App** : [leadqualif.com/login](https://www.leadqualif.com/login)
- **Contact** : contact@nexapro.tech

---

## 📋 Changelog

### Mars 2026 — Ménage & Refactoring
- ✅ **Fix critique** : Suppression des commandes git accidentellement injectées dans `index.html`
- ✅ **Routing** : La route `/` redirige désormais vers `nexapro.tech/leadqualif.html` (page marketing canonique)
- ✅ **Nettoyage** : 35 fichiers `vite.config.js.timestamp-*.mjs` supprimés
- ✅ **Organisation** : 61 fichiers `.md` déplacés dans `docs/`
- ✅ **Site NexaPro** : `landing-leadqualif.html` redirige vers `leadqualif.html` (page unique canonique)
