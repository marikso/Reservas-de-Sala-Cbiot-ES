from app import app, db
from models import Notificacao, User

with app.app_context():
    user = User.query.filter_by(email='usuario@exemplo.com').first()
    if not user:
        print("Usuário não encontrado")
    else:
        n = Notificacao(
            usuario_email='usuario@exemplo.com',
            mensagem='TESTE MANUAL - Cancelamento simulado',
            tipo='cancelamento',
            reserva_id=None
        )
        db.session.add(n)
        db.session.commit()
        print("Notificação manual inserida, ID:", n.id)