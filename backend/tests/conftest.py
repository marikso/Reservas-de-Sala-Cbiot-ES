import os
import sys
import tempfile

import pytest

# Precisa ser definido ANTES de importar `app`/`config`, pois Config lê a
# variável de ambiente no momento em que o módulo é carregado.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix='.db')
os.environ['DATABASE_URL'] = f'sqlite:///{_DB_PATH}'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import app as app_module  # noqa: E402  (import depende do setdefault acima)
from database import db as _db  # noqa: E402


@pytest.fixture()
def app():
    app_module.app.config.update(TESTING=True)
    yield app_module.app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Limpa todas as tabelas antes de cada teste para garantir isolamento."""
    with app.app_context():
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()
    yield


@pytest.fixture()
def auth_as(monkeypatch):
    """Permite simular o usuário autenticado atual em testes de rota.

    Uso: auth_as('admin') simula um admin autenticado.
         auth_as() (sem argumentos) simula um visitante não autenticado.
    """
    def _set(role=None, email='user@test.com', nome='Usuário Teste', user_id=1, permissions=None):
        if role is None:
            monkeypatch.setattr(app_module, 'get_current_user', lambda: None)
            return None
        user = {
            'id': user_id,
            'nome': nome,
            'email': email,
            'cargo': role,
            'permissions': permissions or [],
        }
        monkeypatch.setattr(app_module, 'get_current_user', lambda: user)
        return user
    return _set
