import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from openai import OpenAI  # Nouvelle importation v1+

# Initialisation du client OpenAI
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

app = Flask(__name__)

# 1. CONFIGURATION CORS (Accepte tout le monde pour éviter les blocages)
CORS(app, resources={r"/*": {"origins": "*"}})

# 2. CONFIGURATION BASE DE DONNÉES (Compatible Render PostgreSQL)
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# 3. INITIALISATION CLIENT OPENAI (Nouvelle méthode)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# --- MODÈLES (Table User et Lead) ---
class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    telephone = db.Column(db.String(20))
    budget = db.Column(db.Integer)
    type_bien = db.Column(db.String(50))
    score_ia = db.Column(db.Integer, default=0)
    statut = db.Column(db.String(20), default='Nouveau')

# Création des tables si elles n'existent pas
with app.app_context():
    db.create_all()

# --- ROUTES ---

@app.route('/', methods=['GET'])
def home():
    return "Backend LeadQualif IA est en ligne (PostgreSQL + OpenAI)!"

# Route 1 : Réception du formulaire
@app.route('/api/leads', methods=['POST'])
def add_lead():
    try:
        data = request.json
        # Calcul simple du score (simulation IA rapide)
        score = 5
        if data.get('budget') and int(data['budget']) > 20000000: score += 2
        if data.get('telephone'): score += 2
        if data.get('type_bien'): score += 1

        new_lead = Lead(
            nom=data.get('nom'),
            email=data.get('email'),
            telephone=data.get('telephone'),
            budget=data.get('budget'),
            type_bien=data.get('type_bien'),
            score_ia=score
        )
        db.session.add(new_lead)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Lead enregistré'}), 201
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Route 2 : Envoi des leads au Dashboard
@app.route('/api/leads-chauds', methods=['GET'])
def get_leads():
    try:
        leads = Lead.query.order_by(Lead.score_ia.desc()).all()
        leads_data = [{
            'id': l.id,
            'nom': l.nom,
            'email': l.email,
            'telephone': l.telephone,
            'type_bien': l.type_bien,
            'score_ia': l.score_ia,
            'statut': l.statut,
            'budget': l.budget
        } for l in leads]
        return jsonify({'status': 'success', 'data': {'leads_chauds': leads_data}}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Route 3 : GÉNÉRATION ANNONCE IA (C'est ici que ça bloquait)
@app.route('/api/generate-annonce', methods=['POST'])
def generate_annonce():
    try:
        data = request.json
        # Construction du prompt pour ChatGPT
        prompt = f"""
        Rédige une annonce immobilière très vendeuse et professionnelle (avec des emojis) pour ce bien au Bénin :
        - Type : {data.get('type', 'Bien immobilier')}
        - Adresse/Quartier : {data.get('adresse', 'Cotonou')}
        - Prix : {data.get('prix', 'Nous consulter')}
        - Surface : {data.get('surface', 'Non précisée')}
        - Pièces : {data.get('pieces', 'Non précisé')}
        
        Structure l'annonce avec : Accroche, Description, Points Forts, Appel à l'action.
        """

        # Appel à OpenAI (Nouvelle Syntaxe v1.0+)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Tu es un expert en copywriting immobilier de luxe."},
                {"role": "user", "content": prompt}
            ]
        )

        # Récupération de la réponse (Nouvelle Syntaxe)
        texte_genere = response.choices[0].message.content
        
        return jsonify({'text': texte_genere})

    except Exception as e:
        print(f"Erreur OpenAI: {e}") # Affiche l'erreur dans les logs Render
        return jsonify({'error': str(e), 'text': "Erreur IA : Vérifiez la clé API ou le crédit."}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)