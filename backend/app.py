import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from openai import OpenAI  # Importation correcte v1+

app = Flask(__name__)

# 1. CONFIGURATION CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# 2. CONFIGURATION BASE DE DONNÉES
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# 3. INITIALISATION CLIENT OPENAI
# On crée l'objet "client" qui servira à tout faire
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# --- MODÈLES ---
class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    telephone = db.Column(db.String(20))
    budget = db.Column(db.Integer)
    type_bien = db.Column(db.String(50))
    score_ia = db.Column(db.Integer, default=0)
    statut = db.Column(db.String(20), default='Nouveau')
    statut_crm = db.Column(db.String(50), default='À traiter')

# Création des tables
with app.app_context():
    db.create_all()

# --- ROUTES ---

@app.route('/', methods=['GET'])
def home():
    return "Backend LeadQualif IA est en ligne (PostgreSQL + OpenAI v1)!"

@app.route('/api/leads', methods=['POST'])
def add_lead():
    try:
        data = request.json
        
        # Base : Start à 0
        score = 0
        
        # Qualité Contact
        # Si téléphone présent et valide (plus de 9 chiffres) : +4 points
        telephone = data.get('telephone', '')
        if telephone and len(telephone.replace(' ', '').replace('-', '')) > 9:
            score += 4
        
        # Si email présent : +1 point
        if data.get('email'):
            score += 1
        
        # Budget (En Euros)
        budget_str = data.get('budget', '0')
        try:
            budget = int(str(budget_str).replace(' ', '').replace('€', '').replace(',', ''))
        except (ValueError, TypeError):
            budget = 0
        
        if budget > 500000:
            score += 5  # Client Premium
        elif 200000 <= budget <= 500000:
            score += 3  # Standard
        elif budget < 150000 and budget > 0:
            score += 1  # Faible pour la France
        
        # Pénalité de Réalisme (Coherence Check)
        # Si la ville (dans adresse ou localisation) contient 'Paris' ET que le budget est inférieur à 250,000 € : Enlève 3 points
        adresse = data.get('adresse', '').lower()
        localisation = data.get('localisation', '').lower()
        if ('paris' in adresse or 'paris' in localisation) and budget < 250000:
            score -= 3
        
        # Limites : Le score final doit être borné entre 0 et 10
        score = max(0, min(10, score))
        
        # Statut en fonction du score
        if score >= 7:
            statut = 'Chaud'
        elif score >= 4:
            statut = 'Tiède'
        else:
            statut = 'Froid'

        new_lead = Lead(
            nom=data.get('nom'),
            email=data.get('email'),
            telephone=data.get('telephone'),
            budget=budget,
            type_bien=data.get('type_bien'),
            score_ia=score,
            statut=statut
        )
        db.session.add(new_lead)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Lead enregistré', 'score': score, 'statut': statut}), 201
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
            'statut_crm': l.statut_crm,
            'budget': l.budget
        } for l in leads]
        return jsonify({'status': 'success', 'data': {'leads_chauds': leads_data}}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/leads/<int:id>/statut', methods=['PUT'])
def update_lead_statut(id):
    try:
        data = request.json
        nouveau_statut = data.get('statut')
        
        if not nouveau_statut:
            return jsonify({'status': 'error', 'message': 'Statut manquant'}), 400
        
        lead = Lead.query.get(id)
        if not lead:
            return jsonify({'status': 'error', 'message': 'Lead non trouvé'}), 404
        
        lead.statut_crm = nouveau_statut
        db.session.commit()
        
        return jsonify({'status': 'success', 'message': 'Statut mis à jour', 'statut_crm': nouveau_statut}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Route de Génération (CORRIGÉE)
@app.route('/api/generate-annonce', methods=['POST'])
def generate_annonce():
    try:
        data = request.json
        # Prompt
        prompt = f"""
        Rédige une annonce immobilière très vendeuse et professionnelle (avec des emojis) pour ce bien en France :
        - Type : {data.get('type', 'Bien immobilier')}
        - Adresse/Quartier : {data.get('adresse', 'Paris')}
        - Prix : {data.get('prix', 'Nous consulter')} €
        - Surface : {data.get('surface', 'Non précisée')} m²
        - Pièces : {data.get('pieces', 'Non précisé')}
        
        Adopte un ton d'agent immobilier de prestige à la française : élégant, professionnel et persuasif.
        Structure l'annonce avec : Accroche, Description, Points Forts, Appel à l'action.
        Mentionne les atouts du quartier si possible.
        """

        # Appel CORRIGÉ (utilise client.chat... et non openai.Chat...)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Tu es un expert en copywriting immobilier."},
                {"role": "user", "content": prompt}
            ]
        )

        # Récupération réponse CORRIGÉE
        texte_genere = response.choices[0].message.content
        
        return jsonify({'text': texte_genere})

    except Exception as e:
        # Erreur CORRIGÉE (utilise Exception générique)
        print(f"Erreur CRITIQUE OpenAI: {e}") 
        return jsonify({'error': str(e), 'text': "Erreur lors de la génération."}), 500

@app.route('/api/debug/reset-db', methods=['GET'])
def reset_database():
    try:
        with app.app_context():
            # ATTENTION : Ceci efface tout et recrée les tables à neuf
            db.drop_all()
            db.create_all()
        return jsonify({'message': 'Base de données réinitialisée et mise à jour avec succès !'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
    # --- ROUTE DE SECOURS POUR RÉPARER LA BASE DE DONNÉES ---
@app.route('/api/debug/reset-db', methods=['GET'])
def reset_database():
    try:
        with app.app_context():
            # 1. On efface tout (Drop)
            db.drop_all()
            # 2. On recrée tout avec les NOUVELLES colonnes (Create)
            db.create_all()
        return jsonify({'message': 'Base de données réparée ! Colonne statut_crm ajoutée.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500