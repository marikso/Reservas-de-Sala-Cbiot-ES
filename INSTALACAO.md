# Instalação do ReservaSala

## Pré-requisitos

- Python 3.8+
- PostgreSQL instalado e em execução

## Passos

1. Copie `.env.example` para `.env`.
2. Edite `.env` com os dados do PostgreSQL.
3. Crie o banco de dados:

```sql
CREATE DATABASE reserva_salas;
```

4. Instale dependências:

```bash
pip install -r requirements.txt
```

5. Execute:

```bash
python app.py
```

6. Acesse:

- `http://localhost:5000`
- `http://localhost:5000/admin`
