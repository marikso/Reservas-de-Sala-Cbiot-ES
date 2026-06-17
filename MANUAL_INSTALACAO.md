# Manual de Instalacao — Sistema de Reserva de Salas CBiot/UFRGS

## Sumario

1. [Pre-requisitos](#pre-requisitos)
2. [Clonar o Repositorio](#1-clonar-o-repositorio)
3. [Configurar o Banco de Dados (PostgreSQL)](#2-configurar-o-banco-de-dados-postgresql)
4. [Configurar o Backend (Flask)](#3-configurar-o-backend-flask)
5. [Configurar o Frontend (React + Vite)](#4-configurar-o-frontend-react--vite)
6. [Executar o Sistema](#5-executar-o-sistema)
7. [Criar o Primeiro Usuario Administrador](#6-criar-o-primeiro-usuario-administrador)
8. [Variaveis de Ambiente](#variaveis-de-ambiente)
9. [Deploy em Producao](#deploy-em-producao)
10. [Estrutura do Projeto](#estrutura-do-projeto)
11. [Solucao de Problemas](#solucao-de-problemas)

---

## Pre-requisitos

Antes de iniciar, certifique-se de ter instalado:

| Software | Versao minima | Link |
|---|---|---|
| **Python** | 3.10+ | https://www.python.org/downloads/ |
| **Node.js** | 18+ | https://nodejs.org/ |
| **PostgreSQL** | 14+ | https://www.postgresql.org/download/ |
| **Git** | 2.30+ | https://git-scm.com/downloads |

---

## 1. Clonar o Repositorio

```bash
git clone <URL_DO_REPOSITORIO>
cd ReservaSala
```

---

## 2. Configurar o Banco de Dados (PostgreSQL)

### 2.1. Criar o banco de dados

Acesse o terminal do PostgreSQL (`psql`) ou use uma ferramenta grafica como pgAdmin:

```sql
CREATE DATABASE reservasala;
```

Se quiser usar um usuario diferente do padrao (`postgres`), crie-o:

```sql
CREATE USER meuusuario WITH PASSWORD 'minhasenha';
GRANT ALL PRIVILEGES ON DATABASE reservasala TO meuusuario;
```

### 2.2. Verificar conexao

Certifique-se de que o PostgreSQL esta rodando e acessivel em `localhost:5432` (porta padrao).

---

## 3. Configurar o Backend (Flask)

### 3.1. Acessar a pasta do backend

```bash
cd backend
```

### 3.2. Criar ambiente virtual Python

```bash
python -m venv venv
```

Ativar o ambiente virtual:

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
venv\Scripts\activate
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

### 3.3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3.4. Criar arquivo de variaveis de ambiente

Crie o arquivo `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost/reservasala
SECRET_KEY=sua-chave-secreta-aqui
CORS_ORIGINS=http://localhost:4321,http://localhost:5173
```

> **Importante:** Em producao, substitua `SECRET_KEY` por uma chave forte e aleatoria. Voce pode gerar uma com:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

### 3.5. Criar as tabelas no banco

As tabelas sao criadas automaticamente ao iniciar o backend pela primeira vez. Alternativamente, voce pode forca-las via Python:

```bash
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('Tabelas criadas!')"
```

---

## 4. Configurar o Frontend (React + Vite)

### 4.1. Acessar a pasta do frontend

```bash
cd frontend
```

### 4.2. Instalar dependencias

```bash
npm install
```

### 4.3. Criar arquivo de variaveis de ambiente (opcional)

Crie o arquivo `frontend/.env` caso precise customizar:

```env
VITE_BASE_PATH=/
VITE_API_TARGET=http://localhost:8061
```

> Por padrao, o frontend roda na porta **4321** e faz proxy das chamadas `/api` para o backend na porta **8061**. Nao e necessario alterar se estiver usando as portas padrao.

---

## 5. Executar o Sistema

Voce precisa de **dois terminais** abertos simultaneamente.

### Terminal 1 — Backend

```bash
cd backend
# Ativar ambiente virtual (ver passo 3.2)
python app.py
```

O backend iniciara em: `http://localhost:8061`

Para modo debug:
```bash
# Windows
set FLASK_DEBUG=true
python app.py

# Linux/macOS
FLASK_DEBUG=true python app.py
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

O frontend iniciara em: `http://localhost:4321`

### Acessar o sistema

Abra o navegador em: **http://localhost:4321**

---

## 6. Criar o Primeiro Usuario Administrador

Na primeira execucao, o sistema nao tera usuarios. Para criar o primeiro administrador:

### Opcao 1: Via registro no sistema

1. Acesse `http://localhost:4321`
2. Na tela de login, clique em **Registrar**
3. Preencha nome, e-mail e senha
4. O usuario sera criado com status **pendente**

Depois, promova-o para admin diretamente no banco:

```sql
UPDATE users SET cargo = 'admin', status = 'aprovado' WHERE email = 'seu-email@exemplo.com';
```

### Opcao 2: Via script Python

```bash
cd backend
python -c "
from app import app, db
from models import User

with app.app_context():
    u = User(email='admin@cbiot.ufrgs.br', nome='Administrador', cargo='admin', status='aprovado')
    u.set_password('senha_segura_aqui')
    db.session.add(u)
    db.session.commit()
    print('Admin criado com sucesso!')
"
```

---

## Variaveis de Ambiente

### Backend (`backend/.env`)

| Variavel | Descricao | Valor padrao |
|---|---|---|
| `DATABASE_URL` | String de conexao PostgreSQL | `postgresql://postgres:postgres@localhost/reservasala` |
| `SECRET_KEY` | Chave secreta para JWT e sessoes | `dev-secret-key` |
| `CORS_ORIGINS` | Origens permitidas (separadas por virgula) | `*` |
| `FLASK_DEBUG` | Ativar modo debug | `false` |

### Frontend (`frontend/.env`)

| Variavel | Descricao | Valor padrao |
|---|---|---|
| `VITE_BASE_PATH` | Caminho base da aplicacao | `/` |
| `VITE_API_TARGET` | URL do backend (usado pelo proxy do Vite em dev) | `http://localhost:8061` |

---

## Deploy em Producao

### Backend com Gunicorn

```bash
cd backend
pip install gunicorn
gunicorn app:app --bind 0.0.0.0:8061 --workers 4
```

### Frontend — Build estatico

```bash
cd frontend
npm run build
```

Os arquivos de producao serao gerados na pasta `frontend/dist/`. Sirva-os com qualquer servidor web (Nginx, Apache, etc.).

### Exemplo de configuracao Nginx

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend (arquivos estaticos)
    location / {
        root /caminho/para/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy para o backend
    location /api/ {
        proxy_pass http://127.0.0.1:8061;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Estrutura do Projeto

```
ReservaSala/
├── backend/
│   ├── app.py              # Aplicacao Flask (rotas e logica)
│   ├── models.py           # Modelos do banco (Sala, Reserva, Manutencao, User, Notificacao)
│   ├── database.py         # Instancia do SQLAlchemy
│   ├── config.py           # Configuracoes (variaveis de ambiente)
│   ├── requirements.txt    # Dependencias Python
│   └── .env                # Variaveis de ambiente (criar manualmente)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Componente principal
│   │   ├── api.js          # Funcoes de chamada a API
│   │   ├── styles.css      # Estilos da aplicacao
│   │   └── components/     # Componentes React
│   ├── package.json        # Dependencias Node.js
│   ├── vite.config.js      # Configuracao do Vite
│   └── .env                # Variaveis de ambiente frontend (opcional)
│
├── MANUAL_POR_CARGO.md     # Manual de uso por cargo
└── MANUAL_INSTALACAO.md    # Este arquivo
```

---

## Solucao de Problemas

### Erro de conexao com o banco de dados

```
sqlalchemy.exc.OperationalError: could not connect to server
```

- Verifique se o PostgreSQL esta rodando
- Confirme a `DATABASE_URL` no arquivo `backend/.env`
- Teste a conexao: `psql -U postgres -d reservasala`

### Erro de CORS no navegador

```
Access to fetch has been blocked by CORS policy
```

- Verifique se `CORS_ORIGINS` no `backend/.env` inclui a URL do frontend (ex: `http://localhost:4321`)

### Porta ja em uso

```
Address already in use
```

- Backend: altere a porta em `app.py` (linha `app.run(port=8061)`)
- Frontend: altere a porta em `vite.config.js` (campo `server.port`)

### Modulo nao encontrado (Python)

```
ModuleNotFoundError: No module named 'flask'
```

- Verifique se o ambiente virtual esta ativado
- Execute `pip install -r requirements.txt` novamente

### Dependencias do frontend

```
Module not found: Can't resolve ...
```

- Execute `npm install` na pasta `frontend/`
- Apague `node_modules` e reinstale: `rm -rf node_modules && npm install`

### Token JWT expirado

- O token expira em **24 horas** por padrao
- Faca logout e login novamente
