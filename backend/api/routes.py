"""
Routes API pour LeadQualif IA
Gère les endpoints pour soumettre des leads, récupérer les données, etc.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash
from models import db, Lead, User
from datetime import datetime

api_bp = Blueprint('api', __name__)


@api_bp.route('/login', methods=['POST'])
def login():
    """Endpoint pour l'authentification de l'agent immobilier.
    
    Reçoit le nom d'utilisateur et le mot de passe depuis le Front-End,
    vérifie les identifiants et connecte l'utilisateur si réussi.
    
    Body JSON attendu :
    {
        "username": "string",
        "password": "string"
    }
    
    Retourne :
    {
        "status": "success" | "error",
        "message": "string",
        "user": {
            "id": integer,
            "username": "string"
        } (si succès)
    }
    """
    try:
        # Récupérer les données JSON du body
        data = request.get_json()
        
        # Validation des champs requis
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Aucune donnée fournie'
            }), 400
        
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({
                'status': 'error',
                'message': 'Le nom d\'utilisateur et le mot de passe sont requis'
            }), 400
        
        # Rechercher l'utilisateur dans la base de données
        user = User.query.filter_by(username=username).first()
        
        # Vérifier si l'utilisateur existe et si le mot de passe est correct
        if user and check_password_hash(user.password_hash, password):
            # Connecter l'utilisateur
            login_user(user, remember=True)
            
            return jsonify({
                'status': 'success',
                'message': 'Connexion réussie',
                'user': {
                    'id': user.id,
                    'username': user.username
                }
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': 'Nom d\'utilisateur ou mot de passe incorrect'
            }), 401
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la connexion: {str(e)}"
        }), 500


@api_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Endpoint pour déconnecter l'utilisateur."""
    try:
        logout_user()
        return jsonify({
            'status': 'success',
            'message': 'Déconnexion réussie'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la déconnexion: {str(e)}"
        }), 500


@api_bp.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    """Endpoint protégé pour accéder au tableau de bord.
    
    Retourne les données du dashboard (leads chauds, statistiques, etc.)
    Nécessite une authentification via Flask-Login.
    
    Retourne :
    {
        "status": "success",
        "user": {
            "id": integer,
            "username": "string"
        },
        "data": {
            "leads_chauds": [...],
            "total_leads": integer,
            "stats": {...}
        }
    }
    """
    try:
        # Récupérer les leads chauds (score >= 8)
        leads_chauds = (
            Lead.query
            .filter(Lead.score_qualification_ia >= 8)
            .order_by(Lead.score_qualification_ia.desc())
            .all()
        )
        
        # Récupérer tous les leads pour les statistiques
        total_leads = Lead.query.count()
        
        # Convertir les leads en dictionnaires
        leads_data = [lead.to_dict() for lead in leads_chauds]
        
        return jsonify({
            'status': 'success',
            'message': 'Données du tableau de bord récupérées avec succès',
            'user': {
                'id': current_user.id,
                'username': current_user.username
            },
            'data': {
                'leads_chauds': leads_data,
                'total_leads': total_leads,
                'count_leads_chauds': len(leads_data),
                'stats': {
                    'leads_chauds': len(leads_data),
                    'total_leads': total_leads,
                    'taux_chauds': round((len(leads_data) / total_leads * 100) if total_leads > 0 else 0, 2)
                }
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la récupération des données du dashboard: {str(e)}"
        }), 500


@api_bp.route('/submit-lead', methods=['POST'])
def submit_lead():
    """Endpoint pour soumettre un nouveau lead.

    Reçoit les données du formulaire, crée une entrée dans la DB,
    génère un score de qualification simulé et prépare la réponse IA
    immédiate pour le client.

    Body JSON attendu :
    {
        "nom_client": "string",
        "email_client": "string",
        "telephone": "string (optionnel)",
        "adresse_bien_interesse": "string (optionnel)",
        "dpe": "string (optionnel) - Ex: 'A', 'B', 'C', etc.",
        "prix": "string ou integer (optionnel) - Prix du bien"
    }
    """
    try:
        # Récupérer les données JSON du body
        data = request.get_json()

        # Validation des champs requis
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Aucune donnée fournie'
            }), 400

        if not data.get('nom_client'):
            return jsonify({
                'status': 'error',
                'message': 'Le champ "nom_client" est requis'
            }), 400

        if not data.get('email_client'):
            return jsonify({
                'status': 'error',
                'message': 'Le champ "email_client" est requis'
            }), 400

        # Calculer le score de qualification IA basé sur les critères
        score_qualification = Lead.calculer_score_qualification_ia({
            'dpe': data.get('dpe', ''),
            'prix': data.get('prix', ''),
            'telephone': data.get('telephone', '')
        })

        # Générer la recommandation IA interne (pour l'agent) basée sur le score
        recommandation_ia = Lead.generer_recommandation_ia(score_qualification)

        # Déterminer le commentaire immédiat pour le client
        # et simuler la planification automatique de RDV pour les leads chauds
        lead_chaud = score_qualification >= 8
        if lead_chaud:
            commentaire_client_ia = (
                "Félicitations ! Votre bien est de haute valeur. "
                "Un expert va vous contacter d'ici 1 heure."
            )
            statut_rdv_initial = 'RDV Auto Plannifié'
            # Simulation simple d'un créneau proposé pour le RDV
            rdv_suggerer = 'Demain, 14h00'
        else:
            commentaire_client_ia = (
                "Merci. Nous analysons votre demande. "
                "Un email de suivi sera envoyé sous 24h."
            )
            statut_rdv_initial = 'Non Plannifié'
            rdv_suggerer = None

        # Créer une nouvelle entrée Lead dans la base de données
        nouveau_lead = Lead(
            nom_client=data.get('nom_client'),
            email_client=data.get('email_client'),
            telephone=data.get('telephone', ''),
            adresse_bien_interesse=data.get('adresse_bien_interesse', ''),
            score_qualification_ia=score_qualification,
            recommandation_ia=recommandation_ia,
            statut_rdv=statut_rdv_initial
        )

        # Sauvegarder dans la base de données
        db.session.add(nouveau_lead)
        db.session.commit()

        # Retourner la réponse avec le lead créé, incluant :
        # - le score
        # - la recommandation interne
        # - le commentaire client IA
        # - le RDV suggéré si lead chaud
        lead_data = nouveau_lead.to_dict()
        return jsonify({
            'status': 'success',
            'message': 'Lead créé avec succès et qualifié par l\'IA',
            'data': lead_data,
            'score_ia': score_qualification,
            'recommandation_ia': recommandation_ia,
            'commentaire_client_ia': commentaire_client_ia,
            'lead_chaud': lead_chaud,
            'rdv_suggerer': rdv_suggerer
        }), 201

    except Exception as e:
        # En cas d'erreur, annuler la transaction
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la création du lead: {str(e)}"
        }), 500


@api_bp.route('/get-leads', methods=['GET'])
def get_leads():
    """Endpoint pour récupérer tous les leads.

    Retourne la liste de tous les leads avec leurs scores de qualification.
    """
    try:
        # Récupérer tous les leads, triés par date de création (plus récents en premier)
        leads = Lead.query.order_by(Lead.created_at.desc()).all()

        # Convertir en liste de dictionnaires
        leads_data = [lead.to_dict() for lead in leads]

        return jsonify({
            'status': 'success',
            'count': len(leads_data),
            'data': leads_data
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la récupération des leads: {str(e)}"
        }), 500


@api_bp.route('/get-leads-chauds', methods=['GET'])
def get_leads_chauds():
    """Endpoint pour récupérer uniquement les leads chauds (score >= 8).

    Utilisé pour alimenter le tableau de bord.
    """
    try:
        # Récupérer les leads avec un score >= 8
        leads_chauds = (
            Lead.query
            .filter(Lead.score_qualification_ia >= 8)
            .order_by(Lead.score_qualification_ia.desc())
            .all()
        )

        # Convertir en liste de dictionnaires
        leads_data = [lead.to_dict() for lead in leads_chauds]

        return jsonify({
            'status': 'success',
            'count': len(leads_data),
            'data': leads_data
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la récupération des leads chauds: {str(e)}"
        }), 500


@api_bp.route('/leads-chauds', methods=['GET'])
def leads_chauds():
    """Alias de /get-leads-chauds pour une URL plus courte.

    Utilisé pour alimenter le tableau de bord avec les leads chauds (score >= 8).
    """
    try:
        # Récupérer les leads avec un score >= 8
        leads_chauds = (
            Lead.query
            .filter(Lead.score_qualification_ia >= 8)
            .order_by(Lead.score_qualification_ia.desc())
            .all()
        )

        # Convertir en liste de dictionnaires
        leads_data = [lead.to_dict() for lead in leads_chauds]

        return jsonify({
            'status': 'success',
            'count': len(leads_data),
            'data': leads_data
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la récupération des leads chauds: {str(e)}"
        }), 500


@api_bp.route('/planifier-rdv', methods=['POST'])
def planifier_rdv():
    """Endpoint pour planifier un RDV pour un lead.

    Simule la vérification de l'agenda et met à jour le statut du lead.

    Body JSON attendu :
    {
        "lead_id": integer - ID du lead
    }
    """
    try:
        # Récupérer les données JSON du body
        data = request.get_json()

        # Validation
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Aucune donnée fournie'
            }), 400

        lead_id = data.get('lead_id')
        if not lead_id:
            return jsonify({
                'status': 'error',
                'message': 'Le champ "lead_id" est requis'
            }), 400

        # Récupérer le lead depuis la base de données
        lead = Lead.query.get(lead_id)
        if not lead:
            return jsonify({
                'status': 'error',
                'message': f"Lead avec l'ID {lead_id} introuvable"
            }), 404

        # Simuler la vérification de l'agenda et planifier le RDV
        from datetime import timedelta

        # Trouver le prochain mercredi
        aujourdhui = datetime.now()
        jours_jusque_mercredi = (2 - aujourdhui.weekday()) % 7
        if jours_jusque_mercredi == 0 and aujourdhui.hour >= 14:
            # Si c'est déjà mercredi après 14h, prendre le mercredi suivant
            jours_jusque_mercredi = 7

        prochain_mercredi = aujourdhui + timedelta(days=jours_jusque_mercredi)
        date_rdv = prochain_mercredi.replace(hour=14, minute=0, second=0, microsecond=0)

        # Mettre à jour le statut du lead
        lead.statut_rdv = (
            f"RDV Plannifié le {date_rdv.strftime('%A %d %B')} "
            f"à {date_rdv.strftime('%Hh%M')}"
        )
        lead.updated_at = datetime.utcnow()

        # Sauvegarder dans la base de données
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'RDV planifié avec succès',
            'data': {
                'lead_id': lead.id,
                'nom_client': lead.nom_client,
                'statut_rdv': lead.statut_rdv,
                'date_rdv': date_rdv.isoformat()
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la planification du RDV: {str(e)}"
        }), 500


@api_bp.route('/get-lead/<int:lead_id>', methods=['GET'])
def get_lead(lead_id):
    """Endpoint pour récupérer un lead spécifique par son ID."""
    try:
        lead = Lead.query.get_or_404(lead_id)
        return jsonify({
            'status': 'success',
            'data': lead.to_dict()
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Erreur lors de la récupération du lead: {str(e)}"
        }), 500
