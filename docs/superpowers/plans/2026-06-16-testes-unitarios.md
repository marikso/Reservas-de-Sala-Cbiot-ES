# Testes Unitários (Backend + Modelos + Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma suíte de testes unitários/de integração para o backend Flask (funções auxiliares, modelos SQLAlchemy e rotas críticas) e para o frontend React (lógica de token e o componente `ReservaModal`), sem alterar comportamento de produção.

**Architecture:** Backend usa `pytest` com um app Flask de teste apontando para SQLite (arquivo temporário), substituindo `get_current_user` via monkeypatch para simular usuários autenticados de cada cargo. Frontend usa `vitest` + `@testing-library/react` com `jsdom`, mockando o módulo `../api` para isolar o componente de chamadas de rede reais.

**Tech Stack:** pytest (backend), Flask test client, SQLite em arquivo temporário, vitest + @testing-library/react + jsdom (frontend).

---

## Contexto para quem for executar

- Não existe nenhum framework de teste configurado hoje no repositório (`backend/requirements.txt` não tem pytest; `frontend/package.json` não tem vitest/jest).
- `backend/app.py` cria a aplicação Flask e chama `db.create_all()` **no nível do módulo** (linhas finais do arquivo), usando a URI definida em `backend/config.py` via `os.getenv('DATABASE_URL', 'postgresql://...')`. Para os testes não tocarem no Postgres real, a variável de ambiente `DATABASE_URL` precisa ser definida (para um arquivo SQLite) **antes** de `app.py` ser importado pela primeira vez. Isso é feito no topo de `backend/tests/conftest.py`.
- `get_current_user()` (definida em `backend/app.py`) é a função usada por todas as rotas autenticadas e pelo decorator `role_required`. Nos testes de rota, ela é substituída via `monkeypatch.setattr` por uma fixture `auth_as`.
- O projeto roda em Windows; o Python do backend fica em `backend/venv/Scripts/python.exe`.

---

### Task 1: Setup do ambiente de testes do backend

**Files:**
- Create: `backend/requirements-dev.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Criar `backend/requirements-dev.txt`**

```
-r requirements.txt
pytest==8.3.3
```

- [ ] **Step 2: Criar `backend/pytest.ini`**

```ini
[pytest]
testpaths = tests
```

- [ ] **Step 3: Criar `backend/tests/__init__.py` (vazio)**

```python
```

- [ ] **Step 4: Criar `backend/tests/conftest.py`**

```python
import os
import sys
import tempfile

import pytest

# Precisa ser definido ANTES de importar `app`/`config`, pois Config lê a
# variável de ambiente no momento em que o módulo é carregado.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix='.db')
os.environ['DATABASE_URL'] = f'sqlite:///{_DB_PATH}'
os.environ['DEV_MOCK_USER'] = ''

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
```

- [ ] **Step 5: Instalar dependências de teste**

Run: `backend/venv/Scripts/pip.exe install -r backend/requirements-dev.txt`
Expected: instalação concluída sem erros, `pytest` listado em "Successfully installed".

- [ ] **Step 6: Rodar a suíte (ainda vazia) para validar o setup**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests -v`
Expected: `no tests ran` (sem erros de import/configuração). Se houver erro ao importar `app`, revisar Step 4 antes de continuar.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements-dev.txt backend/pytest.ini backend/tests/__init__.py backend/tests/conftest.py
git commit -m "test: configura ambiente pytest para o backend"
```

---

### Task 2: Testes das funções auxiliares (`tests/test_helpers.py`)

**Files:**
- Test: `backend/tests/test_helpers.py`

- [ ] **Step 1: Escrever os testes**

```python
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
```

- [ ] **Step 2: Rodar os testes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_helpers.py -v`
Expected: `15 passed`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_helpers.py
git commit -m "test: cobre funções auxiliares de data/hora/permissões em app.py"
```

---

### Task 3: Testes dos modelos (`tests/test_models.py`)

**Files:**
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Escrever os testes**

```python
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
```

- [ ] **Step 2: Rodar os testes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_models.py -v`
Expected: `7 passed`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_models.py
git commit -m "test: cobre métodos to_dict e senha dos modelos SQLAlchemy"
```

---

### Task 4: Testes de rotas de salas (`tests/test_routes_salas.py`)

**Files:**
- Test: `backend/tests/test_routes_salas.py`

- [ ] **Step 1: Escrever os testes**

```python
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
```

- [ ] **Step 2: Rodar os testes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_routes_salas.py -v`
Expected: `6 passed`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_routes_salas.py
git commit -m "test: cobre rota /api/salas (listagem, criação e controle de acesso)"
```

---

### Task 5: Testes de rotas de reservas (`tests/test_routes_reservas.py`)

**Files:**
- Test: `backend/tests/test_routes_reservas.py`

- [ ] **Step 1: Escrever os testes**

```python
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
```

- [ ] **Step 2: Rodar os testes**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_routes_reservas.py -v`
Expected: `6 passed`

- [ ] **Step 3: Rodar a suíte completa do backend**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests -v`
Expected: `34 passed` (15 + 7 + 6 + 6 dos Tasks 2-5)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_routes_reservas.py
git commit -m "test: cobre rota /api/reservas (auth, conflitos, aprovação por cargo)"
```

---

### Task 6: Setup do Vitest no frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.js`
- Create: `frontend/src/setupTests.js`

- [ ] **Step 1: Instalar as dependências de teste**

Run: `cd frontend && npm install --save-dev vitest@^2.1.8 @testing-library/react@^16.0.1 @testing-library/jest-dom@^6.6.3 jsdom@^25.0.1`
Expected: dependências adicionadas em `devDependencies` no `package.json`, sem erros.

- [ ] **Step 2: Adicionar script de teste em `frontend/package.json`**

No bloco `"scripts"`, adicionar a chave `"test"`:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Criar `frontend/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true,
  },
});
```

- [ ] **Step 4: Criar `frontend/src/setupTests.js`**

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Rodar a suíte (ainda vazia) para validar o setup**

Run: `cd frontend && npm run test`
Expected: `No test files found` (sem erros de configuração).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.js frontend/src/setupTests.js
git commit -m "test: configura vitest e testing-library no frontend"
```

---

### Task 7: Testes de gerenciamento de token (`src/api.test.js`)

**Files:**
- Test: `frontend/src/api.test.js`

- [ ] **Step 1: Escrever os testes**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, removeToken } from './api';

describe('gerenciamento de token de autenticação', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna null quando não há token salvo', () => {
    expect(getToken()).toBeNull();
  });

  it('salva e recupera o token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('remove o token salvo', () => {
    setToken('abc123');
    removeToken();
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes**

Run: `cd frontend && npm run test -- src/api.test.js`
Expected: `3 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api.test.js
git commit -m "test: cobre funções de gerenciamento de token em api.js"
```

---

### Task 8: Testes do componente `ReservaModal`

**Files:**
- Test: `frontend/src/components/ReservaModal.test.jsx`

- [ ] **Step 1: Escrever os testes**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReservaModal from './ReservaModal';

vi.mock('../api', () => ({
  createReserva: vi.fn(),
  createReservaRecorrente: vi.fn(),
  getDisponibilidade: vi.fn(() => Promise.resolve({ horarios: [] })),
  deleteReservasByGrupo: vi.fn(),
}));

const salas = [{ id: 1, nome: 'Sala A' }];
const currentUser = { nome: 'Ana', email: 'ana@x.com' };

describe('ReservaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza nada quando isOpen é false', () => {
    const { container } = render(
      <ReservaModal
        isOpen={false}
        onClose={() => {}}
        salas={salas}
        currentUser={currentUser}
        userRole="lider_de_grupo"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('exibe erro ao tentar enviar sem selecionar uma sala', async () => {
    render(
      <ReservaModal
        isOpen={true}
        onClose={() => {}}
        salas={salas}
        currentUser={currentUser}
        userRole="lider_de_grupo"
      />
    );

    fireEvent.click(screen.getByText('Confirmar reserva'));

    expect(await screen.findByText('Selecione uma sala.')).toBeInTheDocument();
  });

  it('chama onClose ao clicar em Cancelar', () => {
    const onClose = vi.fn();
    render(
      <ReservaModal
        isOpen={true}
        onClose={onClose}
        salas={salas}
        currentUser={currentUser}
        userRole="lider_de_grupo"
      />
    );

    fireEvent.click(screen.getByText('Cancelar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar os testes**

Run: `cd frontend && npm run test -- src/components/ReservaModal.test.jsx`
Expected: `3 passed`

- [ ] **Step 3: Rodar a suíte completa do frontend**

Run: `cd frontend && npm run test`
Expected: `6 passed` (3 de `api.test.js` + 3 de `ReservaModal.test.jsx`)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ReservaModal.test.jsx
git commit -m "test: cobre validações e fechamento do ReservaModal"
```

---

## Resumo da cobertura

| Área | Arquivo | O que cobre |
|---|---|---|
| Backend — helpers | `tests/test_helpers.py` | `parse_date`, `parse_time`, `validate_business_hours`, `normalize_cargo`, `map_permissions_to_role` |
| Backend — modelos | `tests/test_models.py` | hash de senha do `User`, normalização de cargo, `to_dict()` de `Sala`/`Reserva`/`Manutencao` |
| Backend — rotas | `tests/test_routes_salas.py`, `tests/test_routes_reservas.py` | listagem com flag de manutenção, controle de acesso (`role_required`), criação de reserva (auth, validação, conflito, aprovação automática por cargo) |
| Frontend — token | `src/api.test.js` | `getToken`/`setToken`/`removeToken` |
| Frontend — componente | `src/components/ReservaModal.test.jsx` | renderização condicional, validação do formulário, botão cancelar |
