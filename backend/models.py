from database import db
from datetime import datetime

class Sala(db.Model):
    __tablename__ = 'salas'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False, unique=True)
    bloco = db.Column(db.String(20))
    andar = db.Column(db.String(10))
    capacidade = db.Column(db.Integer)
    equipamentos = db.Column(db.Text)
    avisos = db.Column(db.Text)          # opcional

    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'bloco': self.bloco,
            'andar': self.andar,
            'capacidade': self.capacidade,
            'equipamentos': self.equipamentos,
            'avisos': self.avisos,
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
    grupo_id = db.Column(db.String(36), nullable=True, index=True)   # UUID do grupo recorrente

    sala = db.relationship('Sala', backref=db.backref('reservas', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'sala_id': self.sala_id,
            'sala_nome': self.sala.nome,
            'titulo': self.titulo,
            'data': self.data.isoformat(),
            'hora_inicio': self.hora_inicio.strftime('%H:%M'),
            'hora_fim': self.hora_fim.strftime('%H:%M'),
            'responsavel': self.responsavel,
            'email': self.email,
            'descricao': self.descricao,
            'grupo_id': self.grupo_id,
        }