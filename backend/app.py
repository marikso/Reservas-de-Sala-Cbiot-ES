from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_session import Session
from config import Config
from database import db
from models import Sala, Reserva
from datetime import datetime, time, date
from sqlalchemy import and_
from functools import wraps

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=['http://localhost:5173'], supports_credentials=True)
Session(app)
db.init_app(app)

# Decorator para rotas administrativas
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin'):
            return jsonify({'erro': 'Acesso não autorizado'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------- FUNÇÕES AUXILIARES ----------
def parse_date(data_str):
    """Converte string YYYY-MM-DD para objeto date."""
    return datetime.strptime(data_str, '%Y-%m-%d').date()

def parse_time(time_str):
    """Converte string HH:MM para objeto time."""
    return datetime.strptime(time_str, '%H:%M').time()

def validate_business_hours(data, hora_inicio, hora_fim):
    """Valida data e horário conforme regras de negócio."""
    hoje = date.today()
    if data < hoje:
        return 'Não é possível reservar para datas já passadas'
    if data == hoje:
        agora = datetime.now().time()
        if hora_inicio < agora:
            return 'Não é possível reservar para um horário que já passou hoje'
    if hora_inicio.minute != 0 or hora_fim.minute != 0:
        return 'Reservas devem começar e terminar na hora cheia'
    if hora_inicio >= hora_fim:
        return 'Hora de início deve ser anterior à hora de fim'
    if hora_inicio < time(8,0) or hora_inicio >= time(19,0) or hora_fim > time(19,0):
        return 'Reservas só podem ocorrer entre 08:00 e 19:00'
    return None

# ---------- ROTAS PÚBLICAS ----------
@app.route('/api/salas', methods=['GET'])
def get_salas():
    """Lista todas as salas ordenadas por nome."""
    salas = Sala.query.order_by(Sala.nome).all()
    return jsonify([s.to_dict() for s in salas])

@app.route('/api/reservas', methods=['GET'])
def get_reservas():
    """Lista reservas com filtros opcionais (sala_id, data)."""
    sala_id = request.args.get('sala_id', type=int)
    data_str = request.args.get('data')
    query = Reserva.query
    if sala_id:
        query = query.filter_by(sala_id=sala_id)
    if data_str:
        try:
            query = query.filter_by(data=parse_date(data_str))
        except ValueError:
            return jsonify({'erro': 'Formato de data inválido'}), 400
    reservas = query.order_by(Reserva.data, Reserva.hora_inicio).all()
    return jsonify([r.to_dict() for r in reservas])

@app.route('/api/reservas', methods=['POST'])
def create_reserva():
    """Cria uma nova reserva (usuário comum)."""
    dados = request.get_json()
    obrigatorios = ['sala_id', 'titulo', 'data', 'hora_inicio', 'hora_fim', 'responsavel']
    if not all(c in dados for c in obrigatorios):
        return jsonify({'erro': 'Campos obrigatórios faltando'}), 400
    try:
        data_res = parse_date(dados['data'])
        hora_ini = parse_time(dados['hora_inicio'])
        hora_fim = parse_time(dados['hora_fim'])
    except ValueError:
        return jsonify({'erro': 'Formato inválido de data ou hora'}), 400

    erro = validate_business_hours(data_res, hora_ini, hora_fim)
    if erro:
        return jsonify({'erro': erro}), 400

    # Verifica sobreposição de horário
    conflito = Reserva.query.filter(
        and_(
            Reserva.sala_id == dados['sala_id'],
            Reserva.data == data_res,
            Reserva.hora_inicio < hora_fim,
            Reserva.hora_fim > hora_ini
        )
    ).first()
    if conflito:
        return jsonify({'erro': 'Conflito de horário: sala já reservada neste período'}), 400

    nova = Reserva(
        sala_id=dados['sala_id'],
        titulo=dados['titulo'],
        data=data_res,
        hora_inicio=hora_ini,
        hora_fim=hora_fim,
        responsavel=dados['responsavel'],
        email=dados.get('email', ''),
        descricao=dados.get('descricao', '')
    )
    db.session.add(nova)
    db.session.commit()
    return jsonify(nova.to_dict()), 201

@app.route('/api/disponibilidade', methods=['GET'])
def disponibilidade():
    """Retorna blocos de 1 hora (08:00-19:00) com status ocupado/livre."""
    sala_id = request.args.get('sala_id', type=int)
    data_str = request.args.get('data')
    if not sala_id or not data_str:
        return jsonify({'erro': 'sala_id e data obrigatórios'}), 400
    try:
        data_res = parse_date(data_str)
    except ValueError:
        return jsonify({'erro': 'Formato de data inválido'}), 400

    sala = Sala.query.get_or_404(sala_id)
    reservas = Reserva.query.filter_by(sala_id=sala_id, data=data_res).all()

    # Converte reservas para minutos desde meia-noite
    ocupados_min = [(r.hora_inicio.hour*60 + r.hora_inicio.minute,
                     r.hora_fim.hour*60 + r.hora_fim.minute) for r in reservas]

    horarios = []
    for i in range(8, 19):          # i = hora de início do bloco (8..18)
        inicio_min = i * 60
        fim_min = (i+1) * 60
        ocupado = any(inicio_min >= r_ini and fim_min <= r_fim for r_ini, r_fim in ocupados_min)
        horarios.append({
            'hora_inicio': f'{i:02d}:00',
            'hora_fim': f'{i+1:02d}:00',
            'ocupado': ocupado,
            'titulo': 'Reservado' if ocupado else ''
        })
    return jsonify({
        'sala_nome': sala.nome,
        'data': data_str,
        'horarios': horarios
    })

# ---------- ROTAS ADMIN ----------
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Login do administrador (cria sessão)."""
    dados = request.get_json()
    if dados.get('senha') == app.config['ADMIN_PASSWORD']:
        session['admin'] = True
        return jsonify({'sucesso': True})
    return jsonify({'erro': 'Senha inválida'}), 401

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    """Logout: remove flag de admin da sessão."""
    session.pop('admin', None)
    return jsonify({'sucesso': True})

@app.route('/api/salas', methods=['POST'])
@admin_required
def create_sala():
    """Cria uma nova sala (somente admin)."""
    dados = request.get_json()
    if not dados or not dados.get('nome'):
        return jsonify({'erro': 'Nome obrigatório'}), 400
    if Sala.query.filter_by(nome=dados['nome']).first():
        return jsonify({'erro': 'Sala já existe'}), 400
    sala = Sala(nome=dados['nome'])
    db.session.add(sala)
    db.session.commit()
    return jsonify(sala.to_dict()), 201

@app.route('/api/salas/<int:sala_id>', methods=['DELETE'])
@admin_required
def delete_sala(sala_id):
    """Remove uma sala (somente admin)."""
    sala = Sala.query.get_or_404(sala_id)
    db.session.delete(sala)
    db.session.commit()
    return jsonify({'mensagem': 'Sala deletada'})

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
@admin_required
def delete_reserva(reserva_id):
    """Cancela uma reserva (somente admin)."""
    reserva = Reserva.query.get_or_404(reserva_id)
    db.session.delete(reserva)
    db.session.commit()
    return jsonify({'mensagem': 'Reserva cancelada'})

# ---------- INICIALIZAÇÃO ----------
with app.app_context():
    db.create_all()      # Cria as tabelas se não existirem

if __name__ == '__main__':
    app.run(debug=True, port=5000)