"""Popula a tabela local 'users' com um usuário para cada role.

Uso:
    python seed_users.py

Nota: o login real do sistema é feito via Portal externo (PORTAL_AUTH_URL),
que não conhece estes registros nem estas senhas. Este script serve apenas
para ter dados de teste na tabela local 'users' (ex.: testar /api/users,
/api/users/<id>/approve etc.) — não autentica via login.
"""
from app import app
from database import db
from models import User

USERS = [
    {'email': 'admin@teste.com', 'nome': 'Admin Teste', 'cargo': 'admin'},
    {'email': 'gerente@teste.com', 'nome': 'Gerente Teste', 'cargo': 'gerente'},
    {'email': 'lider@teste.com', 'nome': 'Lider Teste', 'cargo': 'lider_de_grupo'},
    {'email': 'usuario@teste.com', 'nome': 'Usuario Teste', 'cargo': 'usuario_cbiot'},
]
SENHA_PADRAO = 'senha123'

with app.app_context():
    for dados in USERS:
        user = User.query.filter_by(email=dados['email']).first()
        if user is None:
            user = User(email=dados['email'], nome=dados['nome'], cargo=dados['cargo'], status='aprovado')
        else:
            user.nome = dados['nome']
            user.cargo = dados['cargo']
            user.status = 'aprovado'
        user.set_password(SENHA_PADRAO)
        db.session.add(user)
        print(f"OK: {dados['email']} ({dados['cargo']})")
    db.session.commit()

print('\nUsuários criados/atualizados com sucesso.')
