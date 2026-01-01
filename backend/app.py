"""
Application Flask principale pour LeadQualif IA
Version UNIFIÉE - Déploiement SaaS (Render + Vercel)
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from models import db, Lead, User
import openai

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 0.5. CORRECTION URL DATABASE POUR RENDER (sécurité supplémentaire)
    database_url = os.environ.get('DATABASE_URL')
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    
    # 1. Initialiser la base de données
    db.init_app(app)
    
    # 2. Initialiser Flask-Login (Pour l'accès Agent)
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # 3. SOLUTION CORS RADICALE : Autorise TOUTES les origines
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # 3.1 Configuration OpenAI
    openai.api_key = os.environ.get("OPENAI_API_KEY")
    
    # 4. Création des Tables et User au démarrage
    with app.app_context():
        db.create_all()
        # Création de l'utilisateur agent par défaut
        if not User.query.filter_by(username='agent01').first():
            u = User(username='agent01', password_hash=generate_password_hash('secretpass'))
            db.session.add(u)
            db.session.commit()
            print("✅ User 'agent01' créé.")

    # ==========================================
    # ROUTES API
    # ==========================================

    @app.route('/')
    def index():
        return jsonify({"status": "online", "message": "Cerveau LeadQualif IA prêt"}), 200

    # --- Login Agent ---
    @app.route('/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data: return jsonify({'message': 'Aucune donnée'}), 400
        
        user = User.query.filter_by(username=data.get('username')).first()
        if user and check_password_hash(user.password_hash, data.get('password')):
            login_user(user, remember=True)
            return jsonify({'status': 'success', 'user': {'username': user.username}}), 200
        return jsonify({'message': 'Identifiants incorrects'}), 401

    # --- Réception Formulaire Client (Public) ---
    @app.route('/api/submit-lead', methods=['POST', 'OPTIONS'])
    def submit_lead():
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        try:
            data = request.json
            # Calcul du Score IA simple
            prix = int(data.get('prix') or data.get('budget') or 0)
            score = 9 if prix > 400000 else 5
            
            # Création du lead avec gestion des alias de clés (nom/name, adresse/location)
            nouveau_lead = Lead(
                nom=data.get('nom') or data.get('name'),
                email=data.get('email'),
                telephone=data.get('telephone') or data.get('phone'),
                type_bien=data.get('adresse') or data.get('location'), 
                budget=prix,
                score_ia=score, 
                statut="Nouveau"
            )
            db.session.add(nouveau_lead)
            db.session.commit()
            return jsonify({"status": "success", "score": score}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # --- Générateur d'Annonces avec OpenAI ---
    @app.route('/api/generate-annonce', methods=['POST', 'OPTIONS'])
    def generate_annonce():
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
            
        try:
            data = request.json
            if not data:
                return jsonify({'error': 'Aucune donnée reçue'}), 400
            
            # Récupération des données
            type_bien = data.get('type', 'appartement')
            adresse = data.get('adresse', '')
            prix = data.get('prix', '')
            surface = data.get('surface', '')
            pieces = data.get('pieces', '')
            
            # Vérification de la clé API
            if not openai.api_key:
                return jsonify({'error': 'Clé API OpenAI non configurée'}), 500
            
            # Création du prompt pour OpenAI
            prompt = f"""
Génère une annonce immobilière professionnelle et vendeuse basée sur les informations suivantes :

- Type de bien : {type_bien}
- Adresse : {adresse}
- Prix : {prix}€
- Surface : {surface} m²
- Nombre de pièces : {pieces}

Instructions :
- Style professionnel et attractif
- Utilise des emojis appropriés (🏠, ✨, 📍, 💰, etc.)
- Structure claire avec paragraphes
- Met en avant les points forts
- Appel à l'action clair
- Environ 200-300 mots maximum
"""

            # Appel à l'API OpenAI
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "Tu es un expert en rédaction d'annonces immobilières professionnelles et percutantes."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            annonce_generee = response.choices[0].message.content.strip()
            
            return jsonify({
                'success': True,
                'annonce': annonce_generee
            }), 200
            
        except openai.error.OpenAIError as e:
            return jsonify({'error': f'Erreur OpenAI: {str(e)}'}), 500
        except Exception as e:
            return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

    # --- Dashboard Agent (Privé) ---
    @app.route('/api/leads-chauds', methods=['GET'])
    def get_leads():
        try:
            # Récupère les leads triés par score IA
            leads = Lead.query.order_by(Lead.score_ia.desc()).all()
            leads_data = [{
                'id': l.id, 
                'nom': l.nom, 
                'email': l.email, 
                'telephone': l.telephone,      # <--- AJOUT CRUCIAL (Il manquait ça)
                'type_bien': l.type_bien,      # <--- AJOUT CRUCIAL (Pour l'adresse)
                'score_ia': l.score_ia, 
                'statut': l.statut, 
                'budget': l.budget
            } for l in leads]

            return jsonify({
                'status': 'success',
                'data': {
                    'leads_chauds': leads_data,
                    'total_leads': len(leads)
                }
            }), 200
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500

    return app

# ==========================================
# LANCEMENT (CRITIQUE POUR RENDER)
# ==========================================

# On initialise 'app' au niveau global pour que Gunicorn le trouve
app = create_app()

if __name__ == '__main__':
    # Render définit automatiquement le PORT
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)