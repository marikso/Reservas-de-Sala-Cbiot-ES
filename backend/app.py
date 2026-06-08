from flask import Flask, request, jsonify, session, make_response
from flask_cors import CORS
from flask_session import Session
from config import Config
from database import db
from models import Sala, Reserva, Manutencao, User
from datetime import datetime, time, date, timedelta
from sqlalchemy import and_
from functools import wraps
import uuid
import traceback

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=['http://localhost:5173', 'http://localhost:5174'], supports_credentials=True)
Session(app)
db.init_app(app)

ALLOWED_ORIGINS = {'http://localhost:5173', 'http://localhost:5174'}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.before_request
def handle_options_preflight():
    if request.method == 'OPTIONS':
        resp = make_response()
        origin = request.headers.get('Origin')
        if origin in ALLOWED_ORIGINS:
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Access-Control-Allow-Credentials'] = 'true'
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return resp

@app.errorhandler(Exception)
def handle_exception(e):
    tb = traceback.format_exc()
    traceback.print_exc()
    try:
        with open('error.log', 'a', encoding='utf-8') as f:
            f.write('\n---- EXCEPTION ----\n')
            f.write(tb)
    except Exception:
        pass
    origin = request.headers.get('Origin')
    body = {'erro': 'Internal server error'}
    resp = make_response(jsonify(body), 500)
    if origin in ALLOWED_ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return resp

# ---------- DECORATORS DE PERMISSÃO ----------
def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = session.get('user')
            if not user or user.get('cargo') not in allowed_roles:
                return jsonify({'erro': 'Acesso não autorizado'}), 401
            return f(*args, **kwargs)
        return decorated
    return decorator

# ---------- FUNÇÕES AUXILIARES ----------
def parse_date(data_str):
    return datetime.strptime(data_str, '%Y-%m-%d').date()

def parse_time(time_str):
    return datetime.strptime(time_str, '%H:%M').time()

def validate_business_hours(data, hora_inicio, hora_fim):
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
    hoje = date.today()
    resultado = []
    for s in salas:
        manutencao = Manutencao.query.filter(
            Manutencao.sala_id == s.id,
            Manutencao.data_inicio <= hoje,
            Manutencao.data_fim >= hoje
        ).first()
        resultado.append({
            **s.to_dict(),
            'em_manutencao': manutencao is not None
        })
    return jsonify(resultado)

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

    # Conflito com reservas normais
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

    # Verificar manutenção contínua
    manutencoes = Manutencao.query.filter(
        Manutencao.sala_id == dados['sala_id'],
        Manutencao.data_inicio <= data_res,
        Manutencao.data_fim >= data_res
    ).all()
    for m in manutencoes:
        if data_res == m.data_inicio:
            inicio_manut = m.hora_inicio
        else:
            inicio_manut = time(8,0)
        if data_res == m.data_fim:
            fim_manut = m.hora_fim
        else:
            fim_manut = time(19,0)
        if hora_ini < fim_manut and hora_fim > inicio_manut:
            return jsonify({'erro': f'Sala em manutenção no período: {m.motivo}'}), 400

    nova = Reserva(
        sala_id=dados['sala_id'],
        titulo=dados['titulo'],
        data=data_res,
        hora_inicio=hora_ini,
        hora_fim=hora_fim,
        responsavel=dados['responsavel'],
        email=dados.get('email', ''),
        descricao=dados.get('descricao', ''),
        grupo_id=None
    )
    db.session.add(nova)
    db.session.commit()
    return jsonify(formatReserva(nova)), 201

@app.route('/api/reservas/recorrente', methods=['POST'])
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
            manut = Manutencao.query.filter(
                Manutencao.sala_id == dados['sala_id'],
                Manutencao.data_inicio <= current_date,
                Manutencao.data_fim >= current_date,
                Manutencao.hora_inicio < hora_fim,
                Manutencao.hora_fim > hora_ini
            ).first()
            if conflito or manut:
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

@app.route('/api/reservas/grupo/<grupo_id>', methods=['GET'])
def get_reservas_by_grupo(grupo_id):
    reservas = Reserva.query.filter_by(grupo_id=grupo_id).order_by(Reserva.data).all()
    if not reservas:
        return jsonify({'erro': 'Grupo não encontrado'}), 404
    return jsonify([formatReserva(r) for r in reservas])

# Admin/gerente cancelar grupo
@app.route('/api/reservas/grupo/<grupo_id>', methods=['DELETE'])
@role_required(['admin', 'gerente'])
def delete_reservas_by_grupo(grupo_id):
    reservas = Reserva.query.filter_by(grupo_id=grupo_id).all()
    if not reservas:
        return jsonify({'erro': 'Grupo não encontrado'}), 404
    for r in reservas:
        db.session.delete(r)
    db.session.commit()
    return jsonify({'mensagem': f'{len(reservas)} reservas canceladas do grupo'})

# Usuário comum cancelar seu próprio grupo recorrente
@app.route('/api/reservas/grupo/<grupo_id>/user', methods=['DELETE'])
def delete_user_grupo(grupo_id):
    user = session.get('user')
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
    reservas = Reserva.query.filter_by(grupo_id=grupo_id).all()
    if not reservas:
        return jsonify({'erro': 'Grupo não encontrado'}), 404
    for r in reservas:
        if r.email != user.get('email'):
            return jsonify({'erro': 'Você não pode cancelar este grupo'}), 403
    for r in reservas:
        db.session.delete(r)
    db.session.commit()
    return jsonify({'mensagem': f'{len(reservas)} reservas canceladas'})

@app.route('/api/reservas/<int:reserva_id>', methods=['PUT'])
def update_reserva(reserva_id):
    reserva = Reserva.query.get_or_404(reserva_id)
    user = session.get('user')
    if not user or (user.get('cargo') not in ['admin', 'gerente'] and reserva.email != user.get('email')):
        return jsonify({'erro': 'Acesso não autorizado'}), 401

    dados = request.get_json()
    titulo = dados.get('titulo')
    descricao = dados.get('descricao')
    data_str = dados.get('data')
    hora_inicio_str = dados.get('hora_inicio')
    hora_fim_str = dados.get('hora_fim')

    if titulo is not None:
        reserva.titulo = titulo
    if descricao is not None:
        reserva.descricao = descricao

    if data_str and hora_inicio_str and hora_fim_str:
        try:
            nova_data = parse_date(data_str)
            nova_hora_ini = parse_time(hora_inicio_str)
            nova_hora_fim = parse_time(hora_fim_str)
        except ValueError:
            return jsonify({'erro': 'Formato inválido de data ou hora'}), 400

        erro = validate_business_hours(nova_data, nova_hora_ini, nova_hora_fim)
        if erro:
            return jsonify({'erro': erro}), 400

        conflito = Reserva.query.filter(
            and_(
                Reserva.sala_id == reserva.sala_id,
                Reserva.data == nova_data,
                Reserva.hora_inicio < nova_hora_fim,
                Reserva.hora_fim > nova_hora_ini,
                Reserva.id != reserva_id
            )
        ).first()
        if conflito:
            return jsonify({'erro': 'Conflito de horário: sala já reservada neste período'}), 400

        manutencoes = Manutencao.query.filter(
            Manutencao.sala_id == reserva.sala_id,
            Manutencao.data_inicio <= nova_data,
            Manutencao.data_fim >= nova_data
        ).all()
        for m in manutencoes:
            if nova_data == m.data_inicio:
                inicio_manut = m.hora_inicio
            else:
                inicio_manut = time(8,0)
            if nova_data == m.data_fim:
                fim_manut = m.hora_fim
            else:
                fim_manut = time(19,0)
            if nova_hora_ini < fim_manut and nova_hora_fim > inicio_manut:
                return jsonify({'erro': f'Sala em manutenção no período: {m.motivo}'}), 400

        reserva.data = nova_data
        reserva.hora_inicio = nova_hora_ini
        reserva.hora_fim = nova_hora_fim

    db.session.commit()
    return jsonify(formatReserva(reserva)), 200

@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def delete_reserva(reserva_id):
    reserva = Reserva.query.get_or_404(reserva_id)
    user = session.get('user')
    if user and (user.get('cargo') in ['admin', 'gerente'] or reserva.email == user.get('email')):
        db.session.delete(reserva)
        db.session.commit()
        return jsonify({'mensagem': 'Reserva cancelada'})
    return jsonify({'erro': 'Acesso não autorizado'}), 401

@app.route('/api/disponibilidade', methods=['GET'])
def disponibilidade():
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
    manutencoes = Manutencao.query.filter(
        Manutencao.sala_id == sala_id,
        Manutencao.data_inicio <= data_res,
        Manutencao.data_fim >= data_res
    ).all()

    horarios = []
    current = 8 * 60
    end_of_day = 19 * 60
    while current < end_of_day:
        bloco_inicio = current
        bloco_fim = current + 30
        inicio_str = f"{bloco_inicio // 60:02d}:{bloco_inicio % 60:02d}"
        fim_str = f"{bloco_fim // 60:02d}:{bloco_fim % 60:02d}"
        ocupado = False
        titulo = ''

        for m in manutencoes:
            if data_res == m.data_inicio:
                inicio_manut = m.hora_inicio
            else:
                inicio_manut = time(8,0)
            if data_res == m.data_fim:
                fim_manut = m.hora_fim
            else:
                fim_manut = time(19,0)
            inicio_manut_min = inicio_manut.hour*60 + inicio_manut.minute
            fim_manut_min = fim_manut.hour*60 + fim_manut.minute
            if bloco_inicio < fim_manut_min and bloco_fim > inicio_manut_min:
                ocupado = True
                titulo = f"Manutenção: {m.motivo}"
                break

        if not ocupado:
            for r in reservas:
                r_ini = r.hora_inicio.hour*60 + r.hora_inicio.minute
                r_fim = r.hora_fim.hour*60 + r.hora_fim.minute
                if bloco_inicio < r_fim and bloco_fim > r_ini:
                    ocupado = True
                    titulo = 'Reservado'
                    break

        horarios.append({
            'hora_inicio': inicio_str,
            'hora_fim': fim_str,
            'ocupado': ocupado,
            'titulo': titulo
        })
        current += 30

    return jsonify({
        'sala_nome': sala.nome,
        'data': data_str,
        'horarios': horarios
    })

@app.route('/api/salas/disponiveis', methods=['GET'])
def salas_disponiveis_por_data_hora():
    data_str = request.args.get('data')
    hora_inicio_str = request.args.get('hora_inicio')
    hora_fim_str = request.args.get('hora_fim')
    if not data_str or not hora_inicio_str or not hora_fim_str:
        return jsonify({'erro': 'data, hora_inicio e hora_fim são obrigatórios'}), 400
    try:
        data_res = parse_date(data_str)
        hora_ini = parse_time(hora_inicio_str)
        hora_fim = parse_time(hora_fim_str)
    except ValueError:
        return jsonify({'erro': 'Formato inválido'}), 400

    if hora_ini.minute not in (0,30) or hora_fim.minute not in (0,30):
        return jsonify({'erro': 'Horários devem ser em hora cheia ou meia hora'}), 400
    if hora_ini >= hora_fim:
        return jsonify({'erro': 'Início deve ser anterior ao fim'}), 400
    if hora_ini < time(8,0) or hora_fim > time(19,0):
        return jsonify({'erro': 'Horário fora do expediente (08:00-19:00)'}), 400

    salas = Sala.query.all()
    disponiveis = []
    for sala in salas:
        reserva = Reserva.query.filter(
            Reserva.sala_id == sala.id,
            Reserva.data == data_res,
            Reserva.hora_inicio < hora_fim,
            Reserva.hora_fim > hora_ini
        ).first()
        if reserva:
            continue
        manut = Manutencao.query.filter(
            Manutencao.sala_id == sala.id,
            Manutencao.data_inicio <= data_res,
            Manutencao.data_fim >= data_res
        ).all()
        bloqueado = False
        for m in manut:
            if data_res == m.data_inicio:
                inicio_dia = m.hora_inicio
            else:
                inicio_dia = time(8,0)
            if data_res == m.data_fim:
                fim_dia = m.hora_fim
            else:
                fim_dia = time(19,0)
            if hora_ini < fim_dia and hora_fim > inicio_dia:
                bloqueado = True
                break
        if bloqueado:
            continue
        disponiveis.append(sala.to_dict())
    return jsonify(disponiveis)

# ---------- AUTENTICAÇÃO ----------
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    dados = request.get_json() or {}
    email = dados.get('email')
    senha = dados.get('senha')
    if not email or not senha:
        return jsonify({'erro': 'email e senha são necessários'}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(senha):
        return jsonify({'erro': 'Credenciais inválidas'}), 401
    if user.status != 'aprovado':
        return jsonify({'erro': 'Conta aguardando aprovação do administrador.'}), 403
    session['user'] = user.to_dict(include_status=False)
    return jsonify(session['user'])

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    dados = request.get_json() or {}
    nome = dados.get('nome')
    email = dados.get('email')
    senha = dados.get('senha')
    if not nome or not email or not senha:
        return jsonify({'erro': 'nome, email e senha são obrigatórios'}), 400
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'erro': 'Email já cadastrado'}), 400
    # Cargo temporário até aprovação pelo admin
    user = User(email=email, nome=nome, cargo='sem_cargo', status='pendente')
    user.set_password(senha)
    db.session.add(user)
    db.session.commit()
    return jsonify({'mensagem': 'Cadastro realizado. Aguardando aprovação do administrador.'}), 201

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.pop('user', None)
    return jsonify({'sucesso': True})

@app.route('/api/auth/whoami', methods=['GET'])
def auth_whoami():
    return jsonify(session.get('user') or {})

# ---------- ROTAS DE GERENCIAMENTO DE USUÁRIOS (APENAS ADMIN/GERENTE) ----------
@app.route('/api/users', methods=['GET'])
@role_required(['admin', 'gerente'])   # mantém leitura para gerente (opcional)
def listar_usuarios():
    users = User.query.order_by(User.status, User.nome).all()
    return jsonify([u.to_dict() for u in users])

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@role_required(['admin'])   # apenas admin pode alterar cargos/status
def atualizar_usuario(user_id):
    user = User.query.get_or_404(user_id)
    dados = request.get_json()
    if 'cargo' in dados:
        user.cargo = dados['cargo']
    if 'status' in dados:
        user.status = dados['status']
    db.session.commit()
    return jsonify(user.to_dict())

@app.route('/api/users/<int:user_id>/approve', methods=['POST'])
@role_required(['admin'])   # apenas admin pode aprovar
def aprovar_usuario(user_id):
    user = User.query.get_or_404(user_id)
    cargo = request.json.get('cargo', 'aluno')
    user.cargo = cargo
    user.status = 'aprovado'
    db.session.commit()
    return jsonify(user.to_dict())

# ---------- ROTAS ADMINISTRATIVAS (SALAS, MANUTENÇÕES) ----------
@app.route('/api/salas', methods=['POST'])
@role_required(['admin', 'gerente'])
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
        equipamentos=dados.get('equipamentos')
    )
    db.session.add(sala)
    db.session.commit()
    return jsonify(sala.to_dict()), 201

@app.route('/api/salas/<int:sala_id>', methods=['PUT'])
@role_required(['admin', 'gerente'])
def update_sala(sala_id):
    sala = Sala.query.get_or_404(sala_id)
    dados = request.get_json()
    if 'nome' in dados:
        outro = Sala.query.filter(Sala.nome == dados['nome'], Sala.id != sala_id).first()
        if outro:
            return jsonify({'erro': 'Já existe uma sala com este nome'}), 400
        sala.nome = dados['nome']
    sala.bloco = dados.get('bloco', sala.bloco)
    sala.andar = dados.get('andar', sala.andar)
    sala.capacidade = dados.get('capacidade', sala.capacidade)
    sala.equipamentos = dados.get('equipamentos', sala.equipamentos)
    db.session.commit()
    return jsonify(sala.to_dict()), 200

@app.route('/api/salas/<int:sala_id>', methods=['DELETE'])
@role_required(['admin', 'gerente'])
def delete_sala(sala_id):
    sala = Sala.query.get_or_404(sala_id)
    db.session.delete(sala)
    db.session.commit()
    return jsonify({'mensagem': 'Sala deletada'})

@app.route('/api/manutencoes', methods=['GET'])
@role_required(['admin', 'gerente'])
def listar_manutencoes():
    manutencoes = Manutencao.query.order_by(Manutencao.data_inicio).all()
    return jsonify([m.to_dict() for m in manutencoes])

@app.route('/api/manutencoes', methods=['POST'])
@role_required(['admin', 'gerente'])
def criar_manutencao():
    dados = request.get_json()
    obrigatorios = ['sala_id', 'data_inicio', 'data_fim', 'hora_inicio', 'hora_fim', 'motivo']
    if not all(c in dados for c in obrigatorios):
        return jsonify({'erro': 'Dados incompletos'}), 400
    try:
        sala_id = dados['sala_id']
        data_inicio = parse_date(dados['data_inicio'])
        data_fim = parse_date(dados['data_fim'])
        hora_ini = parse_time(dados['hora_inicio'])
        hora_fim = parse_time(dados['hora_fim'])
        motivo = dados['motivo']
    except ValueError:
        return jsonify({'erro': 'Formato inválido'}), 400
    if hora_ini.minute not in (0,30) or hora_fim.minute not in (0,30):
        return jsonify({'erro': 'Horários devem ser em hora cheia ou meia hora'}), 400
    if hora_ini >= hora_fim:
        return jsonify({'erro': 'Início deve ser anterior ao fim'}), 400
    if hora_ini < time(8,0) or hora_fim > time(19,0):
        return jsonify({'erro': 'Fora do horário comercial (08:00-19:00)'}), 400
    conflito = Manutencao.query.filter(
        Manutencao.sala_id == sala_id,
        Manutencao.data_inicio <= data_fim,
        Manutencao.data_fim >= data_inicio
    ).first()
    if conflito:
        return jsonify({'erro': 'Já existe um bloqueio de manutenção neste período'}), 400
    nova = Manutencao(
        sala_id=sala_id,
        data_inicio=data_inicio,
        data_fim=data_fim,
        hora_inicio=hora_ini,
        hora_fim=hora_fim,
        motivo=motivo
    )
    db.session.add(nova)
    db.session.commit()
    return jsonify(nova.to_dict()), 201

@app.route('/api/manutencoes/<int:manutencao_id>', methods=['DELETE'])
@role_required(['admin', 'gerente'])
def deletar_manutencao(manutencao_id):
    m = Manutencao.query.get_or_404(manutencao_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'mensagem': 'Bloqueio removido'})

# ---------- ROTA ADMIN LEGACY (SENHA ÚNICA) – OPCIONAL ----------
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

# ---------- INICIALIZAÇÃO ----------
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)