import os
import uuid
from datetime import datetime
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from openai import OpenAI
from sqlalchemy.dialects.postgresql import UUID

app = Flask(__name__)

# --- 1. CONFIGURATION ---
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration Base de données Supabase PostgreSQL
supabase_url = os.environ.get('SUPABASE_DB_URL')
if not supabase_url:
    # Fallback pour développement local
    supabase_url = os.environ.get('DATABASE_URL')
    if supabase_url and supabase_url.startswith("postgres://"):
        supabase_url = supabase_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = supabase_url or 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Client OpenAI
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# --- 2. MODÈLE DE DONNÉES (COMPATIBLE SUPABASE) ---
class Agency(db.Model):
    __tablename__ = 'agencies'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom_agence = db.Column(db.String(255), nullable=False)
    plan = db.Column(db.String(50), default='starter')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Profile(db.Model):
    __tablename__ = 'profiles'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), unique=True, nullable=False)
    agency_id = db.Column(UUID(as_uuid=True), db.ForeignKey('agencies.id'), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='agent')
    nom_complet = db.Column(db.String(255))
    telephone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relation avec l'agence
    agency = db.relationship('Agency', backref='profiles')

class Interaction(db.Model):
    __tablename__ = 'interactions'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = db.Column(UUID(as_uuid=True), db.ForeignKey('leads.id'), nullable=False)
    type_action = db.Column(db.String(50), nullable=False)
    details = db.Column(db.String(500))
    date = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey('profiles.id'))

class Lead(db.Model):
    __tablename__ = 'leads'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agency_id = db.Column(UUID(as_uuid=True), db.ForeignKey('agencies.id'), nullable=False)
    nom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    telephone = db.Column(db.String(20))
    budget = db.Column(db.Integer)
    type_bien = db.Column(db.String(50))
    adresse = db.Column(db.String(500))
    score_ia = db.Column(db.Integer, default=0)
    statut_crm = db.Column(db.String(50), default='À traiter')
    source = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    agency = db.relationship('Agency', backref='leads')
    interactions = db.relationship('Interaction', backref='lead', lazy=True, order_by='Interaction.date.desc()')

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
        
        # Récupérer l'agency_id depuis les données (pour le formulaire public)
        agency_id = data.get('agency_id')
        if not agency_id:
            return jsonify({'error': 'agency_id est requis'}), 400
        
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
            agency_id=agency_id,
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
            'budget': l.budget,
            'interactions': [{
                'id': i.id,
                'type_action': i.type_action,
                'details': i.details,
                'date': i.date.isoformat() if i.date else None
            } for i in l.interactions]
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

# --- ROUTE 4 : AJOUT INTERACTION (HISTORIQUE CRM) ---
@app.route('/api/leads/<int:id>/interactions', methods=['POST'])
def add_interaction(id):
    try:
        lead = Lead.query.get(id)
        if not lead:
            return jsonify({'error': 'Lead non trouvé'}), 404
        
        data = request.json
        type_action = data.get('type_action')
        details = data.get('details', '')
        
        if not type_action:
            return jsonify({'error': 'Type d\'action manquant'}), 400
        
        new_interaction = Interaction(
            lead_id=id,
            type_action=type_action,
            details=details,
            date=datetime.utcnow()
        )
        
        db.session.add(new_interaction)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'interaction': {
                'id': new_interaction.id,
                'type_action': new_interaction.type_action,
                'details': new_interaction.details,
                'date': new_interaction.date.isoformat()
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- ROUTE 5 : GÉNÉRATION ANNONCE IA ---
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