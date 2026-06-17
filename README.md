# ReservaSala

Sistema de reserva de salas do Centro de Biotecnologia (CBiot) da UFRGS. Backend em Flask + PostgreSQL, frontend em React (Vite).

---

## Autenticacao

O sistema possui login e registro proprio. O fluxo e:

1. O usuario acessa a aplicacao e ve a tela de login (`LoginPage.jsx`).
2. Pode fazer login com e-mail e senha ou criar uma conta nova (registro).
3. Ao autenticar, o backend gera um token JWT (valido por 24 horas) que e armazenado no `localStorage` (chave `auth_token`).
4. O frontend envia o token em toda requisicao como `Authorization: Bearer <token>`.
5. O backend valida o token localmente via `get_current_user()` em `app.py`.
6. Logout limpa o token local e redireciona para a tela de login.

### Cargos e permissoes

#### Administrador (`admin`)
- Controle total do sistema
- Aprova, rejeita, edita e cancela qualquer reserva ou solicitacao
- Gerencia salas (criar, editar, excluir, colocar em manutencao)
- Gerencia usuarios (visualiza e altera cargos)
- Visualiza relatorios e historico de todas as reservas
- Reservas criadas por ele sao aprovadas automaticamente

#### Gerente (`gerente`)
- Gerencia reservas: aprova, rejeita, edita e cancela qualquer reserva ou solicitacao
- Visualiza relatorios e historico de todas as reservas
- Reservas criadas por ele sao aprovadas automaticamente
- Nao gerencia salas nem usuarios

#### Lider de Grupo (`lider_de_grupo`)
Perfil: **professores, tecnicos e servidores**.
- Cria reservas diretamente — aprovadas automaticamente, sem aprovacao previa
- Tem prioridade sobre reservas pendentes de usuarios comuns
- Visualiza e cancela suas proprias reservas
- Nao acessa o painel administrativo

#### Usuario (`usuario_cbiot`)
Perfil: **alunos** e demais pessoas.
- Envia **solicitacoes** de reserva que ficam **pendentes** ate um admin/gerente aprovar ou rejeitar
- Visualiza suas solicitacoes pendentes, reservas ativas e historico
- Nao acessa o painel administrativo nem cria reservas diretamente

---

## Pre-requisitos

- **Python 3.10+**
- **Node.js 18+** e npm
- **PostgreSQL** em execucao

---

## Backend (Flask)

```bash
cd backend
python -m venv venv
```

Ative o ambiente virtual:

```bash
# Linux/Mac
source venv/bin/activate
# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
# Windows (CMD)
venv\Scripts\activate
```

Instale as dependencias:

```bash
pip install -r requirements.txt
```

Configure o `.env` (copie de `.env.example`):

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/reservasala
SECRET_KEY=uma-chave-secreta
```

Crie o banco (as tabelas sao criadas automaticamente na primeira execucao via `db.create_all()`):

```sql
CREATE DATABASE reservasala;
```

Rode o servidor:

```bash
python app.py
```

Backend: http://localhost:8061

### Testes do backend

```bash
cd backend
python -m pytest
```

---

## Frontend (React + Vite)

```bash
cd frontend
npm install
```

Variaveis de ambiente opcionais (`frontend/.env`):

```env
VITE_BASE_PATH=/
VITE_API_TARGET=http://localhost:8061
```

Rode a aplicacao:

```bash
npm run dev
```

Frontend: http://localhost:4321

O Vite faz proxy automatico das chamadas `/api` para o backend (configurado em `vite.config.js`).

### Testes do frontend

```bash
cd frontend
npm test
```

---

## Principais endpoints da API

### Autenticacao

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST   | `/api/auth/register` | Registra novo usuario |
| POST   | `/api/auth/login` | Login (retorna token JWT) |
| GET    | `/api/auth/whoami` | Identidade do usuario atual |

### Salas

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/salas` | Lista salas |
| POST   | `/api/salas` | Cria sala (admin) |
| PUT    | `/api/salas/<id>` | Edita sala (admin) |
| DELETE | `/api/salas/<id>` | Remove sala (admin) |
| GET    | `/api/salas/disponiveis` | Salas disponiveis em um intervalo |

### Reservas

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/reservas` | Lista reservas aprovadas |
| POST   | `/api/reservas` | Cria reserva |
| PUT    | `/api/reservas/<id>` | Edita reserva |
| DELETE | `/api/reservas/<id>` | Cancela reserva |
| POST   | `/api/reservas/recorrente` | Cria reserva recorrente (serie) |
| GET    | `/api/reservas/<id>` | Detalhes de uma reserva |
| DELETE | `/api/reservas/grupo/<grupo_id>` | Cancela serie (admin/gerente) |
| DELETE | `/api/reservas/grupo/<grupo_id>/user` | Cancela serie propria |

### Disponibilidade

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/disponibilidade` | Blocos de horario livres/ocupados de uma sala |

### Solicitacoes

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/solicitacoes` | Solicitacoes pendentes (admin/gerente) |
| GET    | `/api/solicitacoes/rejeitadas` | Historico de rejeitadas (admin/gerente) |
| POST   | `/api/solicitacoes/<id>/aprovar` | Aprova solicitacao |
| POST   | `/api/solicitacoes/<id>/rejeitar` | Rejeita solicitacao |
| GET    | `/api/minhas-solicitacoes` | Solicitacoes do usuario logado |

### Manutencoes

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/manutencoes` | Lista manutencoes |
| POST   | `/api/manutencoes` | Cria manutencao (admin) |
| DELETE | `/api/manutencoes/<id>` | Remove manutencao (admin) |

### Usuarios

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/users` | Lista usuarios (admin/gerente) |
| PUT    | `/api/users/<id>` | Altera cargo/status (admin) |
| POST   | `/api/users/<id>/approve` | Aprova usuario pendente (admin) |

### Notificacoes

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET    | `/api/notificacoes` | Notificacoes do usuario |
| PUT    | `/api/notificacoes/<id>/lida` | Marca como lida |
| PUT    | `/api/notificacoes/todas-lidas` | Marca todas como lidas |
| DELETE | `/api/notificacoes/<id>` | Remove notificacao |

---

## Estrutura do projeto

```
ReservaSala/
├── backend/
│   ├── app.py              # Rotas, regras de negocio, autenticacao JWT
│   ├── config.py           # Configuracoes (lidas do .env)
│   ├── database.py         # Inicializacao do SQLAlchemy
│   ├── models.py           # Sala, Reserva, Manutencao, User, Notificacao
│   ├── requirements.txt    # Dependencias Python
│   ├── .env.example        # Modelo de variaveis de ambiente
│   └── tests/              # Testes pytest
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # Rotas ("/" → LoginPage, "/ReservaDeSalas" → App)
│   │   ├── LoginPage.jsx      # Tela de login e registro
│   │   ├── App.jsx            # Aplicacao principal (dashboard)
│   │   ├── api.js             # Comunicacao com a API e gerenciamento de token
│   │   ├── styles.css         # Estilos da aplicacao
│   │   └── components/
│   │       └── ReservaModal.jsx  # Modal de criacao de reserva
│   ├── package.json
│   └── vite.config.js
│
├── MANUAL_INSTRUCOES_USUARIO.md   # Manual de uso por cargo
├── MANUAL_INSTALACAO.md           # Guia completo de instalacao
└── README.md                      # Este arquivo
```

---

## Producao

- Defina `DATABASE_URL` e `SECRET_KEY` com valores reais de producao
- Sirva o backend com um servidor WSGI (ex.: Gunicorn — ja esta em `requirements.txt`):
  ```bash
  gunicorn app:app --bind 0.0.0.0:8061 --workers 4
  ```
- Gere o build do frontend com `npm run build` e sirva os arquivos de `frontend/dist/` com Nginx ou similar
- Nunca suba `.env`, `venv/` ou `node_modules/` para o repositorio
