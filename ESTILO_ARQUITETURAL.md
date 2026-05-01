# Estilo Arquitetural do Projeto ReservaSala

## Visão Geral
O sistema ReservaSala foi implementado em Python usando Flask e segue um estilo arquitetural baseado em:

- **MVC simplificado**
- **arquitetura em camadas**
- **separação entre apresentação, lógica de negócio e persistência**

## Componentes principais

### Modelo
- `models.py`
  - define as entidades `Sala` e `Reserva`
  - mapeia os dados para o banco com SQLAlchemy
- `database.py`
  - configura a instância do banco de dados e a integração com Flask

### Visão
- `templates/*.html`
  - `index.html` apresenta a interface de reserva e disponibilidade
  - `admin.html` apresenta o painel de administração
  - `login.html` controla o acesso administrativo
- `static/*.js` e `static/*.css`
  - `script.js` trata a lógica de interface e consumo da API
  - `admin.js` gerencia o painel de administração
  - `style.css` define o layout e as regras visuais

### Controlador / Serviço
- `app.py`
  - registra rotas Flask
  - controla fluxo da aplicação e resposta HTTP
  - contém as classes `SalaService` e `ReservaService` que implementam a lógica de negócio
  - disponibiliza endpoints REST para CRUD de salas, reservas e disponibilidade

## Estilo arquitetural

### MVC simplificado
- **Model**: `models.py` + banco de dados
- **View**: templates HTML + JavaScript
- **Controller**: `app.py` com rotas e serviços

### Arquitetura em camadas
- **Camada de apresentação**: front-end HTML/CSS/JS
- **Camada de aplicação**: serviços de reserva e sala no servidor
- **Camada de persistência**: banco de dados e SQLAlchemy

## Por que esse estilo foi escolhido
- facilita a organização do código em responsabilidades claras
- torna o sistema mais simples de manter e estender
- permite evoluir a interface sem misturar regras de negócio com layout
- é compatível com a proposta de um projeto universitário em Python

## Pontos fortes do projeto
- estrutura clara e modular
- uso de serviços para encapsular regras de negócio
- front-end leve e integrado via API REST
- persistência via ORM, o que melhora a legibilidade e reduz código SQL manual

## Observações
- O projeto não é uma implementação completa de um framework MVC pesado, mas usa o mesmo padrão de separação de responsabilidades em uma aplicação Flask.
- O estilo arquitetural pode ser descrito como **MVC leve** ou **arquitetura em camadas** para fins de apresentação e relatório.
