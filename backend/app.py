import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)

# --- 1. CONFIGURATION ---
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration Base de données (Compatible Render Postgres)
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Client OpenAI
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# --- 2. MODÈLE DE DONNÉES ---
class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    telephone = db.Column(db.String(20))
    budget = db.Column(db.Integer)
    type_bien = db.Column(db.String(50))
    adresse = db.Column(db.String(200)) # Ajouté pour la localisation
    score_ia = db.Column(db.Integer, default=0)
    statut = db.Column(db.String(20), default='Nouveau') # Statut IA (Chaud/Froid)
    statut_crm = db.Column(db.String(50), default='À traiter') # NOUVEAU : Suivi commercial

# Création des tables au démarrage (si elles n'existent pas)
with app.app_context():
    db.create_all()

# --- 3. ROUTES API ---

@app.route('/', methods=['GET'])
def home():
    return "Backend LeadQualif CRM est en ligne 🚀"

# --- ROUTE 1 : AJOUT DE LEAD (AVEC SCORING INTELLIGENT) ---
@app.route('/api/leads', methods=['POST'])
def add_lead():
    try:
        data = request.json
        
        # Scoring Strict (Marché FR/EU)
        score = 0
        telephone = data.get('telephone', '')
        email = data.get('email', '')
        ville = data.get('adresse', '').lower()
        
        # Nettoyage budget
        try:
            budget_str = str(data.get('budget', '0')).replace(' ', '').replace('€', '')
            budget = int(budget_str)
        except ValueError:
            budget = 0

        # Critères
        if len(telephone) > 8: score += 4
        elif len(email) > 5: score += 1
            
        if budget > 500000: score += 5
        elif budget > 250000: score += 3
        elif budget > 100000: score += 1

        # Pénalité cohérence (Ex: Paris à 50k€)
        if 'paris' in ville and budget < 200000 and budget > 0:
            score -= 3

        # Bornes 0-10
        score = max(0, min(10, score))

        # Statut IA
        statut_ia = 'Chaud 🔥' if score >= 7 else ('Tiède 😐' if score >= 4 else 'Froid ❄️')

        new_lead = Lead(
            nom=data.get('nom'),
            email=email,
            telephone=telephone,
            budget=budget,
            type_bien=data.get('type_bien'),
            adresse=data.get('adresse'),
            score_ia=score,
            statut=statut_ia,
            statut_crm='À traiter'
        )
        db.session.add(new_lead)
        db.session.commit()
        
        return jsonify({'status': 'success', 'message': 'Lead qualifié', 'score': score}), 201

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- ROUTE 2 : LISTE DES LEADS ---
@app.route('/api/leads-chauds', methods=['GET'])
def get_leads():
    try:
        # On trie par ID décroissant (le plus récent en haut)
        leads = Lead.query.order_by(Lead.id.desc()).all()
        leads_data = [{
            'id': l.id,
            'nom': l.nom,
            'email': l.email,
            'telephone': l.telephone,
            'type_bien': l.type_bien,
            'adresse': l.adresse,
            'score_ia': l.score_ia,
            'statut': l.statut,
            'statut_crm': l.statut_crm or 'À traiter', # Sécurité si vide
            'budget': l.budget
        } for l in leads]
        return jsonify({'status': 'success', 'data': {'leads_chauds': leads_data}}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- ROUTE 3 : MISE À JOUR CRM (Pour le menu déroulant) ---
@app.route('/api/leads/<int:id>/statut', methods=['PUT'])
def update_statut(id):
    try:
        lead = Lead.query.get(id)
        if not lead:
            return jsonify({'error': 'Lead non trouvé'}), 404
        
        data = request.json
        lead.statut_crm = data.get('statut')
        db.session.commit()
        return jsonify({'success': True, 'nouveau_statut': lead.statut_crm})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- ROUTE 4 : GÉNÉRATION ANNONCE IA ---
@app.route('/api/generate-annonce', methods=['POST'])
def generate_annonce():
    try:
        data = request.json
        prompt = f"""
        Agis comme un agent immobilier de luxe en France. Rédige une annonce vendeuse pour :
        - Bien : {data.get('type')}
        - Lieu : {data.get('adresse')}
        - Prix : {data.get('prix')} €
        - Surface : {data.get('surface')}
        - Détails : {data.get('pieces')}
        Utilise des emojis, un ton professionnel et accrocheur.
        """

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        return jsonify({'text': response.choices[0].message.content})

    except Exception as e:
        print(f"Erreur IA: {e}")
        return jsonify({'error': str(e)}), 500

# --- 🚨 ROUTE DE SECOURS (RESET DB) 🚨 ---
@app.route('/api/debug/reset-db', methods=['GET'])
def reset_database():
    try:
        with app.app_context():
            db.drop_all()
            db.create_all()
        return jsonify({'message': '✅ Base de données réparée et mise à jour avec succès !'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)