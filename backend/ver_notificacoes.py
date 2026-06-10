from app import app, db
from models import Notificacao

with app.app_context():
    notifs = Notificacao.query.order_by(Notificacao.data_criacao.desc()).all()
    print(f'Total de notificações: {len(notifs)}')
    for n in notifs:
        print(f'{n.id}: {n.usuario_email} - {n.mensagem[:80]} - Lida: {n.lida}')