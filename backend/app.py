"""
Application Flask principale pour LeadQualif IA
Port configuré : 5005 (pour éviter les blocages du 5000)
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from models import db, Lead, User

def create_app(config_class=Config):
    """Factory function pour créer l'application Flask"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 1. Initialiser la base de données
    db.init_app(app)
    
    # 2. Initialiser Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = '/login'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'status': 'error', 'message': 'Authentification requise.'}), 401
    
    # 3. Configuration CORS (Autorise tout pour éviter les blocages entre 5173 et 5005)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
    # 4. Création des Tables et User au démarrage
    with app.app_context():
        db.create_all()
        create_default_user()

    # ==========================================
    # ROUTES API
    # ==========================================

    @app.route('/')
    def index():
        return jsonify({'message': 'Serveur LeadQualif IA Actif sur le Port 5005'})

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

    # --- Réception Formulaire Client ---
    @app.route('/api/submit-lead', methods=['POST'])
    def submit_lead():
        try:
            data = request.json
            print(f"📥 Lead reçu sur le port 5005 : {data.get('email')}")

            # Calcul du Score IA
            prix = int(data.get('prix', 0))
            adresse = data.get('adresse', '') or data.get('adresse_bien_interesse', '')
            score = 5
            reco = "À traiter."

            if prix > 400000:
                score = 9
                reco = "🔥 LEAD CHAUD : Gros budget."
            elif "Paris" in adresse:
                score = 8
                reco = "Localisation Premium."

            # Enregistrement DB (Note : on utilise score_ia)
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
            
            return jsonify({
                "message": "Dossier reçu",
                "score": score, 
                "recommandation_ia": reco,
                "lead_chaud": score >= 8
            }), 200
        except Exception as e:
            print(f"ERREUR: {e}")
            return jsonify({"message": f"Erreur serveur: {str(e)}"}), 500

    # --- Dashboard Agent ---
    @app.route('/api/leads-chauds', methods=['GET'])
    def dashboard_data():
        try:
            # Récupère les leads triés par score IA
            leads = Lead.query.order_by(Lead.score_ia.desc()).limit(50).all()
            leads_data = [{
                'id': l.id, 'nom': l.nom, 'email': l.email, 
                'score_ia': l.score_ia, 'statut': l.statut, 'budget': l.budget
            } for l in leads]

            return jsonify({
                'status': 'success',
                'data': {
                    'leads_chauds': leads_data,
                    'count_leads_chauds': len([l for l in leads if l.score_ia >= 8]),
                    'total_leads': len(leads)
                }
            }), 200
        except Exception as e:
            return jsonify({'message': str(e)}), 500

    return app

def create_default_user():
    try:
        if not User.query.filter_by(username='agent01').first():
            u = User(username='agent01', password_hash=generate_password_hash('secretpass'))
            db.session.add(u)
            db.session.commit()
            print("✅ User 'agent01' créé.")
    except Exception as e:
        print(f"Info DB: {e}")

import os # <--- TRÈS IMPORTANT : Doit être présent en haut du fichier

# ... (votre code précédent) ...

if __name__ == '__main__':
    app = create_app()
    # Render définit automatiquement une variable "PORT"
    # Si elle n'existe pas (en local), on utilise 5000
    port = int(os.environ.get("PORT", 5000))
    
    # host='0.0.0.0' est OBLIGATOIRE sur Render
    app.run(host='0.0.0.0', port=port)


    import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from models import db, Lead # Assurez-vous que models.py est correct

def create_app():
    app = Flask(__name__)
    # Configuration de la DB (SQLite pour la simplicité du SaaS au début)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///leadqualif.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)

    # 🔥 SOLUTION CORS RADICALE : Autorise TOUT sans exception
    CORS(app, resources={r"/*": {"origins": "*"}})

    with app.app_context():
        db.create_all()

    @app.route('/')
    def health():
        return jsonify({"status": "online", "message": "Cerveau IA prêt"}), 200

    @app.route('/api/submit-lead', methods=['POST', 'OPTIONS'])
    def submit_lead():
        if request.method == 'OPTIONS': # Pour la sécurité des navigateurs
            return jsonify({'status': 'ok'}), 200
        try:
            data = request.json
            # On récupère les données peu importe le nom de la clé
            nouveau_lead = Lead(
                nom=data.get('nom') or data.get('name'),
                email=data.get('email'),
                telephone=data.get('telephone') or data.get('phone'),
                type_bien=data.get('adresse') or data.get('location'),
                budget=int(data.get('prix') or data.get('budget') or 0),
                score_ia=9 if int(data.get('prix') or 0) > 400000 else 5,
                statut="Nouveau"
            )
            db.session.add(nouveau_lead)
            db.session.commit()
            return jsonify({"status": "success"}), 200
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    @app.route('/api/leads-chauds', methods=['GET'])
    def get_leads():
        try:
            leads = Lead.query.all()
            return jsonify({
                "status": "success",
                "data": {"leads_chauds": [
                    {"id": l.id, "nom": l.nom, "score_ia": l.score_ia} for l in leads
                ]}
            }), 200
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)