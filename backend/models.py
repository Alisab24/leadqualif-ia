from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100))        # ✅ DOIT ÊTRE 'nom'
    email = db.Column(db.String(100))
    telephone = db.Column(db.String(20))
    type_bien = db.Column(db.String(200))  # Contiendra l'adresse
    budget = db.Column(db.Integer)         # Contiendra le prix
    score_ia = db.Column(db.Integer)
    statut = db.Column(db.String(50), default="Nouveau")