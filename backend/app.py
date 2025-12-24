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

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 1. Initialiser la base de données
    db.init_app(app)
    
    # 2. Initialiser Flask-Login (Pour l'accès Agent)
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # 3. SOLUTION CORS RADICALE : Autorise TOUT sans exception
    # Indispensable pour la communication entre Vercel et Render
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
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