# LeadQualif IA

Application web desktop pour la gestion et la qualification automatique de leads immobiliers avec intelligence artificielle.

## 🚀 Fonctionnalités

- ✅ Ajout de leads avec formulaire intuitif
- 🤖 Qualification automatique via OpenAI GPT-4
- 💾 Stockage sécurisé dans Supabase
- 📊 Dashboard avec statistiques et tableau des leads
- 📝 Détails complets d'un lead avec résumé IA
- 📅 Intégration Calendly pour proposer des RDV
- 🎨 Interface moderne avec TailwindCSS

## 📋 Prérequis

- Node.js 18+ et npm
- Compte Supabase (gratuit)
- Clé API OpenAI

## 🛠️ Installation

1. **Installer les dépendances**
```bash
npm install
```

2. **Configurer les variables d'environnement**

Créez un fichier `.env` à la racine du projet avec :

```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
VITE_OPENAI_API_KEY=votre_cle_api_openai
VITE_CALENDLY_URL=https://calendly.com/votre-compte
```

3. **Créer la table Supabase**

Exécutez cette requête SQL dans votre dashboard Supabase :

```sql
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  message TEXT,
  source TEXT DEFAULT 'site_web',
  score_qualification INTEGER,
  budget_estime TEXT,
  urgence TEXT,
  type_bien_recherche TEXT,
  localisation_souhaitee TEXT,
  points_forts JSONB,
  points_attention JSONB,
  recommandations JSONB,
  resume TEXT,
  resume_ia TEXT,
  qualification_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer Row Level Security (optionnel mais recommandé)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour permettre toutes les opérations (ajustez selon vos besoins)
CREATE POLICY "Allow all operations" ON leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

## 🚀 Lancement

```bash
# Mode développement
npm run dev

# Build de production
npm run build

# Prévisualiser le build
npm run preview
```

L'application sera accessible sur `http://localhost:3000`

## 📁 Structure du projet

```
src/
├── components/
│   ├── LeadForm.jsx      # Formulaire d'ajout de lead
│   ├── LeadList.jsx      # Tableau des leads
│   └── LeadDetails.jsx   # Page de détails d'un lead
├── pages/
│   ├── Dashboard.jsx     # Page principale avec statistiques
│   └── Settings.jsx      # Page de paramètres
├── services/
│   ├── supabase.js       # Configuration et fonctions Supabase
│   └── ai.js             # Service de qualification IA
├── utils/
│   └── format.js         # Fonctions utilitaires de formatage
├── App.jsx               # Composant principal avec routing
└── main.jsx              # Point d'entrée de l'application
```

## 🔧 Technologies utilisées

- **React 18** - Bibliothèque UI
- **Vite** - Build tool et dev server
- **TailwindCSS** - Framework CSS
- **React Router** - Routing
- **Supabase** - Backend et base de données
- **OpenAI GPT-4** - Qualification IA des leads
- **Axios** - Requêtes HTTP

## 📝 Notes importantes

- ⚠️ **Sécurité** : La clé API OpenAI est exposée côté client dans ce projet. Pour la production, créez un backend proxy pour sécuriser vos clés API.
- 🔒 Configurez correctement les politiques RLS dans Supabase selon vos besoins de sécurité.
- 💰 Les appels à l'API OpenAI sont facturés selon votre plan OpenAI.

## 📄 Licence

MIT

