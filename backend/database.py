from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()          # Instância do ORM, usada nos models e no app

def init_db(app):
    db.init_app(app)       # Conecta o SQLAlchemy à aplicação Flask
    with app.app_context():
        db.create_all()    # Cria as tabelas (se não existirem)