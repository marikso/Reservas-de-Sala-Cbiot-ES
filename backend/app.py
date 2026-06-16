import os
from flask import Flask, request, jsonify, make_response, g
from flask_cors import CORS
from flask_session import Session
from config import Config
from database import db
from models import Sala, Reserva, Manutencao, User, Notificacao
from datetime import datetime, time, date, timedelta, timezone
from sqlalchemy import and_
from functools import wraps
import uuid
import traceback
import requests as http_requests

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'], supports_credentials=True)
Session(app)
db.init_app(app)

ALLOWED_ORIGINS = {'http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'}

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

VALID_ROLES = {'admin', 'gerente', 'lider_de_grupo', 'usuario_cbiot'}

# Mapeamento de permissões do Portal para roles internas.
# SALAS_LIDER é a permissão faltante no portal — nomenclatura similar à variável lider_de_grupo.
PORTAL_PERMISSION_MAP = [
    ('SALAS_ADMIN', 'admin'),
    ('SALAS_GERENTE', 'gerente'),
    ('SALAS_LIDER', 'lider_de_grupo'),
    ('SALAS_USER', 'usuario_cbiot'),
]

def map_permissions_to_role(permissions):
    for perm, role in PORTAL_PERMISSION_MAP:
        if perm in permissions:
            return role
    if 'ACCESS_RESERVA_SALAS' in permissions:
        return 'usuario_cbiot'
    return None

def get_current_user():
    if hasattr(g, 'current_user'):
        return g.current_user

    auth_header = request.headers.get('Authorization')
    if not auth_header:
        g.current_user = None
        return None
    try:
        portal_url = app.config.get('PORTAL_AUTH_URL', 'http://localhost:3000')
        resp = http_requests.get(
            f'{portal_url}/api/auth/me',
            headers={'Authorization': auth_header},
            timeout=5
        )
        if resp.status_code != 200:
            g.current_user = None
            return None
        data = resp.json()
        permissions = data.get('permissions', [])
        if 'ACCESS_RESERVA_SALAS' not in permissions:
            g.current_user = None
            return None
        cargo = map_permissions_to_role(permissions)
        g.current_user = {
            'id': data.get('id'),
            'nome': data.get('name'),
            'email': data.get('email'),
            'cargo': cargo,
            'permissions': permissions,
        }
    except Exception:
        g.current_user = None
    return g.current_user

def normalize_cargo(cargo):
    return cargo if cargo in VALID_ROLES else 'usuario_cbiot'

PRIORITY_ROLES = {'admin', 'gerente', 'lider_de_grupo'}

def status_que_bloqueiam(cargo_visualizador):
    # Admin/gerente/lider têm prioridade de reserva: uma solicitação pendente
    # de outra pessoa não os impede de reservar o mesmo horário.
    if cargo_visualizador and normalize_cargo(cargo_visualizador) in PRIORITY_ROLES:
        return ['aprovada']
    return ['aprovada', 'pendente']

# ---------- DECORATORS ----------
def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user or normalize_cargo(user.get('cargo')) not in allowed_roles:
                return jsonify({'erro': 'Acesso não autorizado'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

# ---------- FUNÇÕES AUXILIARES ----------
def parse_date(data_str):
    return datetime.strptime(data_str, '%Y-%m-%d').date()

def parse_time(time_str):
    time_str = time_str.strip()
    if ':' in time_str:
        parts = time_str.split(':')
        if len(parts) >= 2:
            time_str = f"{parts[0]}:{parts[1]}"
    return datetime.strptime(time_str, '%H:%M').time()

def validate_business_hours(data, hora_inicio, hora_fim):
    hoje = date.today()
    if data < hoje:
        return 'Não é possível reservar para datas já passadas'
    if data == hoje:
        agora = datetime.now().time()
        agora_min = agora.hour * 60 + agora.minute
        inicio_min = hora_inicio.hour * 60 + hora_inicio.minute
        if inicio_min < agora_min:
            return 'Não é possível reservar para um horário que já passou hoje'
    if data.weekday() in (5, 6):
        return 'Reservas não são permitidas aos sábados e domingos'
    inicio_min = hora_inicio.hour * 60 + hora_inicio.minute
    fim_min = hora_fim.hour * 60 + hora_fim.minute
    if inicio_min % 30 != 0 or fim_min % 30 != 0:
        return 'Reservas devem começar e terminar na hora cheia ou meia hora'
    if inicio_min >= fim_min:
        return 'Hora de início deve ser anterior à hora de fim'
    if inicio_min < 8*60 or inicio_min >= 19*60 or fim_min > 19*60:
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
        'status': row.status,
        'aprovador': row.aprovador,
        'data_aprovacao': row.data_aprovacao.isoformat() + 'Z' if row.data_aprovacao else None,
    }

def rejeitar_pendentes_conflitantes(sala_id, data_res, hora_ini, hora_fim, aprovador_nome, excluir_id=None):
    # Quando alguém com prioridade (admin/gerente/lider) reserva um horário que
    # tinha uma solicitação pendente de outra pessoa, essa solicitação perde a vaga.
    query = Reserva.query.filter(
        Reserva.sala_id == sala_id,
        Reserva.data == data_res,
        Reserva.hora_inicio < hora_fim,
        Reserva.hora_fim > hora_ini,
        Reserva.status == 'pendente'
    )
    if excluir_id is not None:
        query = query.filter(Reserva.id != excluir_id)
    for pendente in query.all():
        pendente.status = 'rejeitada'
        pendente.aprovador = aprovador_nome
        pendente.data_aprovacao = datetime.utcnow()

        destinatario = User.query.filter_by(email=pendente.email).first()
        if not destinatario:
            destinatario = User(
                email=pendente.email,
                nome=pendente.responsavel or 'Usuário',
                cargo='usuario_cbiot',
                status='aprovado'
            )
            destinatario.set_password('senha_temporaria')
            db.session.add(destinatario)
            db.session.flush()

        notif = Notificacao(
            usuario_email=pendente.email,
            mensagem=f'Sua solicitação "{pendente.titulo}" foi REJEITADA. Motivo: houve conflito de horário.',
            tipo='rejeicao',
            reserva_id=pendente.id
        )
        db.session.add(notif)

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

@app.route('/api/salas', methods=['POST'])
@role_required(['admin'])
def create_sala():
    dados = request.get_json()
    if not dados or not dados.get('nome', '').strip():
        return jsonify({'erro': 'Nome da sala é obrigatório'}), 400
    existente = Sala.query.filter_by(nome=dados['nome'].strip()).first()
    if existente:
        return jsonify({'erro': 'Já existe uma sala com este nome'}), 400
    sala = Sala(
        nome=dados['nome'].strip(),
        bloco=dados.get('bloco', ''),
        andar=dados.get('andar', ''),
        capacidade=dados.get('capacidade') or None,
        equipamentos=dados.get('equipamentos', ''),
    )
    db.session.add(sala)
    db.session.commit()
    return jsonify(sala.to_dict()), 201

@app.route('/api/reservas', methods=['GET'])
def get_reservas():
    sala_id = request.args.get('sala_id', type=int)
    data_str = request.args.get('data')
    query = Reserva.query.filter(Reserva.status == 'aprovada')
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
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
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

    cargo = normalize_cargo(user.get('cargo')) if user else 'usuario_cbiot'

    conflito = Reserva.query.filter(
        and_(
            Reserva.sala_id == dados['sala_id'],
            Reserva.data == data_res,
            Reserva.hora_inicio < hora_fim,
            Reserva.hora_fim > hora_ini,
            Reserva.status.in_(status_que_bloqueiam(cargo))
        )
    ).first()
    if conflito:
        return jsonify({'erro': 'Conflito de horário: sala já reservada neste período'}), 400

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

    status = 'aprovada' if cargo in ('admin', 'gerente', 'lider_de_grupo') else 'pendente'

    nova = Reserva(
        sala_id=dados['sala_id'],
        titulo=dados['titulo'],
        data=data_res,
        hora_inicio=hora_ini,
        hora_fim=hora_fim,
        responsavel=dados['responsavel'],
        email=dados.get('email', ''),
        descricao=dados.get('descricao', ''),
        grupo_id=None,
        status=status
    )
    db.session.add(nova)
    db.session.flush()
    if status == 'aprovada':
        rejeitar_pendentes_conflitantes(dados['sala_id'], data_res, hora_ini, hora_fim, user.get('nome') or user.get('email'), excluir_id=nova.id)
    db.session.commit()
    return jsonify(formatReserva(nova)), 201

@app.route('/api/reservas/recorrente', methods=['POST'])
def create_reservas_recorrentes():
    dados = request.get_json()
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
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

    erro = validate_business_hours(data_inicio, hora_ini, hora_fim)
    if erro:
        return jsonify({'erro': erro}), 400

    LIMITE_DIAS = 180
    if (data_fim - data_inicio).days > LIMITE_DIAS:
        return jsonify({'erro': f'O período máximo para reservas recorrentes é de {LIMITE_DIAS} dias'}), 400

    cargo = normalize_cargo(user.get('cargo')) if user else 'usuario_cbiot'
    status = 'aprovada' if cargo in ('admin', 'gerente', 'lider_de_grupo') else 'pendente'

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
                    Reserva.hora_fim > hora_ini,
                    Reserva.status.in_(status_que_bloqueiam(cargo))
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
                    grupo_id=grupo_id,
                    status=status
                )
                db.session.add(nova)
                db.session.flush()
                if status == 'aprovada':
                    rejeitar_pendentes_conflitantes(dados['sala_id'], current_date, hora_ini, hora_fim, user.get('nome') or user.get('email'), excluir_id=nova.id)
                reservas_criadas.append(current_date.isoformat())
        current_date += timedelta(days=1)

    db.session.commit()
    sufixo = ' e aguardando aprovação' if status == 'pendente' else ''
    return jsonify({
        'mensagem': f'{len(reservas_criadas)} reservas criadas{sufixo}',
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

@app.route('/api/reservas/grupo/<grupo_id>/user', methods=['DELETE'])
def delete_user_grupo(grupo_id):
    user = get_current_user()
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

# ========== ROTA DE EDIÇÃO (PUT) ==========
# ========== ROTA DE EDIÇÃO (PUT) ==========
@app.route('/api/reservas/<int:reserva_id>', methods=['PUT'])
def update_reserva(reserva_id):
    reserva = Reserva.query.get_or_404(reserva_id)
    user = get_current_user()
    if not user or (normalize_cargo(user.get('cargo')) not in ['admin', 'gerente'] and reserva.email != user.get('email')):
        return jsonify({'erro': 'Acesso não autorizado'}), 403
    if reserva.status != 'aprovada':
        return jsonify({'erro': 'Só é possível editar reservas já aprovadas'}), 400

    dados = request.get_json()
    titulo = dados.get('titulo')
    descricao = dados.get('descricao')
    data_str = dados.get('data')
    hora_inicio_str = dados.get('hora_inicio')
    hora_fim_str = dados.get('hora_fim')
    motivo = (dados.get('motivo') or '').strip()

    # Guardar valores antigos para comparação (antes de qualquer alteração)
    old_titulo = reserva.titulo
    old_descricao = reserva.descricao
    old_data = reserva.data
    old_hora_inicio = reserva.hora_inicio
    old_hora_fim = reserva.hora_fim

    if titulo is not None:
        reserva.titulo = titulo
    if descricao is not None:
        reserva.descricao = descricao

    if data_str and hora_inicio_str and hora_fim_str:
        hora_inicio_str = hora_inicio_str.strip()
        hora_fim_str = hora_fim_str.strip()
        data_str = data_str.strip()

        try:
            nova_data = parse_date(data_str)
            nova_hora_ini = parse_time(hora_inicio_str)
            nova_hora_fim = parse_time(hora_fim_str)
        except ValueError as e:
            app.logger.error(f"Erro parse: {e}")
            return jsonify({'erro': 'Formato inválido de data/hora. Use AAAA-MM-DD e HH:MM'}), 400

        inicio_min = nova_hora_ini.hour * 60 + nova_hora_ini.minute
        fim_min = nova_hora_fim.hour * 60 + nova_hora_fim.minute

        if inicio_min >= fim_min:
            return jsonify({'erro': f'Hora de início ({nova_hora_ini}) deve ser anterior à hora de fim ({nova_hora_fim})'}), 400
        if inicio_min < 8*60 or fim_min > 19*60 or inicio_min >= 19*60:
            return jsonify({'erro': 'Reservas só podem ocorrer entre 08:00 e 19:00'}), 400
        if inicio_min % 30 != 0 or fim_min % 30 != 0:
            return jsonify({'erro': 'Reservas devem começar e terminar na hora cheia ou meia hora'}), 400
        hoje = date.today()
        if nova_data < hoje:
            return jsonify({'erro': 'Não é possível editar para uma data já passada'}), 400
        if nova_data == hoje and inicio_min < (datetime.now().hour*60 + datetime.now().minute):
            return jsonify({'erro': 'Não é possível editar para um horário que já passou hoje'}), 400
        if nova_data.weekday() in (5, 6):
            return jsonify({'erro': 'Reservas não são permitidas aos sábados e domingos'}), 400

        conflito = Reserva.query.filter(
            and_(
                Reserva.sala_id == reserva.sala_id,
                Reserva.data == nova_data,
                Reserva.hora_inicio < nova_hora_fim,
                Reserva.hora_fim > nova_hora_ini,
                Reserva.id != reserva_id,
                Reserva.status.in_(status_que_bloqueiam(user.get('cargo')))
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
                inicio_manut = time(8, 0)
            if nova_data == m.data_fim:
                fim_manut = m.hora_fim
            else:
                fim_manut = time(19, 0)
            inicio_manut_min = inicio_manut.hour * 60 + inicio_manut.minute
            fim_manut_min = fim_manut.hour * 60 + fim_manut.minute
            if inicio_min < fim_manut_min and fim_min > inicio_manut_min:
                return jsonify({'erro': f'Sala em manutenção no período: {m.motivo}'}), 400

        reserva.data = nova_data
        reserva.hora_inicio = nova_hora_ini
        reserva.hora_fim = nova_hora_fim

        if normalize_cargo(user.get('cargo')) in PRIORITY_ROLES:
            rejeitar_pendentes_conflitantes(reserva.sala_id, nova_data, nova_hora_ini, nova_hora_fim, user.get('nome') or user.get('email'), excluir_id=reserva.id)

    db.session.commit()

    # Notificação detalhada com antes/depois
    if normalize_cargo(user.get('cargo')) in ['admin', 'gerente'] and reserva.email != user.get('email'):
        # Garantir que o destinatário exista
        destinatario = User.query.filter_by(email=reserva.email).first()
        if not destinatario:
            destinatario = User(
                email=reserva.email,
                nome=reserva.responsavel or 'Usuário',
                cargo='lider_de_grupo',
                status='aprovado'
            )
            destinatario.set_password('senha_temporaria')
            db.session.add(destinatario)
            db.session.commit()   # commit imediato para ter o ID

        # Montar lista de alterações
        alteracoes = []
        if old_titulo != reserva.titulo:
            alteracoes.append(f"título: '{old_titulo}' → '{reserva.titulo}'")
        if old_data != reserva.data or old_hora_inicio != reserva.hora_inicio or old_hora_fim != reserva.hora_fim:
            alteracoes.append(f"data/horário: {old_data.strftime('%d-%m-%Y')} {old_hora_inicio.strftime('%H:%M')}-{old_hora_fim.strftime('%H:%M')} → {reserva.data.strftime('%d-%m-%Y')} {reserva.hora_inicio.strftime('%H:%M')}-{reserva.hora_fim.strftime('%H:%M')}")
        if old_descricao != reserva.descricao:
            alteracoes.append(f"descrição: '{old_descricao}' → '{reserva.descricao}'")

        if alteracoes:
            mensagem = f"Sua reserva foi EDITADA. Alterações: {'; '.join(alteracoes)}."
        else:
            mensagem = f"Sua reserva foi EDITADA (nenhuma alteração detectada)."
        if motivo:
            mensagem += f" Motivo: {motivo}"

        notif = Notificacao(
            usuario_email=reserva.email,
            mensagem=mensagem,
            tipo='edicao',
            reserva_id=reserva.id
        )
        db.session.add(notif)
        db.session.commit()

    return jsonify(formatReserva(reserva)), 200

@app.route('/api/reservas/<int:reserva_id>', methods=['GET'])
def get_reserva(reserva_id):
    reserva = Reserva.query.get_or_404(reserva_id)
    return jsonify(formatReserva(reserva))

# ========== ROTA DE CANCELAMENTO INDIVIDUAL ==========
@app.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
def delete_reserva(reserva_id):
    reserva = Reserva.query.get_or_404(reserva_id)
    user = get_current_user()
    if not user or (normalize_cargo(user.get('cargo')) not in ['admin', 'gerente'] and reserva.email != user.get('email')):
        return jsonify({'erro': 'Acesso não autorizado'}), 403

    cargo_atual = normalize_cargo(user.get('cargo'))
    if cargo_atual in ['admin', 'gerente'] and reserva.email != user.get('email'):
        dados = request.get_json(silent=True) or {}
        motivo = (dados.get('motivo') or '').strip()

        destinatario = User.query.filter_by(email=reserva.email).first()
        if not destinatario:
            destinatario = User(
                email=reserva.email,
                nome=reserva.responsavel or 'Usuário',
                cargo='lider_de_grupo',
                status='aprovado'
            )
            destinatario.set_password('senha_temporaria')
            db.session.add(destinatario)
            db.session.flush()

        mensagem = f'Sua reserva "{reserva.titulo}" para {reserva.data.strftime("%d-%m-%Y")} foi CANCELADA por um administrador.'
        if motivo:
            mensagem += f' Motivo: {motivo}'

        notif = Notificacao(
            usuario_email=reserva.email,
            mensagem=mensagem,
            tipo='cancelamento',
            reserva_id=None
        )
        db.session.add(notif)

    db.session.delete(reserva)
    db.session.commit()
    return jsonify({'mensagem': 'Reserva cancelada'}), 200

# ========== ROTA DE CANCELAMENTO DE GRUPO ==========
@app.route('/api/reservas/grupo/<grupo_id>', methods=['DELETE'])
@role_required(['admin', 'gerente'])
def delete_reservas_by_grupo(grupo_id):
    reservas = Reserva.query.filter_by(grupo_id=grupo_id).all()
    if not reservas:
        return jsonify({'erro': 'Grupo não encontrado'}), 404

    dados = request.get_json(silent=True) or {}
    motivo = (dados.get('motivo') or '').strip()

    por_usuario = {}
    for r in reservas:
        por_usuario.setdefault(r.email, []).append(r)

    for email, lista in por_usuario.items():
        destinatario = User.query.filter_by(email=email).first()
        if not destinatario:
            nome = lista[0].responsavel if lista[0].responsavel else email.split('@')[0]
            novo = User(email=email, nome=nome, cargo='lider_de_grupo', status='aprovado')
            novo.set_password('senha_temporaria')
            db.session.add(novo)
            db.session.commit()

        if len(lista) == 1:
            r = lista[0]
            mensagem = f'Sua reserva recorrente "{r.titulo}" para {r.data.strftime("%d-%m-%Y")} foi CANCELADA pelo administrador.'
        else:
            datas = ', '.join([r.data.strftime('%d-%m-%Y') for r in lista[:5]])
            if len(lista) > 5:
                datas += f' e mais {len(lista)-5}'
            mensagem = f'{len(lista)} reservas da série "{lista[0].titulo}" foram CANCELADAS pelo administrador (datas: {datas}).'
        if motivo:
            mensagem += f' Motivo: {motivo}'

        notif = Notificacao(
            usuario_email=email,
            mensagem=mensagem,
            tipo='cancelamento',
            reserva_id=None
        )
        db.session.add(notif)

    for r in reservas:
        db.session.delete(r)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'erro': f'Erro ao cancelar grupo: {str(e)}'}), 500

    return jsonify({'mensagem': f'{len(reservas)} reservas canceladas do grupo'}), 200

# ---------- ROTAS DE DISPONIBILIDADE ----------
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
    viewer = get_current_user()
    reservas = Reserva.query.filter(
        Reserva.sala_id == sala_id,
        Reserva.data == data_res,
        Reserva.status.in_(status_que_bloqueiam(viewer.get('cargo') if viewer else None))
    ).all()
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
                    titulo = 'Reservado' if r.status == 'aprovada' else 'Solicitado (pendente)'
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

    viewer = get_current_user()
    salas = Sala.query.all()
    disponiveis = []
    for sala in salas:
        reserva = Reserva.query.filter(
            Reserva.sala_id == sala.id,
            Reserva.data == data_res,
            Reserva.hora_inicio < hora_fim,
            Reserva.hora_fim > hora_ini,
            Reserva.status.in_(status_que_bloqueiam(viewer.get('cargo') if viewer else None))
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

# ---------- ROTAS DE VERIFICAÇÃO DE CONFLITOS ----------
@app.route('/api/check-conflicts', methods=['POST'])
def check_conflicts():
    dados = request.get_json()
    required = ['sala_id', 'data_inicio', 'data_fim', 'hora_inicio', 'hora_fim', 'dias_semana']
    if not all(k in dados for k in required):
        return jsonify({'erro': 'Dados incompletos'}), 400

    try:
        data_inicio = parse_date(dados['data_inicio'])
        data_fim = parse_date(dados['data_fim'])
        hora_ini = parse_time(dados['hora_inicio'])
        hora_fim = parse_time(dados['hora_fim'])
        dias_semana = dados['dias_semana']
    except (ValueError, KeyError):
        return jsonify({'erro': 'Formato inválido'}), 400

    if any(d > 4 for d in dias_semana):
        return jsonify({'erro': 'Recorrência não permitida em sábado/domingo'}), 400

    viewer = get_current_user()
    status_bloqueio = status_que_bloqueiam(viewer.get('cargo') if viewer else None)
    conflitos = []
    current_date = data_inicio
    while current_date <= data_fim:
        if current_date.weekday() in dias_semana:
            reserva = Reserva.query.filter(
                and_(
                    Reserva.sala_id == dados['sala_id'],
                    Reserva.data == current_date,
                    Reserva.hora_inicio < hora_fim,
                    Reserva.hora_fim > hora_ini,
                    Reserva.status.in_(status_bloqueio)
                )
            ).first()
            manut = Manutencao.query.filter(
                Manutencao.sala_id == dados['sala_id'],
                Manutencao.data_inicio <= current_date,
                Manutencao.data_fim >= current_date,
                Manutencao.hora_inicio < hora_fim,
                Manutencao.hora_fim > hora_ini
            ).first()
            if reserva or manut:
                data_formatada = current_date.strftime('%d/%m')
                dia_semana = current_date.strftime('%A')
                if reserva:
                    motivo = f"já reservada por {reserva.responsavel}"
                elif manut:
                    motivo = f"em manutenção: {manut.motivo}"
                else:
                    motivo = "indisponível"
                conflitos.append(f"{data_formatada} ({dia_semana}) — Sala {motivo}")
        current_date += timedelta(days=1)

    return jsonify({'conflicts': conflitos}), 200

@app.route('/api/check-reserva-conflito', methods=['POST'])
def check_reserva_conflito():
    dados = request.get_json()
    try:
        data_res = parse_date(dados['data'])
        hora_ini = parse_time(dados['hora_inicio'])
        hora_fim = parse_time(dados['hora_fim'])
        sala_id = dados['sala_id']
    except (ValueError, KeyError):
        return jsonify({'erro': 'Dados inválidos'}), 400

    viewer = get_current_user()
    conflito = Reserva.query.filter(
        and_(
            Reserva.sala_id == sala_id,
            Reserva.data == data_res,
            Reserva.hora_inicio < hora_fim,
            Reserva.hora_fim > hora_ini,
            Reserva.status.in_(status_que_bloqueiam(viewer.get('cargo') if viewer else None))
        )
    ).first()
    if conflito:
        return jsonify({'conflito': True, 'titulo': conflito.titulo, 'responsavel': conflito.responsavel})
    return jsonify({'conflito': False})

# ---------- AUTENTICAÇÃO (via Portal) ----------
@app.route('/api/auth/whoami', methods=['GET'])
def auth_whoami():
    user = get_current_user()
    return jsonify(user or {})

# ---------- ROTAS DE GERENCIAMENTO DE USUÁRIOS ----------
@app.route('/api/users', methods=['GET'])
@role_required(['admin', 'gerente'])
def listar_usuarios():
    users = User.query.order_by(User.status, User.nome).all()
    return jsonify([u.to_dict() for u in users])

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@role_required(['admin'])
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
@role_required(['admin', 'gerente'])
def aprovar_usuario(user_id):
    user = User.query.get_or_404(user_id)
    cargo = request.json.get('cargo')
    if normalize_cargo(get_current_user().get('cargo')) == 'gerente':
        cargo = 'lider_de_grupo'
    else:
        if not cargo:
            cargo = 'lider_de_grupo'
    user.cargo = cargo
    user.status = 'aprovado'
    db.session.commit()
    return jsonify(user.to_dict())

# ---------- ROTAS DE SOLICITAÇÕES (COM NOTIFICAÇÕES) ----------
@app.route('/api/solicitacoes', methods=['GET'])
@role_required(['admin', 'gerente'])
def listar_solicitacoes():
    solicitacoes = Reserva.query.filter_by(status='pendente').order_by(Reserva.data, Reserva.hora_inicio).all()
    return jsonify([formatReserva(r) for r in solicitacoes])

@app.route('/api/minhas-solicitacoes', methods=['GET'])
def minhas_solicitacoes():
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
    email = user.get('email')
    solicitacoes = Reserva.query.filter_by(email=email, status='pendente').order_by(Reserva.data, Reserva.hora_inicio).all()
    return jsonify([formatReserva(r) for r in solicitacoes])

@app.route('/api/solicitacoes/rejeitadas', methods=['GET'])
@role_required(['admin', 'gerente'])
def listar_rejeitadas():
    rejeitadas = Reserva.query.filter_by(status='rejeitada').order_by(Reserva.data, Reserva.hora_inicio).all()
    return jsonify([formatReserva(r) for r in rejeitadas])

@app.route('/api/solicitacoes/<int:solicitacao_id>/aprovar', methods=['POST'])
@role_required(['admin', 'gerente'])
def aprovar_solicitacao(solicitacao_id):
    reserva = Reserva.query.get_or_404(solicitacao_id)
    if reserva.status != 'pendente':
        return jsonify({'erro': 'Solicitação não está pendente'}), 400
    reserva.status = 'aprovada'
    user = get_current_user()
    reserva.aprovador = user.get('nome') or user.get('email')
    reserva.data_aprovacao = datetime.utcnow()

    # Garantir que o destinatário exista na tabela users
    destinatario = User.query.filter_by(email=reserva.email).first()
    if not destinatario:
        destinatario = User(
            email=reserva.email,
            nome=reserva.responsavel or 'Usuário',
            cargo='lider_de_grupo',
            status='aprovado'
        )
        destinatario.set_password('senha_temporaria')
        db.session.add(destinatario)
        db.session.commit()

    notif = Notificacao(
        usuario_email=reserva.email,
        mensagem=f'Sua solicitação "{reserva.titulo}" foi APROVADA.',
        tipo='aprovacao',
        reserva_id=reserva.id
    )
    db.session.add(notif)
    db.session.commit()
    return jsonify({'mensagem': 'Reserva aprovada', 'aprovador': reserva.aprovador, 'data_aprovacao': reserva.data_aprovacao.isoformat() + 'Z'})

@app.route('/api/solicitacoes/<int:solicitacao_id>/rejeitar', methods=['POST'])
@role_required(['admin', 'gerente'])
def rejeitar_solicitacao(solicitacao_id):
    reserva = Reserva.query.get_or_404(solicitacao_id)
    if reserva.status != 'pendente':
        return jsonify({'erro': 'Solicitação não está pendente'}), 400
    reserva.status = 'rejeitada'
    user = get_current_user()
    reserva.aprovador = user.get('nome') or user.get('email')
    reserva.data_aprovacao = datetime.utcnow()
    destinatario = User.query.filter_by(email=reserva.email).first()
    if not destinatario:
        destinatario = User(
            email=reserva.email,
            nome=reserva.responsavel or 'Usuário',
            cargo='usuario_cbiot',
            status='aprovado'
        )
        destinatario.set_password('senha_temporaria')
        db.session.add(destinatario)
        db.session.commit()
    notif = Notificacao(
        usuario_email=reserva.email,
        mensagem=f'Sua solicitação "{reserva.titulo}" foi REJEITADA.',
        tipo='rejeicao',
        reserva_id=reserva.id
    )
    db.session.add(notif)
    db.session.commit()
    return jsonify({'mensagem': 'Solicitação rejeitada', 'aprovador': reserva.aprovador, 'data_aprovacao': reserva.data_aprovacao.isoformat() + 'Z'})

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
    if hora_ini < time(8,0) or hora_fim > time(19,0):
        return jsonify({'erro': 'Fora do horário comercial (08:00-19:00)'}), 400

    conflito = Manutencao.query.filter(
        Manutencao.sala_id == sala_id,
        Manutencao.data_inicio <= data_fim,
        Manutencao.data_fim >= data_inicio
    ).first()
    if conflito:
        return jsonify({'erro': 'Já existe um bloqueio de manutenção neste período'}), 400

    nova_manut = Manutencao(
        sala_id=sala_id,
        data_inicio=data_inicio,
        data_fim=data_fim,
        hora_inicio=hora_ini,
        hora_fim=hora_fim,
        motivo=motivo
    )
    db.session.add(nova_manut)
    db.session.flush()

    # Cancelar reservas conflitantes
    reservas_afetadas = Reserva.query.filter(
        Reserva.sala_id == sala_id,
        Reserva.status.in_(['aprovada', 'pendente']),
        Reserva.data.between(data_inicio, data_fim),
        Reserva.hora_inicio < hora_fim,
        Reserva.hora_fim > hora_ini
    ).all()

    reservas_info = []
    for r in reservas_afetadas:
        r.status = 'cancelada'
        destinatario = User.query.filter_by(email=r.email).first()
        if not destinatario:
            destinatario = User(
                email=r.email,
                nome=r.responsavel or 'Usuário',
                cargo='lider_de_grupo',
                status='aprovado'
            )
            destinatario.set_password('senha_temporaria')
            db.session.add(destinatario)
            db.session.flush()
        if destinatario:
            notif = Notificacao(
                usuario_email=r.email,
                mensagem=f'A sala "{r.sala.nome}" entrou em manutenção. Sua reserva do dia {r.data.strftime("%d-%m-%Y")} ({r.hora_inicio.strftime("%H:%M")} às {r.hora_fim.strftime("%H:%M")}) foi CANCELADA.',
                tipo='cancelamento_manutencao',
                reserva_id=None
            )
            db.session.add(notif)
        reservas_info.append({
            'id': r.id,
            'sala_nome': r.sala.nome,
            'data': r.data.isoformat(),
            'hora_inicio': r.hora_inicio.strftime('%H:%M'),
            'hora_fim': r.hora_fim.strftime('%H:%M'),
            'email': r.email
        })

    db.session.commit()
    return jsonify({
        'mensagem': 'Bloqueio de manutenção criado com sucesso',
        'reservas_afetadas': reservas_info
    }), 201

@app.route('/api/manutencoes/<int:manutencao_id>', methods=['DELETE'])
@role_required(['admin', 'gerente'])
def deletar_manutencao(manutencao_id):
    m = Manutencao.query.get_or_404(manutencao_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'mensagem': 'Bloqueio removido'})

# ---------- ROTAS DE NOTIFICAÇÕES ----------
@app.route('/api/notificacoes', methods=['GET'])
def get_notificacoes():
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
    notificacoes = Notificacao.query.filter_by(usuario_email=user['email']).order_by(Notificacao.data_criacao.desc()).all()
    return jsonify([n.to_dict() for n in notificacoes])

@app.route('/api/notificacoes/<int:notif_id>/marcar-lida', methods=['PUT'])
def marcar_notificacao_lida(notif_id):
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
    notif = Notificacao.query.get_or_404(notif_id)
    if notif.usuario_email != user['email']:
        return jsonify({'erro': 'Não autorizado'}), 403
    notif.lida = True
    db.session.commit()
    return jsonify({'mensagem': 'Notificação marcada como lida'})

@app.route('/api/notificacoes/marcar-todas-lidas', methods=['PUT'])
def marcar_todas_notificacoes_lidas():
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
    Notificacao.query.filter_by(usuario_email=user['email'], lida=False).update({'lida': True})
    db.session.commit()
    return jsonify({'mensagem': 'Todas as notificações marcadas como lidas'})

@app.route('/api/notificacoes/<int:notif_id>', methods=['DELETE'])
def deletar_notificacao(notif_id):
    user = get_current_user()
    if not user:
        return jsonify({'erro': 'Não autenticado'}), 401
    notif = Notificacao.query.get(notif_id)  # usar .get() em vez de get_or_404
    if not notif:
        # Já foi removida, retorna sucesso (idempotente)
        return jsonify({'mensagem': 'Notificação já removida'}), 200
    if notif.usuario_email != user['email']:
        return jsonify({'erro': 'Não autorizado'}), 403
    db.session.delete(notif)
    db.session.commit()
    return jsonify({'mensagem': 'Notificação removida'}), 200


# ---------- INICIALIZAÇÃO ----------
with app.app_context():
    db.create_all()

print("\n=== ROTAS REGISTRADAS ===")
for rule in app.url_map.iter_rules():
    print(rule)

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, port=5000)