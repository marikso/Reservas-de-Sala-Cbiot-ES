from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask.views import MethodView
from functools import wraps
from config import Config
from database import db
from models import Sala, Reserva
from datetime import datetime, time
from sqlalchemy import and_


def admin_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get('admin_authenticated'):
            return jsonify({'erro': 'Acesso negado'}), 401
        return func(*args, **kwargs)
    return wrapper


class SalaService:
    @staticmethod
    def listar_salas():
        salas = Sala.query.order_by(Sala.nome).all()
        return jsonify([sala.to_dict() for sala in salas])

    @staticmethod
    def criar_sala():
        dados = request.get_json()
        if not dados or not dados.get('nome'):
            return jsonify({'erro': 'Nome é obrigatório'}), 400

        if Sala.query.filter_by(nome=dados['nome']).first():
            return jsonify({'erro': 'Sala com este nome já existe'}), 400

        sala = Sala(
            nome=dados['nome']
        )
        db.session.add(sala)
        db.session.commit()
        return jsonify(sala.to_dict()), 201

    @staticmethod
    def deletar_sala(sala_id):
        sala = Sala.query.get_or_404(sala_id)
        db.session.delete(sala)
        db.session.commit()
        return jsonify({'mensagem': 'Sala deletada com sucesso'})


class ReservaService:
    @staticmethod
    def _parse_date(data_text):
        return datetime.strptime(data_text, '%Y-%m-%d').date()

    @staticmethod
    def _parse_time(time_text):
        return datetime.strptime(time_text, '%H:%M').time()

    @staticmethod
    def _validate_business_hours(data, hora_inicio, hora_fim):
        hoje = datetime.today().date()
        if data < hoje:
            return jsonify({'erro': 'Não é possível reservar para datas já passadas'}), 400

        if data.weekday() >= 5:
            return jsonify({'erro': 'Reservas só podem ser feitas de segunda a sexta-feira'}), 400

        if hora_inicio.minute != 0 or hora_fim.minute != 0:
            return jsonify({'erro': 'Reservas devem começar e terminar na hora'}), 400

        if hora_inicio >= hora_fim:
            return jsonify({'erro': 'Hora de início deve ser anterior à hora de fim'}), 400

        if hora_inicio < time(8, 0) or hora_inicio >= time(19, 0) or hora_fim > time(19, 0):
            return jsonify({'erro': 'Reservas só podem ocorrer entre 08:00 e 19:00, com último bloco terminando às 19:00'}), 400

        return None

    @staticmethod
    def listar_reservas():
        sala_id = request.args.get('sala_id', type=int)
        data = request.args.get('data')
        query = Reserva.query

        if sala_id:
            query = query.filter_by(sala_id=sala_id)

        if data:
            try:
                data_filtro = ReservaService._parse_date(data)
                query = query.filter_by(data=data_filtro)
            except ValueError:
                return jsonify({'erro': 'Formato de data inválido'}), 400

        reservas = query.order_by(Reserva.data, Reserva.hora_inicio).all()
        return jsonify([reserva.to_dict() for reserva in reservas])

    @staticmethod
    def criar_reserva():
        dados = request.get_json()
        campos_obrigatorios = ['sala_id', 'titulo', 'data', 'hora_inicio', 'hora_fim', 'responsavel']

        if not dados or not all(campo in dados for campo in campos_obrigatorios):
            return jsonify({'erro': 'Campos obrigatórios faltando'}), 400

        sala = Sala.query.get_or_404(dados['sala_id'])

        try:
            data = ReservaService._parse_date(dados['data'])
            hora_inicio = ReservaService._parse_time(dados['hora_inicio'])
            hora_fim = ReservaService._parse_time(dados['hora_fim'])

            validacao = ReservaService._validate_business_hours(data, hora_inicio, hora_fim)
            if validacao:
                return validacao

            conflito = Reserva.query.filter(
                and_(
                    Reserva.sala_id == dados['sala_id'],
                    Reserva.data == data,
                    Reserva.hora_inicio < hora_fim,
                    Reserva.hora_fim > hora_inicio
                )
            ).first()

            if conflito:
                return jsonify({'erro': 'Conflito de horário: sala já está reservada neste período'}), 400

            reserva = Reserva(
                sala_id=dados['sala_id'],
                titulo=dados['titulo'],
                data=data,
                hora_inicio=hora_inicio,
                hora_fim=hora_fim,
                responsavel=dados['responsavel'],
                email=dados.get('email', ''),
                descricao=dados.get('descricao', '')
            )
            db.session.add(reserva)
            db.session.commit()
            return jsonify(reserva.to_dict()), 201
        except ValueError as e:
            return jsonify({'erro': f'Formato inválido: {str(e)}'}), 400

    @staticmethod
    def deletar_reserva(reserva_id):
        reserva = Reserva.query.get_or_404(reserva_id)
        db.session.delete(reserva)
        db.session.commit()
        return jsonify({'mensagem': 'Reserva cancelada com sucesso'})

    @staticmethod
    def disponibilidade():
        sala_id = request.args.get('sala_id', type=int)
        data = request.args.get('data')

        if not sala_id or not data:
            return jsonify({'erro': 'sala_id e data são obrigatórios'}), 400

        try:
            data_filtro = ReservaService._parse_date(data)
        except ValueError:
            return jsonify({'erro': 'Formato de data inválido (use YYYY-MM-DD)'}), 400

        sala = Sala.query.get_or_404(sala_id)
        reservas = Reserva.query.filter_by(sala_id=sala_id, data=data_filtro).all()
        bloqueados = []
        reserva_por_horario = {}

        for r in reservas:
            h_inicio = r.hora_inicio.strftime('%H:%M')
            h_fim = r.hora_fim.strftime('%H:%M')
            bloqueados.append((h_inicio, h_fim))
            reserva_por_horario[(h_inicio, h_fim)] = r.titulo

        disponiveis = []
        horarios = []
        hora_atual = datetime.strptime('08:00', '%H:%M').time()
        hora_fim_dia = datetime.strptime('19:00', '%H:%M').time()

        while hora_atual < hora_fim_dia:
            hora_proxima = time(hora_atual.hour + 1, 0)
            if hora_proxima > hora_fim_dia:
                break

            intervalo = (hora_atual.strftime('%H:%M'), hora_proxima.strftime('%H:%M'))
            tem_conflito = False
            titulo = ''

            for h_inicio, h_fim in bloqueados:
                inicio_time = time.fromisoformat(h_inicio)
                fim_time = time.fromisoformat(h_fim)
                if hora_atual < fim_time and hora_proxima > inicio_time:
                    tem_conflito = True
                    titulo = reserva_por_horario.get((h_inicio, h_fim), '')
                    break

            if not tem_conflito:
                disponiveis.append(intervalo)

            horarios.append({
                'hora_inicio': intervalo[0],
                'hora_fim': intervalo[1],
                'ocupado': tem_conflito,
                'titulo': titulo
            })

            hora_atual = hora_proxima

        return jsonify({
            'sala_nome': sala.nome,
            'data': data,
            'disponiveis': disponiveis,
            'reservadas': bloqueados,
            'horarios': horarios
        })


class SalasView(MethodView):
    def get(self):
        return SalaService.listar_salas()

    @admin_required
    def post(self):
        return SalaService.criar_sala()


class SalaDetailView(MethodView):
    @admin_required
    def delete(self, sala_id):
        return SalaService.deletar_sala(sala_id)


class ReservasView(MethodView):
    def get(self):
        return ReservaService.listar_reservas()

    def post(self):
        return ReservaService.criar_reserva()


class ReservaDetailView(MethodView):
    @admin_required
    def delete(self, reserva_id):
        return ReservaService.deletar_reserva(reserva_id)


class DisponibilidadeView(MethodView):
    def get(self):
        return ReservaService.disponibilidade()


class ReservaSalaApp:
    def __init__(self, import_name=__name__):
        self.app = Flask(import_name)
        self.app.config.from_object(Config)
        db.init_app(self.app)
        self.register_routes()
        self.register_error_handlers()
        self.initialize_database()

    def create_app(self):
        return self.app

    def initialize_database(self):
        with self.app.app_context():
            db.create_all()

    def register_routes(self):
        self.app.add_url_rule('/', endpoint='index', view_func=self.index)
        self.app.add_url_rule('/admin', endpoint='admin', view_func=self.admin)
        self.app.add_url_rule('/admin/login', endpoint='admin_login', view_func=self.login_admin, methods=['POST'])
        self.app.add_url_rule('/admin/logout', endpoint='admin_logout', view_func=self.logout_admin)
        self.app.add_url_rule('/api/salas', view_func=SalasView.as_view('salas_api'))
        self.app.add_url_rule('/api/salas/<int:sala_id>', view_func=SalaDetailView.as_view('sala_detail_api'))
        self.app.add_url_rule('/api/reservas', view_func=ReservasView.as_view('reservas_api'))
        self.app.add_url_rule('/api/reservas/<int:reserva_id>', view_func=ReservaDetailView.as_view('reserva_detail_api'))
        self.app.add_url_rule('/api/disponibilidade', view_func=DisponibilidadeView.as_view('disponibilidade_api'))

    def register_error_handlers(self):
        self.app.register_error_handler(404, self.nao_encontrado)
        self.app.register_error_handler(500, self.erro_servidor)

    def index(self):
        return render_template('index.html')

    def admin(self):
        if not self.is_admin_authenticated():
            return render_template('login.html')
        return render_template('admin.html')

    def login_admin(self):
        senha = request.form.get('senha', '')
        if not senha:
            return render_template('login.html', erro='Senha é obrigatória')

        if senha != self.app.config.get('ADMIN_PASSWORD'):
            return render_template('login.html', erro='Senha inválida')

        session['admin_authenticated'] = True
        return redirect(url_for('admin'))

    def logout_admin(self):
        session.pop('admin_authenticated', None)
        return redirect(url_for('admin'))

    def is_admin_authenticated(self):
        return session.get('admin_authenticated', False)

    def nao_encontrado(self, erro):
        return jsonify({'erro': 'Recurso não encontrado'}), 404

    def erro_servidor(self, erro):
        db.session.rollback()
        return jsonify({'erro': 'Erro interno do servidor'}), 500


app = ReservaSalaApp().create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='127.0.0.1', port=5000)
