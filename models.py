from database import db
from datetime import datetime

class Sala(db.Model):
    __tablename__ = 'salas'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False, unique=True)

    reservas = db.relationship('Reserva', backref='sala', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome
        }

class Reserva(db.Model):
    __tablename__ = 'reservas'

    id = db.Column(db.Integer, primary_key=True)
    sala_id = db.Column(db.Integer, db.ForeignKey('salas.id'), nullable=False)
    titulo = db.Column(db.String(100), nullable=False)
    data = db.Column(db.Date, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fim = db.Column(db.Time, nullable=False)
    responsavel = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    descricao = db.Column(db.Text)
    criada_em = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'sala_id': self.sala_id,
            'sala_nome': self.sala.nome,
            'titulo': self.titulo,
            'data': self.data.isoformat(),
            'hora_inicio': self.hora_inicio.isoformat(),
            'hora_fim': self.hora_fim.isoformat(),
            'responsavel': self.responsavel,
            'email': self.email,
            'descricao': self.descricao
        }
