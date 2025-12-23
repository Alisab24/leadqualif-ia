"""
Modèles de base de données SQLAlchemy
Définit la structure des tables de la base de données
"""

from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import random

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """
    Modèle pour la table Users
    Gère l'authentification des agents immobiliers
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Lead(db.Model):
    """
    Modèle pour la table Leads
    Stocke les informations des leads qualifiés par l'IA
    """
    __tablename__ = 'leads'
    
    id = db.Column(db.Integer, primary_key=True)
    nom_client = db.Column(db.String(200), nullable=False)
    email_client = db.Column(db.String(200), nullable=False)
    telephone = db.Column(db.String(20), nullable=True)
    adresse_bien_interesse = db.Column(db.String(500), nullable=True)
    score_qualification_ia = db.Column(db.Integer, nullable=False, default=0)
    recommandation_ia = db.Column(db.String(500), nullable=True)
    statut_rdv = db.Column(db.String(50), nullable=False, default='Non Plannifié')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Lead {self.id}: {self.nom_client} - Score: {self.score_qualification_ia}>'
    
    def to_dict(self):
        """Convertit l'objet Lead en dictionnaire pour l'API JSON"""
        return {
            'id': self.id,
            'nom_client': self.nom_client,
            'email_client': self.email_client,
            'telephone': self.telephone,
            'adresse_bien_interesse': self.adresse_bien_interesse,
            'score_qualification_ia': self.score_qualification_ia,
            'recommandation_ia': self.recommandation_ia,
            'statut_rdv': self.statut_rdv,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def calculer_score_qualification_ia(donnees):
        """
        Calcule le score de qualification IA basé sur les critères du lead
        
        Critères de scoring :
        - DPE A ou B : +3 points (score 9-10)
        - Prix > 500k : +2 points
        - Téléphone fourni : +1 point
        - Sinon : score aléatoire entre 1 et 7
        
        Args:
            donnees (dict): Dictionnaire contenant les données du lead
                - dpe: String (optionnel) - Diagnostic de Performance Énergétique
                - prix: String ou Integer (optionnel) - Prix du bien
                - telephone: String (optionnel) - Numéro de téléphone
        
        Returns:
            int: Score de qualification entre 1 et 10
        """
        score = 0
        
        # Critère 1 : DPE A ou B = score élevé (9-10)
        dpe = donnees.get('dpe', '').upper().strip()
        if dpe in ['A', 'B']:
            score = random.randint(9, 10)
            return score
        
        # Critère 2 : Prix > 500k = bonus de +2 points
        prix_str = str(donnees.get('prix', '0')).replace(' ', '').replace('€', '').replace(',', '')
        try:
            prix = int(prix_str)
            if prix > 500000:
                score += 2
        except (ValueError, TypeError):
            pass
        
        # Critère 3 : Téléphone fourni = bonus de +1 point
        if donnees.get('telephone') and len(str(donnees.get('telephone', '')).strip()) > 0:
            score += 1
        
        # Score de base aléatoire entre 1 et 7
        score_base = random.randint(1, 7)
        score_final = min(score_base + score, 10)  # Limiter à 10 maximum
        
        return max(score_final, 1)  # S'assurer que le score est au moins 1
    
    @staticmethod
    def generer_recommandation_ia(score):
        """
        Génère une recommandation basée sur le score de qualification
        
        Args:
            score (int): Score de qualification (1-10)
        
        Returns:
            str: Recommandation pour l'agent
        """
        if score >= 9:
            return 'Lead TRÈS CHAUD : Appeler immédiatement, potentiel mandat élevé. Priorité absolue.'
        elif score >= 8:
            return 'Lead CHAUD : Contacter dans les 24h, bon potentiel de conversion. Planifier un RDV rapidement.'
        elif score >= 6:
            return 'Lead TIÈDE : Email de suivi personnalisé recommandé. Relancer dans 48h si pas de réponse.'
        elif score >= 4:
            return 'Lead FROID : Email de suivi automatique. Ajouter à la campagne de nurturing.'
        else:
            return 'Lead TRÈS FROID : Email de suivi automatique uniquement. Faible priorité.'


