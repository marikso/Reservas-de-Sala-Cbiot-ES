# 📌 Pré-requisitos

- Python 3.8 ou superior  
- Node.js 18+ e npm (para o frontend)  
- PostgreSQL instalado e em execução  
- Git (opcional, para clonar o repositório)  

---

# ⚙️ Backend (Flask)

## 📂 Acesse a pasta do backend
```bash
cd backend
```

## 🐍 Crie e ative um ambiente virtual
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

## 📦 Instale as dependências
```bash
pip install -r requirements.txt
```

Se não tiver o arquivo:

```bash
pip install Flask Flask-SQLAlchemy Flask-Cors Flask-Session psycopg2-binary python-dotenv
```

## 🔐 Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/reservasala
ADMIN_PASSWORD=admin123
SECRET_KEY=uma-chave-secreta-qualquer
```

## 🗄️ Crie o banco de dados

```sql
CREATE DATABASE reservasala;
```

## ▶️ Execute o backend
```bash
python app.py
```

🔗 Backend disponível em:  
http://localhost:5000

---

# 🎨 Frontend (React)

## 📂 Acesse a pasta
```bash
cd frontend
```

## 📦 Instale as dependências
```bash
npm install
```

## 🔗 Configure a API (opcional)

```env
VITE_API_BASE_URL=http://localhost:5000
```

## ▶️ Execute o frontend
```bash
npm run dev
```

🔗 Frontend disponível em:  
http://localhost:5173

---

# 🌐 Acessando a aplicação

- Página pública: http://localhost:5173  
- Área administrativa: http://localhost:5173/admin  
  - Senha padrão: `admin123`  

---

# ⚡ Comandos essenciais

| Componente        | Comando                          |
|------------------|----------------------------------|
| Backend (Flask)  | `cd backend && python app.py`    |
| Frontend (React) | `cd frontend && npm run dev`     |

---

# 📁 Estrutura do Projeto

```bash
ReservaSala/
├── backend/                     # Servidor Flask (Python)
│   ├── app.py                  # Aplicação principal
│   ├── config.py               # Configurações
│   ├── database.py             # Inicialização do banco
│   ├── models.py               # Modelos (Sala, Reserva)
│   ├── requirements.txt        # Dependências Python
│   ├── .env.example            # Exemplo de variáveis
│   └── venv/                   # Ambiente virtual (ignorado)
│
├── frontend/                   # Aplicação React (Vite)
│   ├── public/
│   │   └── CBiot_logo.jpg      # Logo
│   ├── src/
│   │   ├── api.js              # Comunicação com API
│   │   ├── App.jsx             # Página pública
│   │   ├── Admin.jsx           # Área administrativa
│   │   ├── main.jsx            # Entry point
│   │   └── styles.css          # Estilos
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── README.md                   # Documentação principal
├── INSTALACAO.md               # Guia detalhado
└── .gitignore                  # Arquivos ignorados
```

---

# 📝 Observações

- Certifique-se de que o PostgreSQL está rodando antes de iniciar o backend  
- As tabelas são criadas automaticamente na primeira execução  

## 🚀 Produção

- Altere todas as senhas  
- Utilize um servidor WSGI (ex: Gunicorn)  
- Gere o build do frontend:

```bash
npm run build
```
