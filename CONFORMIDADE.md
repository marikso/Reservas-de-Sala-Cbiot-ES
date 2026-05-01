# Conformidade com o enunciado

## Visão geral
Este projeto implementa um sistema de reserva de salas universitárias em Python, usando Flask, SQLAlchemy e PostgreSQL.

### Funcionalidades implementadas
- cadastrar recursos: cadastro de salas pelo painel administrativo ou API
- pesquisar recursos: listagem de salas, visualização de propriedades e consulta de disponibilidade
- selecionar recurso: escolha de sala e horário antes de reservar
- realizar transação: reservar uma sala (ocupar) e cancelar uma reserva (liberar)

### Casos de uso atendidos
1. Cadastro de recursos (salas)
2. Pesquisa de recursos e visualização de informações da sala
3. Seleção de sala e horário para transação
4. Ocupação de recurso via reserva
5. Liberação de recurso via cancelamento de reserva

## Simplificações adotadas
- o "recurso" tratado no sistema é apenas sala de reunião/sala universitária
- não há múltiplos tipos de recurso (somente salas)
- a transação comercial foi simplificada para reserva/cancelamento de sala, sem pagamento ou troca
- não há autenticação de usuário comum; há apenas acesso administrativo para cadastro/exclusão de salas
- reservas ocorrem apenas em dias úteis (segunda a sexta) e entre 08:00 e 19:00
- a interface e o modelo do sistema não fazem distinção entre diferentes modalidades de transação, apenas ocupação e liberação

## Estilo arquitetural e escolhas tecnológicas
- Linguagem: Python
- Framework web: Flask
- ORM: SQLAlchemy
- Banco de dados: PostgreSQL
- Front-end simples com HTML/CSS/JavaScript

## Observação de entrega
O código-fonte está implementado e cobre casos de uso prioritários. Para a entrega completa do trabalho, ainda é necessário gerar os artefatos de análise e projeto solicitados pelo enunciado: diagramas CASE, atas de reunião, slides e relatório de analista.
