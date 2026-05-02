# Pré-requisitos

- Python 3.8 ou superior  
- Node.js 18+ e npm (para o frontend)  
- PostgreSQL instalado e em execução  
- Git (opcional, para clonar o repositório)  

---

# Backend (Flask)

## Acesse a pasta do backend
```bash
cd backend
```

## Crie e ative um ambiente virtual
```bash
python -m venv venv
```

### Linux/Mac
```bash
source venv/bin/activate
```

### Windows
```bash
venv\Scripts\activate
```

## Instale as dependências
```bash
pip install -r requirements.txt
```

Se não tiver o arquivo `requirements.txt`, instale manualmente:

```bash
pip install Flask Flask-SQLAlchemy Flask-Cors Flask-Session psycopg2-binary python-dotenv
```

## Configure as variáveis de ambiente

Copie o arquivo de exemplo e edite:

```bash
cp .env.example .env
```

Edite o `.env` com os dados do seu banco PostgreSQL:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/reservasala
ADMIN_PASSWORD=admin123
SECRET_KEY=uma-chave-secreta-qualquer
```

## Crie o banco de dados (se ainda não existir)

Acesse o PostgreSQL (ex.: `psql -U postgres`) e execute:

```sql
CREATE DATABASE reservasala;
```

## Execute o backend
```bash
python app.py
```

O servidor Flask iniciará em:  
👉 http://localhost:5000

---

# Frontend (React)

## Acesse a pasta do frontend
```bash
cd frontend
```

## Instale as dependências
```bash
npm install
```

## Configure a URL da API (opcional)

Por padrão, o frontend aponta para `http://localhost:5000`.  
Se o backend estiver em outra porta/host, edite `src/api.js` ou crie um arquivo `.env` na raiz do frontend:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Execute o frontend
```bash
npm run dev
```

O frontend estará disponível em:  
👉 http://localhost:5173

---

# Acessando a aplicação

- Página pública (reservas): http://localhost:5173  
- Área administrativa: http://localhost:5173/admin  
  - Senha definida no `.env` (padrão: `admin123`)

---

# Resumo dos comandos essenciais

| Componente        | Comando para iniciar                  |
|------------------|--------------------------------------|
| Backend (Flask)  | `cd backend && python app.py`         |
| Frontend (React) | `cd frontend && npm run dev`          |

---

# Observações

- Certifique-se de que o PostgreSQL esteja rodando antes de iniciar o backend.  
- As tabelas são criadas automaticamente na primeira execução.  
- Para produção:
  - Altere as senhas  
  - Utilize um servidor WSGI (ex.: Gunicorn)  
  - Sirva o frontend via build estático (`npm run build`)  


ReservaSala/
├── backend/                     # Servidor Flask (Python)
│   ├── app.py                   # Aplicação principal, rotas e lógica
│   ├── config.py                # Configurações (banco, senha admin, etc.)
│   ├── database.py              # Inicialização do SQLAlchemy
│   ├── models.py                # Modelos Sala e Reserva
│   ├── requirements.txt         # Dependências Python
│   ├── .env.example             # Exemplo de variáveis de ambiente
│   └── venv/                    # Ambiente virtual (não versionado)
│
├── frontend/                    # Aplicação React (Vite)
│   ├── public/
│   │   └── CBiot_logo.jpg       # Logo exibida no cabeçalho
│   ├── src/
│   │   ├── api.js               # Funções de comunicação com a API
│   │   ├── App.jsx              # Página pública (reservas, disponibilidade)
│   │   ├── Admin.jsx            # Página administrativa (login + painel)
│   │   ├── main.jsx             # Ponto de entrada com rotas
│   │   └── styles.css           # Estilos globais
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── README.md                    # Este arquivo
├── INSTALACAO.md                # Guia de instalação detalhado
└── .gitignore                   # Arquivos ignorados pelo Git