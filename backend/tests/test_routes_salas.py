from datetime import date, time, timedelta

from database import db as _db
from models import Manutencao, Sala


def test_get_salas_vazio(client):
    resp = client.get('/api/salas')
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_get_salas_marca_em_manutencao(client, app):
    with app.app_context():
        sala_livre = Sala(nome='Sala Livre', bloco='A', andar='1', capacidade=10)
        sala_manutencao = Sala(nome='Sala em Manutenção', bloco='B', andar='2', capacidade=5)
        _db.session.add_all([sala_livre, sala_manutencao])
        _db.session.flush()
        hoje = date.today()
        manut = Manutencao(
            sala_id=sala_manutencao.id,
            data_inicio=hoje,
            data_fim=hoje + timedelta(days=1),
            hora_inicio=time(8, 0),
            hora_fim=time(19, 0),
            motivo='Limpeza',
        )
        _db.session.add(manut)
        _db.session.commit()

    resp = client.get('/api/salas')
    assert resp.status_code == 200
    por_nome = {s['nome']: s for s in resp.get_json()}
    assert por_nome['Sala Livre']['em_manutencao'] is False
    assert por_nome['Sala em Manutenção']['em_manutencao'] is True


def test_create_sala_sem_autenticacao_eh_proibido(client, auth_as):
    auth_as()  # não autenticado
    resp = client.post('/api/salas', json={'nome': 'Sala Nova'})
    assert resp.status_code == 403


def test_create_sala_com_cargo_sem_permissao_eh_proibido(client, auth_as):
    auth_as('usuario_cbiot')
    resp = client.post('/api/salas', json={'nome': 'Sala Nova'})
    assert resp.status_code == 403


def test_create_sala_como_admin(client, auth_as):
    auth_as('admin')
    resp = client.post('/api/salas', json={
        'nome': 'Sala Nova', 'bloco': 'C', 'andar': '3', 'capacidade': 8,
    })
    assert resp.status_code == 201
    body = resp.get_json()
    assert body['nome'] == 'Sala Nova'
    assert body['capacidade'] == 8


def test_create_sala_com_nome_duplicado(client, auth_as, app):
    with app.app_context():
        _db.session.add(Sala(nome='Sala Existente'))
        _db.session.commit()

    auth_as('admin')
    resp = client.post('/api/salas', json={'nome': 'Sala Existente'})
    assert resp.status_code == 400
    assert 'erro' in resp.get_json()
