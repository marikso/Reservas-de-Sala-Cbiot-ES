from datetime import date, time

from models import Manutencao, Reserva, Sala, User


def test_user_set_and_check_password():
    user = User(email='a@a.com', nome='Ana', cargo='admin', status='aprovado')
    user.set_password('minhasenha')
    assert user.check_password('minhasenha') is True
    assert user.check_password('senhaerrada') is False


def test_user_check_password_sem_hash_retorna_false():
    user = User(email='a@a.com', nome='Ana', cargo='admin', status='aprovado', password_hash=None)
    assert user.check_password('qualquer') is False


def test_user_to_dict_normaliza_cargo_invalido():
    user = User(email='a@a.com', nome='Ana', cargo='cargo_inexistente', status='aprovado', password_hash='x')
    assert user.to_dict()['cargo'] == 'usuario_cbiot'


def test_user_to_dict_sem_status():
    user = User(email='a@a.com', nome='Ana', cargo='admin', status='aprovado', password_hash='x')
    dados = user.to_dict(include_status=False)
    assert 'status' not in dados
    assert dados['email'] == 'a@a.com'


def test_sala_to_dict():
    sala = Sala(nome='Sala 101', bloco='A', andar='1', capacidade=10, equipamentos='Projetor', avisos='')
    assert sala.to_dict() == {
        'id': None,
        'nome': 'Sala 101',
        'bloco': 'A',
        'andar': '1',
        'capacidade': 10,
        'equipamentos': 'Projetor',
        'avisos': '',
    }


def test_reserva_to_dict():
    sala = Sala(nome='Sala 101')
    reserva = Reserva(
        sala=sala,
        titulo='Reunião de equipe',
        data=date(2026, 6, 16),
        hora_inicio=time(9, 0),
        hora_fim=time(10, 0),
        responsavel='Ana',
        email='ana@a.com',
        status='aprovada',
    )
    dados = reserva.to_dict()
    assert dados['sala_nome'] == 'Sala 101'
    assert dados['data'] == '2026-06-16'
    assert dados['hora_inicio'] == '09:00'
    assert dados['hora_fim'] == '10:00'
    assert dados['status'] == 'aprovada'


def test_manutencao_to_dict():
    sala = Sala(nome='Sala 101')
    manutencao = Manutencao(
        sala=sala,
        data_inicio=date(2026, 6, 16),
        data_fim=date(2026, 6, 17),
        hora_inicio=time(8, 0),
        hora_fim=time(19, 0),
        motivo='Limpeza',
    )
    dados = manutencao.to_dict()
    assert dados['sala_nome'] == 'Sala 101'
    assert dados['data_inicio'] == '2026-06-16'
    assert dados['data_fim'] == '2026-06-17'
    assert dados['motivo'] == 'Limpeza'
