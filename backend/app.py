from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_session import Session
from config import Config
from database import db
from models import Sala, Reserva
from datetime import datetime, time, date, timedelta
from sqlalchemy import and_
from functools import wraps
import uuid

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=['http://localhost:5173'], supports_credentials=True)
Session(app)
db.init_app(app)

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin'):
            return jsonify({'erro': 'Acesso não autorizado'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------- FUNÇÕES AUXILIARES ----------
def parse_date(data_str):
    return datetime.strptime(data_str, '%Y-%m-%d').date()

def parse_time(time_str):
    return datetime.strptime(time_str, '%H:%M').time()

def validate_business_hours(data, hora_inicio, hora_fim):
    """Valida data e horário para reservas pontuais (bloqueia fins de semana)."""
    hoje = date.today()
    if data < hoje:
        return 'Não é possível reservar para datas já passadas'
    if data == hoje:
        agora = datetime.now().time()
        if hora_inicio < agora:
            return 'Não é possível reservar para um horário que já passou hoje'
    if data.weekday() in (5, 6):
        return 'Reservas não são permitidas aos sábados e domingos'
    if hora_inicio.minute not in (0, 30) or hora_fim.minute not in (0, 30):
        return 'Reservas devem começar e terminar na hora cheia ou meia hora'
    if hora_inicio >= hora_fim:
        return 'Hora de início deve ser anterior à hora de fim'
    if hora_inicio < time(8,0) or hora_inicio >= time(19,0) or hora_fim > time(19,0):
        return 'Reservas só podem ocorrer entre 08:00 e 19:00'
    return None

def validate_time_only(hora_inicio, hora_fim):
    """Valida apenas o intervalo de horário (para reservas recorrentes)."""
    if hora_inicio.minute not in (0, 30) or hora_fim.minute not in (0, 30):
        return 'Reservas devem começar e terminar na hora cheia ou meia hora'
    if hora_inicio >= hora_fim:
        return 'Hora de início deve ser anterior à hora de fim'
    if hora_inicio < time(8,0) or hora_inicio >= time(19,0) or hora_fim > time(19,0):
        return 'Reservas só podem ocorrer entre 08:00 e 19:00'
    return None

def formatReserva(row):
    return {
        'id': row.id,
        'sala_id': row.sala_id,
        'sala_nome': row.sala.nome,
        'titulo': row.titulo,
        'data': row.data.isoformat(),
        'hora_inicio': row.hora_inicio.strftime('%H:%M'),
        'hora_fim': row.hora_fim.strftime('%H:%M'),
        'responsavel': row.responsavel,
        'email': row.email,
        'descricao': row.descricao,
        'grupo_id': row.grupo_id,
    }

# ---------- ROTAS PÚBLICAS ----------
@app.route('/api/salas', methods=['GET'])
def get_salas():
    salas = Sala.query.order_by(Sala.nome).all()
    return jsonify([s.to_dict() for s in salas])

@app.route('/api/reservas', methods=['GET'])
def get_reservas():
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
    return jsonify([formatReserva(r) for r in reservas])

@app.route('/api/reservas', methods=['POST'])
def create_reserva():
    """Cria uma reserva pontual."""
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
        descricao=dados.get('descricao', ''),
        grupo_id=None   # reserva pontual não possui grupo
    )
    db.session.add(nova)
    db.session.commit()
    return jsonify(formatReserva(nova)), 201

@app.route('/api/reservas/recorrente', methods=['POST'])
@admin_required   # altere se desejar que usuários comuns também possam criar
def create_reservas_recorrentes():
    dados = request.get_json()
    obrigatorios = ['sala_id', 'titulo', 'hora_inicio', 'hora_fim', 'dias_semana',
                    'data_inicio', 'data_fim', 'responsavel']
    if not all(c in dados for c in obrigatorios):
        return jsonify({'erro': 'Campos obrigatórios faltando'}), 400

    try:
        data_inicio = parse_date(dados['data_inicio'])
        data_fim = parse_date(dados['data_fim'])
        hora_ini = parse_time(dados['hora_inicio'])
        hora_fim = parse_time(dados['hora_fim'])
        dias_semana = dados['dias_semana']
        if not isinstance(dias_semana, list) or not all(isinstance(d, int) for d in dias_semana):
            return jsonify({'erro': 'dias_semana deve ser uma lista de inteiros'}), 400
        if any(d > 4 for d in dias_semana):
            return jsonify({'erro': 'Recorrência não permitida em sábado ou domingo'}), 400
    except (ValueError, KeyError):
        return jsonify({'erro': 'Formato inválido'}), 400

    erro = validate_time_only(hora_ini, hora_fim)
    if erro:
        return jsonify({'erro': erro}), 400

    LIMITE_DIAS = 180
    if (data_fim - data_inicio).days > LIMITE_DIAS:
        return jsonify({'erro': f'O período máximo para reservas recorrentes é de {LIMITE_DIAS} dias'}), 400

    grupo_id = str(uuid.uuid4())
    reservas_criadas = []
    conflitos = []

    current_date = data_inicio
    while current_date <= data_fim:
        if current_date.weekday() in dias_semana:
            if current_date.weekday() in (5,6):
                continue
            conflito = Reserva.query.filter(
                and_(
                    Reserva.sala_id == dados['sala_id'],
                    Reserva.data == current_date,
                    Reserva.hora_inicio < hora_fim,
                    Reserva.hora_fim > hora_ini
                )
            ).first()
            if conflito:
                conflitos.append(current_date.isoformat())
            else:
                nova = Reserva(
                    sala_id=dados['sala_id'],
                    titulo=dados['titulo'],
                    data=current_date,
                    hora_inicio=hora_ini,
                    hora_fim=hora_fim,
                    responsavel=dados['responsavel'],
                    email=dados.get('email', ''),
                    descricao=dados.get('descricao', ''),
                    grupo_id=grupo_id
                )
                db.session.add(nova)
                reservas_criadas.append(current_date.isoformat())
        current_date += timedelta(days=1)

    db.session.commit()
    return jsonify({
        'mensagem': f'{len(reservas_criadas)} reservas criadas',
        'grupo_id': grupo_id,
        'reservas_criadas': reservas_criadas,
        'conflitos': conflitos
    }), 201

# Rota para listar todas as reservas de um grupo (pública)
@app.route('/api/reservas/grupo/<grupo_id>', methods=['GET'])
def get_reservas_by_grupo(grupo_id):
    reservas = Reserva.query.filter_by(grupo_id=grupo_id).order_by(Reserva.data).all()
    if not reservas:
        return jsonify({'erro': 'Grupo não encontrado'}), 404
    return jsonify([formatReserva(r) for r in reservas])

# Rota para cancelar todas as reservas de um grupo (admin)
@app.route('/api/reservas/grupo/<grupo_id>', methods=['DELETE'])
@admin_required
def delete_reservas_by_grupo(grupo_id):
    reservas = Reserva.query.filter_by(grupo_id=grupo_id).all()
    if not reservas:
        return jsonify({'erro': 'Grupo não encontrado'}), 404
    for r in reservas:
        db.session.delete(r)
    db.session.commit()
    return jsonify({'mensagem': f'{len(reservas)} reservas canceladas do grupo'})

@app.route('/api/disponibilidade', methods=['GET'])
def disponibilidade():
    """Retorna blocos de 30 minutos entre 08:00 e 19:00, com status ocupado/livre."""
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

    reservas_min = []
    for r in reservas:
        inicio_min = r.hora_inicio.hour * 60 + r.hora_inicio.minute
        fim_min = r.hora_fim.hour * 60 + r.hora_fim.minute
        reservas_min.append((inicio_min, fim_min))

    horarios = []
    current = 8 * 60
    end_of_day = 19 * 60
    while current < end_of_day:
        inicio_min = current
        fim_min = current + 30
        inicio_str = f"{inicio_min // 60:02d}:{inicio_min % 60:02d}"
        fim_str = f"{fim_min // 60:02d}:{fim_min % 60:02d}"
        ocupado = any(inicio_min >= r_ini and fim_min <= r_fim for r_ini, r_fim in reservas_min)
        horarios.append({
            'hora_inicio': inicio_str,
            'hora_fim': fim_str,
            'ocupado': ocupado,
            'titulo': 'Reservado' if ocupado else ''
        })
        current += 30

    return jsonify({
        'sala_nome': sala.nome,
        'data': data_str,
        'horarios': horarios
    })

# ---------- ROTAS ADMIN ----------
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    dados = request.get_json()
    if dados.get('senha') == app.config['ADMIN_PASSWORD']:
        session['admin'] = True
        return jsonify({'sucesso': True})
    return jsonify({'erro': 'Senha inválida'}), 401

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.pop('admin', None)
    return jsonify({'sucesso': True})

@app.route('/api/salas', methods=['POST'])
@admin_required
def create_sala():
    dados = request.get_json()
    if not dados or not dados.get('nome'):
        return jsonify({'erro': 'Nome obrigatório'}), 400
    if Sala.query.filter_by(nome=dados['nome']).first():
        return jsonify({'erro': 'Sala já existe'}), 400

    sala = Sala(
        nome=dados['nome'],
        bloco=dados.get('bloco'),
        andar=dados.get('andar'),
        capacidade=dados.get('capacidade'),
        equipamentos=dados.get('equipamentos'),
        avisos=dados.get('avisos')
    )
    db.session.add(sala)
    db.session.commit()
    return jsonify(sala.to_dict()), 201

@app.route('/api/salas/<int:sala_id>', methods=['DELETE'])
@admin_required
def delete_sala(sala_id):
    sala = Sala.query.get_or_404(sala_id)
    db.session.delete(sala)
    db.session.commit()
    return jsonify({'mensagem': 'Sala deletada'})

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
@admin_required
def delete_reserva(reserva_id):
    reserva = Reserva.query.get_or_404(reserva_id)
    db.session.delete(reserva)
    db.session.commit()
    return jsonify({'mensagem': 'Reserva cancelada'})

# ---------- INICIALIZAÇÃO ----------
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)