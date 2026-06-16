from database import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class Sala(db.Model):
    __tablename__ = 'salas'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False, unique=True)
    bloco = db.Column(db.String(20))
    andar = db.Column(db.String(10))
    capacidade = db.Column(db.Integer)
    equipamentos = db.Column(db.Text)
    avisos = db.Column(db.Text)

    reservas = db.relationship('Reserva', backref='sala', cascade='all, delete-orphan')
    manutencoes = db.relationship('Manutencao', backref='sala', cascade='all, delete-orphan')

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
    responsavel = db.Column(db.String(100), nullable=False)   # solicitante
    email = db.Column(db.String(100))
    descricao = db.Column(db.Text)
    # default=datetime.utcnow (sem parênteses): SQLAlchemy chama a função no momento do INSERT,
    # não na definição da classe — garante timestamp correto para cada registro criado.
    criada_em = db.Column(db.DateTime, default=datetime.utcnow)
    grupo_id = db.Column(db.String(36), nullable=True, index=True)
    status = db.Column(db.String(20), nullable=False, default='aprovada')  # pendente, aprovada, rejeitada
    aprovador = db.Column(db.String(100), nullable=True)       # quem aprovou/rejeitou
    data_aprovacao = db.Column(db.DateTime, nullable=True)
    notificacoes = db.relationship('Notificacao', back_populates='reserva', cascade='all, delete-orphan')

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
            'status': self.status,
            'aprovador': self.aprovador,
            'data_aprovacao': self.data_aprovacao.isoformat() + 'Z' if self.data_aprovacao else None,
        }

class Manutencao(db.Model):
    __tablename__ = 'manutencoes'
    id = db.Column(db.Integer, primary_key=True)
    sala_id = db.Column(db.Integer, db.ForeignKey('salas.id'), nullable=False)
    data_inicio = db.Column(db.Date, nullable=False)
    data_fim = db.Column(db.Date, nullable=False)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fim = db.Column(db.Time, nullable=False)
    motivo = db.Column(db.String(200), nullable=False)
    criada_em = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'sala_id': self.sala_id,
            'sala_nome': self.sala.nome,
            'data_inicio': self.data_inicio.isoformat(),
            'data_fim': self.data_fim.isoformat(),
            'hora_inicio': self.hora_inicio.strftime('%H:%M'),
            'hora_fim': self.hora_fim.strftime('%H:%M'),
            'motivo': self.motivo,
        }

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    nome = db.Column(db.String(150), nullable=False)
    cargo = db.Column(db.String(50), nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pendente')

    notificacoes = db.relationship('Notificacao', back_populates='usuario', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    VALID_ROLES = {'admin', 'gerente', 'lider_de_grupo', 'usuario_cbiot'}

    def to_dict(self, include_status=True):
        data = {
            'id': self.id,
            'email': self.email,
            'nome': self.nome,
            'cargo': self.cargo if self.cargo in self.VALID_ROLES else 'usuario_cbiot',
        }
        if include_status:
            data['status'] = self.status
        return data
    
class Notificacao(db.Model):
    __tablename__ = 'notificacoes'
    # extend_existing=True evita erro se o modelo for importado mais de uma vez no mesmo contexto.
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    usuario_email = db.Column(db.String(120), db.ForeignKey('users.email'), nullable=False)
    mensagem = db.Column(db.Text, nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    reserva_id = db.Column(db.Integer, db.ForeignKey('reservas.id', ondelete='CASCADE'), nullable=True)
    lida = db.Column(db.Boolean, default=False)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

    usuario = db.relationship('User', back_populates='notificacoes')
    reserva = db.relationship('Reserva', back_populates='notificacoes')

    def to_dict(self):
        return {
            'id': self.id,
            'mensagem': self.mensagem,
            'tipo': self.tipo,
            'reservaId': self.reserva_id,
            'lida': self.lida,
            'data': self.data_criacao.isoformat() + 'Z'
        }