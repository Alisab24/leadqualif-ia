"""
Application Flask principale pour LeadQualif IA
Configurée pour le déploiement SaaS (Render + Vercel)
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from models import db, Lead, User

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 1. Initialiser la base de données
    db.init_app(app)
    
    # 2. Initialiser Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # 3. Configuration CORS (Indispensable pour parler à Vercel)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
    # 4. Création des Tables au démarrage
    with app.app_context():
        db.create_all()
        # Créer l'utilisateur par défaut s'il n'existe pas
        if not User.query.filter_by(username='agent01').first():
            u = User(username='agent01', password_hash=generate_password_hash('secretpass'))
            db.session.add(u)
            db.session.commit()
            print("✅ User 'agent01' créé.")

    # --- ROUTES API ---

    @app.route('/')
    def index():
        return jsonify({'message': 'Serveur LeadQualif IA Actif', 'status': 'online'})

    @app.route('/api/submit-lead', methods=['POST'])
    def submit_lead():
        try:
            data = request.json
            prix = int(data.get('prix', 0))
            adresse = data.get('adresse', '')
            score = 9 if prix > 400000 else 5
            
            nouveau_lead = Lead(
                nom=data.get('nom'),
                email=data.get('email'),
                telephone=data.get('telephone'),
                type_bien=adresse, 
                budget=prix,
                score_ia=score, 
                statut="Nouveau"
            )
            db.session.add(nouveau_lead)
            db.session.commit()
            
            return jsonify({"status": "success", "score": score}), 200
        except Exception as e:
            return jsonify({"message": f"Erreur: {str(e)}"}), 500

    @app.route('/api/leads-chauds', methods=['GET'])
    def dashboard_data():
        try:
            leads = Lead.query.order_by(Lead.score_ia.desc()).limit(50).all()
            leads_data = [{
                'id': l.id, 
                'nom': l.nom, 
                'email': l.email, 
                'score_ia': l.score_ia, 
                'statut': l.statut, 
                'budget': l.budget
            } for l in leads]

            return jsonify({
                'status': 'success',
                'data': { 'leads_chauds': leads_data }
            }), 200
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500

    return app

# --- LANCEMENT (ADAPTÉ À RENDER) ---
if __name__ == '__main__':
    app = create_app()
    # On récupère le port dynamique de Render
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)