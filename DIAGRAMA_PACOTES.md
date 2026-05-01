# Diagrama de Pacotes - ReservaSala

## Descrição
Este diagrama de pacotes mostra a organização do projeto ReservaSala e as dependências entre seus módulos.

```mermaid
flowchart TB
    subgraph App [Aplicação Flask]
        A[app.py]
        B[config.py]
        C[database.py]
        D[models.py]
        E[templates/]
        F[static/]
    end

    A -->|usa| B
    A -->|inicializa e acessa| C
    A -->|usa| D
    A -->|renderiza| E
    A -->|fornece assets| F

    C -->|contém| D
    D -->|define| G[Sala, Reserva]

    subgraph Frontend [Front-end]
        E --> H[index.html]
        E --> I[admin.html]
        E --> J[login.html]
        F --> K[style.css]
        F --> L[script.js]
        F --> M[admin.js]
    end

    style App fill:#f4f5f7,stroke:#333,stroke-width:1px
    style Frontend fill:#eef7ff,stroke:#333,stroke-width:1px
    style G fill:#fff5e6,stroke:#333,stroke-width:1px
```

## Pacotes principais

- `app.py`
  - Ponto de entrada da aplicação
  - Registra rotas Flask
  - Renderiza templates HTML
  - Expõe endpoints REST

- `config.py`
  - Configurações da aplicação
  - `SQLALCHEMY_DATABASE_URI`, `SECRET_KEY`, `ADMIN_PASSWORD`

- `database.py`
  - Configura a conexão com o banco usando `Flask-SQLAlchemy`
  - Integra o objeto `db` ao Flask

- `models.py`
  - Define as entidades do domínio: `Sala` e `Reserva`
  - Mapeia as classes para tabelas do banco de dados

- `templates/`
  - Camada de apresentação HTML
  - `index.html`, `admin.html`, `login.html`

- `static/`
  - JavaScript e CSS que controlam a interação da UI
  - `script.js`, `admin.js`, `style.css`

## Observação
No contexto do projeto Flask, o diagrama de pacotes é uma representação de módulos e camadas, em vez de pacotes Java formais. Este diagrama mostra a separação entre:

- apresentação (templates + estáticos)
- lógica de aplicação (`app.py` + serviços)
- persistência (`database.py`, `models.py`)

Se quiser, posso também gerar uma versão simplificada para incluir diretamente em slides ou relatório.`