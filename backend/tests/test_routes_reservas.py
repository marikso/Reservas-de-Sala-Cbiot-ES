from datetime import date, timedelta

from database import db as _db
from models import Sala


def proximo_dia_de_semana():
    d = date.today() + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def criar_sala(app, nome='Sala Teste'):
    with app.app_context():
        sala = Sala(nome=nome)
        _db.session.add(sala)
        _db.session.commit()
        return sala.id


def test_create_reserva_exige_autenticacao(client, app):
    sala_id = criar_sala(app)
    dia = proximo_dia_de_semana().isoformat()
    resp = client.post('/api/reservas', json={
        'sala_id': sala_id, 'titulo': 'Reunião', 'data': dia,
        'hora_inicio': '09:00', 'hora_fim': '10:00', 'responsavel': 'Ana',
    })
    assert resp.status_code == 401


def test_create_reserva_campos_obrigatorios_faltando(client, app, auth_as):
    sala_id = criar_sala(app)
    auth_as('lider_de_grupo')
    resp = client.post('/api/reservas', json={'sala_id': sala_id, 'titulo': 'Reunião'})
    assert resp.status_code == 400


def test_create_reserva_auto_aprovada_para_lider_de_grupo(client, app, auth_as):
    sala_id = criar_sala(app)
    auth_as('lider_de_grupo')
    dia = proximo_dia_de_semana().isoformat()
    resp = client.post('/api/reservas', json={
        'sala_id': sala_id, 'titulo': 'Reunião', 'data': dia,
        'hora_inicio': '09:00', 'hora_fim': '10:00', 'responsavel': 'Ana',
    })
    assert resp.status_code == 201
    assert resp.get_json()['status'] == 'aprovada'


def test_create_reserva_fica_pendente_para_usuario_cbiot(client, app, auth_as):
    sala_id = criar_sala(app)
    auth_as('usuario_cbiot')
    dia = proximo_dia_de_semana().isoformat()
    resp = client.post('/api/reservas', json={
        'sala_id': sala_id, 'titulo': 'Reunião', 'data': dia,
        'hora_inicio': '09:00', 'hora_fim': '10:00', 'responsavel': 'Ana',
    })
    assert resp.status_code == 201
    assert resp.get_json()['status'] == 'pendente'


def test_create_reserva_detecta_conflito_de_horario(client, app, auth_as):
    sala_id = criar_sala(app)
    auth_as('lider_de_grupo')
    dia = proximo_dia_de_semana().isoformat()
    payload = {
        'sala_id': sala_id, 'titulo': 'Reunião', 'data': dia,
        'hora_inicio': '09:00', 'hora_fim': '10:00', 'responsavel': 'Ana',
    }
    primeira = client.post('/api/reservas', json=payload)
    assert primeira.status_code == 201

    segunda = client.post('/api/reservas', json={**payload, 'titulo': 'Outra reunião'})
    assert segunda.status_code == 400
    assert 'Conflito' in segunda.get_json()['erro']


def test_create_reserva_fora_do_horario_comercial(client, app, auth_as):
    sala_id = criar_sala(app)
    auth_as('lider_de_grupo')
    dia = proximo_dia_de_semana().isoformat()
    resp = client.post('/api/reservas', json={
        'sala_id': sala_id, 'titulo': 'Reunião', 'data': dia,
        'hora_inicio': '07:00', 'hora_fim': '08:00', 'responsavel': 'Ana',
    })
    assert resp.status_code == 400
