"""Mock local do Portal de autenticação (apenas para testes manuais em dev).

Sobe um servidor simples em http://localhost:3000 implementando os dois
endpoints que o ReservaSala consome:
  POST /api/auth/login  {email, senha} -> {token, user: {permissions: [...]}}
  GET  /api/auth/me     (Authorization: Bearer <token>) -> {id, name, email, permissions}

Uso:
    python mock_portal.py

Mantenha rodando junto com o backend (porta 5000) e o frontend (porta 5173).
NÃO usar em produção — não há verificação real de senha nem persistência.
"""
import uuid
from flask import Flask, request, jsonify

app = Flask(__name__)

USERS = {
    'admin@teste.com': {
        'id': 1, 'name': 'Admin Teste', 'senha': 'senha123',
        'permissions': ['ACCESS_RESERVA_SALAS', 'SALAS_ADMIN'],
    },
    'gerente@teste.com': {
        'id': 2, 'name': 'Gerente Teste', 'senha': 'senha123',
        'permissions': ['ACCESS_RESERVA_SALAS', 'SALAS_GERENTE'],
    },
    'lider@teste.com': {
        'id': 3, 'name': 'Lider Teste', 'senha': 'senha123',
        'permissions': ['ACCESS_RESERVA_SALAS', 'SALAS_LIDER'],
    },
    'usuario@teste.com': {
        'id': 4, 'name': 'Usuario Teste', 'senha': 'senha123',
        'permissions': ['ACCESS_RESERVA_SALAS', 'SALAS_USER'],
    },
}

TOKENS = {}  # token -> email

@app.after_request
def add_cors_headers(resp):
    origin = request.headers.get('Origin')
    if origin:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return resp

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 204
    body = request.get_json(silent=True) or {}
    email = body.get('email')
    senha = body.get('senha')
    user = USERS.get(email)
    if not user or user['senha'] != senha:
        return jsonify({'erro': 'Credenciais inválidas'}), 401
    token = str(uuid.uuid4())
    TOKENS[token] = email
    return jsonify({
        'token': token,
        'user': {'id': user['id'], 'name': user['name'], 'email': email, 'permissions': user['permissions']},
    })

@app.route('/api/auth/me', methods=['GET', 'OPTIONS'])
def me():
    if request.method == 'OPTIONS':
        return '', 204
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '', 1)
    email = TOKENS.get(token)
    if not email:
        return jsonify({'erro': 'Token inválido'}), 401
    user = USERS[email]
    return jsonify({'id': user['id'], 'name': user['name'], 'email': email, 'permissions': user['permissions']})

if __name__ == '__main__':
    print('Mock Portal rodando em http://localhost:3000')
    print('Usuários disponíveis: ' + ', '.join(USERS.keys()) + ' (senha: senha123)')
    app.run(port=3000, debug=True)
