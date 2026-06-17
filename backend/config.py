import os
from dotenv import load_dotenv

load_dotenv()  # Carrega variáveis do arquivo .env

class Config:
    # Chave secreta para sessões e segurança (fallback para desenvolvimento)
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    
    # String de conexão com PostgreSQL (padrão: localhost, usuário postgres, banco reservasala)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost/reservasala')
    
    # Desabilita rastreamento de modificações para economizar recursos
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    

    # Tipo de armazenamento da sessão (filesystem - arquivos locais; também poderia ser 'redis')
    SESSION_TYPE = 'filesystem'
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_DOMAIN = False