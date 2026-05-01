# ReservaSala

Sistema web para gerenciamento de reservas de salas em universidades.

## Características

- Reserva de salas com data e hora
- Consulta de disponibilidade por sala e dia
- Painel de administração para criar e excluir salas
- Cadastro de salas no banco de dados
- Cancelamento de reservas
- Armazenamento em PostgreSQL
- Interface web local simples e responsiva

## Conformidade com o enunciado
- Linguagem Python: implementado em Flask com SQLAlchemy.
- Cadastrar recursos: cadastro de salas via API/painel admin.
- Pesquisar recursos: listagem de salas, disponibilidade e reservas.
- Selecionar recurso: escolha de sala e horário para reserva.
- Transação nos dois sentidos: reserva (ocupar) e cancelamento (liberar).
- Simplificações: apenas recurso tipo sala, sem pagamento/troca, dias úteis 08:00-19:00.

## Como usar

1. Configure o PostgreSQL e crie o banco de dados `reserva_salas`.
2. Copie `.env.example` para `.env` e atualize as credenciais.
3. Instale dependências: `pip install -r requirements.txt`
4. Execute: `python app.py`
5. Abra no navegador: `http://localhost:5000`

## Páginas

- `/` - Página de reservas
- `/admin` - Painel de administração

## API principais

- `GET /api/salas`
- `POST /api/salas`
- `DELETE /api/salas/<id>`
- `GET /api/reservas`
- `POST /api/reservas`
- `DELETE /api/reservas/<id>`
- `GET /api/disponibilidade?sala_id=<id>&data=YYYY-MM-DD`
