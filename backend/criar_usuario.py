from app import app, db
from models import User
import sys

def criar_usuario(email, nome, cargo, senha):
    with app.app_context():
        if User.query.filter_by(email=email).first():
            print(f"Usuário {email} já existe!")
            return False
        user = User(email=email, nome=nome, cargo=cargo, status='aprovado')
        user.set_password(senha)
        db.session.add(user)
        db.session.commit()
        print(f"Usuário {email} criado com sucesso!")
        return True

if __name__ == '__main__':
    # Exemplos:
    criar_usuario('admin@exemplo.com', 'Admin', 'admin', 'admin123')
    criar_usuario('gerente@exemplo.com', 'Gerente', 'gerente', 'gerente123')
    criar_usuario('usuario@exemplo.com', 'Usuário Comum', 'usuario_comum', '123456')