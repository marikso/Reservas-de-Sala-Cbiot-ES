# 📘 ReservaSala

Aplicação web para gerenciamento de reservas de salas, com backend em Flask e frontend em React (Vite).

---

# 📌 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Python 3.8** ou superior  
- **Node.js 18+** e npm (para o frontend)  
- **MySQL Server** em execução
- **Git** (opcional)


---

# 🚀 Como executar o projeto

## 1. Clone o repositório (opcional)

```bash
git clone <url-do-repositorio>
cd ReservaSala
```

---

# ⚙️ Backend (Flask)

## 📂 Acesse a pasta

```bash
cd backend
```

## 🐍 Ambiente virtual

Crie:

```bash
python -m venv venv
```

Ative:

**Linux/Mac**
```bash
source venv/bin/activate
```

**Windows**
```bash
venv\Scripts\activate
```

## 📦 Instalar dependências

```bash
pip install -r requirements.txt
```

Se necessário:

```bash
pip install Flask Flask-SQLAlchemy Flask-Cors Flask-Session psycopg2-binary python-dotenv
```

## 🔐 Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL=mysql+pymysql://usuario:senha@localhost:3306/reservasala
ADMIN_PASSWORD=admin123
SECRET_KEY=uma-chave-secreta
```

## 🗄️ Banco de dados

```sql
CREATE DATABASE reservasala;
```

## ▶️ Rodar servidor

```bash
python app.py
```

📍 Backend: http://localhost:5000

---

# 🎨 Frontend (React + Vite)

## 📂 Acesse a pasta

```bash
cd frontend
```

## 📦 Instalar dependências

```bash
npm install
```

## 🔗 Configurar API (opcional)

Crie um `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## ▶️ Rodar aplicação

```bash
npm run dev
```

📍 Frontend: http://localhost:5173

---

# 🌐 Acesso

- Página principal: http://localhost:5173  
- Admin: http://localhost:5173/admin  
- Senha padrão: `admin123`  

---

# ⚡ Comandos rápidos

```bash
# Backend
cd backend && python app.py

# Frontend
cd frontend && npm run dev
```

---

# 📁 Estrutura do projeto

```bash
ReservaSala/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── README.md
├── INSTALACAO.md
└── .gitignore
```

---

# 📝 Observações

- O MySQL Server deve estar rodando antes do backend  
- As tabelas são criadas automaticamente na primeira execução  

---

# 🚀 Produção

Para ambiente de produção:

- Altere todas as credenciais sensíveis  
- Use um servidor WSGI (ex: Gunicorn)  
- Gere o build do frontend:

```bash
npm run build
```

---

# 💡 Dicas

- Use `.env` para manter segredos fora do código  
- Nunca suba o `venv/` ou `.env` para o repositório  
