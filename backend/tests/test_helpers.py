from datetime import date, time, timedelta

from app import (
    map_permissions_to_role,
    normalize_cargo,
    parse_date,
    parse_time,
    validate_business_hours,
)


def proximo_dia_de_semana():
    d = date.today() + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def proximo_fim_de_semana():
    d = date.today() + timedelta(days=1)
    while d.weekday() < 5:
        d += timedelta(days=1)
    return d


def test_parse_date():
    assert parse_date('2026-06-16') == date(2026, 6, 16)


def test_parse_time_simples():
    assert parse_time('08:00') == time(8, 0)


def test_parse_time_com_segundos():
    assert parse_time('08:00:30') == time(8, 0)


def test_normalize_cargo_valido():
    assert normalize_cargo('admin') == 'admin'


def test_normalize_cargo_invalido_cai_para_usuario_cbiot():
    assert normalize_cargo('cargo_inexistente') == 'usuario_cbiot'


def test_map_permissions_to_role_admin():
    assert map_permissions_to_role(['SALAS_ADMIN']) == 'admin'


def test_map_permissions_to_role_prioriza_admin_sobre_gerente():
    assert map_permissions_to_role(['SALAS_GERENTE', 'SALAS_ADMIN']) == 'admin'


def test_map_permissions_to_role_acesso_basico():
    assert map_permissions_to_role(['ACCESS_RESERVA_SALAS']) == 'usuario_cbiot'


def test_map_permissions_to_role_sem_permissoes():
    assert map_permissions_to_role([]) is None


def test_validate_business_hours_data_passada():
    ontem = date.today() - timedelta(days=1)
    erro = validate_business_hours(ontem, time(9, 0), time(10, 0))
    assert erro == 'Não é possível reservar para datas já passadas'


def test_validate_business_hours_fim_de_semana():
    erro = validate_business_hours(proximo_fim_de_semana(), time(9, 0), time(10, 0))
    assert erro == 'Reservas não são permitidas aos sábados e domingos'


def test_validate_business_hours_fora_da_meia_hora():
    erro = validate_business_hours(proximo_dia_de_semana(), time(9, 15), time(10, 0))
    assert erro == 'Reservas devem começar e terminar na hora cheia ou meia hora'


def test_validate_business_hours_inicio_depois_do_fim():
    erro = validate_business_hours(proximo_dia_de_semana(), time(10, 0), time(9, 0))
    assert erro == 'Hora de início deve ser anterior à hora de fim'


def test_validate_business_hours_fora_do_expediente():
    erro = validate_business_hours(proximo_dia_de_semana(), time(7, 0), time(8, 0))
    assert erro == 'Reservas só podem ocorrer entre 08:00 e 19:00'


def test_validate_business_hours_valido():
    erro = validate_business_hours(proximo_dia_de_semana(), time(9, 0), time(10, 0))
    assert erro is None
