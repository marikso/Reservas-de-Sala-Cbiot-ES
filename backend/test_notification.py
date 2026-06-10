from app import app, db
from models import Notificacao, User

with app.app_context():
    # Verifique se existe um usuário com email 'admin@exemplo.com'
    user = User.query.filter_by(email='admin@exemplo.com').first()
    if not user:
        print("Usuário admin não encontrado. Crie antes de testar.")
    else:
        notif = Notificacao(
            usuario_email='admin@exemplo.com',
            mensagem='Teste de notificação',
            tipo='teste',
            reserva_id=None
        )
        db.session.add(notif)
        db.session.commit()
        print("Notificação criada com sucesso!")