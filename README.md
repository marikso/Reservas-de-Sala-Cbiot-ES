# 📘 ReservaSala

Sistema de reserva de salas do CBiot. Backend em Flask + PostgreSQL, frontend em React (Vite). A autenticação é centralizada em um **Portal** externo — o ReservaSala não tem login próprio, apenas confia no token emitido pelo Portal.

---

## 🔐 Autenticação (Portal centralizado)

O login **não é feito neste sistema**. O fluxo é:

1. Usuário acessa o ReservaSala sem sessão válida → é redirecionado para a tela de login do Portal (`PortalGate`, em `frontend/src/PortalGate.jsx`).
2. O Portal autentica e redireciona de volta para o ReservaSala com `?token=<token>` na URL.
3. O frontend salva esse token (`localStorage`, chave `auth_token`) e passa a enviá-lo em todo request como `Authorization: Bearer <token>`.
4. O backend nunca valida o token sozinho: a cada request ele consulta `GET {PORTAL_AUTH_URL}/api/auth/me` no Portal (função `get_current_user()` em `backend/app.py`) para confirmar quem é o usuário e quais permissões ele tem.
5. "Voltar ao Portal" (logout) limpa o token local e redireciona de volta à tela de login do Portal.

As **permissões do Portal** são mapeadas para um **cargo interno** do ReservaSala (`PORTAL_PERMISSION_MAP` em `app.py`):

| Permissão no Portal | Cargo interno      |
|---------------------|--------------------|
| `SALAS_ADMIN`        | `admin`            |
| `SALAS_GERENTE`      | `gerente`          |
| `SALAS_LIDER`        | `lider_de_grupo`   |
| `SALAS_USER`         | `usuario_cbiot`    |
| `ACCESS_RESERVA_SALAS` (fallback, sem cargo específico) | `usuario_cbiot` |

Sem a permissão `ACCESS_RESERVA_SALAS`, o usuário é tratado como não autenticado e bloqueado.

A tela **Gerenciar Usuários** (admin) só altera o **cargo interno** de quem já passou pela autenticação do Portal — não cria login nem senha, isso é responsabilidade exclusiva do Portal.

### Cargos e permissões

#### Administrador (`admin`)
- Controle total do sistema
- Aprova, rejeita, edita e cancela qualquer reserva ou solicitação
- Gerencia salas (criar, editar, excluir, colocar em manutenção)
- Gerencia usuários (visualiza e altera cargos internos)
- Visualiza relatórios e histórico de todas as reservas
- Reservas criadas por ele são aprovadas automaticamente

#### Gerente (`gerente`)
- Apenas gerencia reservas: aprova, rejeita, edita e cancela qualquer reserva ou solicitação
- Visualiza relatórios e histórico de todas as reservas
- Reservas criadas por ele são aprovadas automaticamente
- Não gerencia salas nem usuários

#### Líder de Grupo (`lider_de_grupo`)
Perfil: **professores, técnicos e servidores**.
- Cria reservas diretamente — aprovadas automaticamente, sem aprovação prévia de um gerente
- Visualiza e cancela suas próprias reservas
- Não acessa o painel administrativo

#### Usuário (`usuario_cbiot`)
Perfil: **alunos** e demais pessoas que precisam de aprovação prévia.
- Envia **solicitações** de reserva, que ficam **pendentes** até um admin/gerente aprovar ou rejeitar
- Visualiza suas solicitações pendentes, reservas ativas e histórico
- Não acessa o painel administrativo nem cria reservas diretamente

---

## 📌 Pré-requisitos

- **Python 3.10+**
- **Node.js 18+** e npm
- **PostgreSQL** em execução
- Uma URL de **Portal de autenticação** que implemente `POST /api/auth/login` e `GET /api/auth/me` (em dev, sem o Portal real disponível, é possível simular esses dois endpoints localmente)

---

## ⚙️ Backend (Flask)

```bash
cd backend
python -m venv venv
```

Ative o ambiente virtual:

```bash
# Linux/Mac
source venv/bin/activate
# Windows
venv\Scripts\activate
```

Instale as dependências:

```bash
pip install -r requirements.txt
```

Configure o `.env` (copie de `.env.example`):

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/reservasala
SECRET_KEY=uma-chave-secreta
PORTAL_AUTH_URL=http://localhost:3000
```

Crie o banco (as tabelas são criadas automaticamente na primeira execução, via `db.create_all()`):

```sql
CREATE DATABASE reservasala;
```

Rode o servidor:

```bash
python app.py
```

📍 Backend: http://localhost:5000

### Testes do backend

```bash
cd backend
python -m pytest
```

---

## 🎨 Frontend (React + Vite)

```bash
cd frontend
npm install
```

Variáveis de ambiente opcionais (`frontend/.env`):

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_PORTAL_LOGIN_URL=http://localhost:3000/login
VITE_BASE_PATH=/
```

Rode a aplicação:

```bash
npm run dev
```

📍 Frontend: http://localhost:5173 (a porta sobe automaticamente se já estiver em uso)

### Testes do frontend

```bash
cd frontend
npm test
```

---

## 🔌 Principais endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET    | `/api/auth/whoami` | Identidade do usuário atual (consulta o Portal) |
| GET    | `/api/salas` | Lista salas |
| POST/PUT/DELETE | `/api/salas[/<id>]` | Gerencia salas (admin) |
| GET/POST | `/api/reservas` | Lista / cria reservas |
| PUT/DELETE | `/api/reservas/<id>` | Edita / cancela reserva |
| POST   | `/api/reservas/recorrente` | Cria reserva recorrente (série) |
| GET    | `/api/disponibilidade` | Blocos de horário livres/ocupados de uma sala |
| GET    | `/api/salas/disponiveis` | Salas disponíveis em um intervalo |
| GET    | `/api/solicitacoes` | Solicitações pendentes (admin/gerente) |
| POST   | `/api/solicitacoes/<id>/aprovar` \| `/rejeitar` | Aprova/rejeita solicitação |
| GET    | `/api/minhas-solicitacoes` | Solicitações do usuário logado |
| GET/POST/DELETE | `/api/manutencoes[/<id>]` | Gerencia manutenções de sala (admin) |
| GET    | `/api/users` | Lista usuários (admin/gerente) |
| PUT    | `/api/users/<id>` | Altera cargo/status (admin) |
| POST   | `/api/users/<id>/approve` | Aprova usuário pendente |
| GET    | `/api/notificacoes` | Notificações do usuário |
| PUT/DELETE | `/api/notificacoes/<id>...` | Marca como lida / remove notificação |

---

## 📁 Estrutura do projeto

```
ReservaSala/
├── backend/
│   ├── app.py              # Rotas, regras de negócio, auth via Portal
│   ├── config.py           # Configurações (lidas do .env)
│   ├── database.py         # Inicialização do SQLAlchemy
│   ├── models.py           # Sala, Reserva, Manutencao, User, Notificacao
│   ├── seed_users.py       # Popula a tabela local de usuários para testes
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/              # Testes pytest
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.jsx           # Rotas (PortalGate em "/", App em "/ReservaDeSalas")
│   │   ├── PortalGate.jsx     # Captura o token devolvido pelo Portal
│   │   ├── App.jsx            # Aplicação principal
│   │   ├── api.js             # Comunicação com a API e gerenciamento de token
│   │   └── components/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🚀 Produção

- Defina `DATABASE_URL`, `SECRET_KEY` e `PORTAL_AUTH_URL` com os valores reais de produção
- Sirva o backend com um servidor WSGI (ex.: Gunicorn — já está em `requirements.txt`)
- Gere o build do frontend com `npm run build` e ajuste `VITE_API_BASE_URL` / `VITE_PORTAL_LOGIN_URL` para os domínios reais
- Nunca suba `.env`, `venv/` ou `node_modules/` para o repositório
