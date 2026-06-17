# Manual de Instrucoes do Usuario — Sistema de Reserva de Salas CBiot/UFRGS

## Sumario

1. [Visao Geral](#visao-geral)
2. [Regras Gerais do Sistema](#regras-gerais-do-sistema)
3. [Usuario](#1-usuario)
4. [Lider de Grupo](#2-lider-de-grupo)
5. [Gerente](#3-gerente)
6. [Administrador](#4-administrador)
7. [Resumo de Permissoes por Cargo](#resumo-de-permissoes-por-cargo)

---

## Visao Geral

O sistema de Reserva de Salas do Centro de Biotecnologia (CBiot) da UFRGS permite que usuarios solicitem e gerenciem reservas de salas de forma organizada. Cada usuario possui um **cargo** que define suas permissoes e o fluxo de aprovacao das suas reservas.

| Cargo | Publico-alvo | Aprovacao de reserva |
|---|---|---|
| **Usuario** | Alunos e demais pessoas | Precisa de aprovacao do gerente |
| **Lider de Grupo** | Professores, tecnicos e servidores | Aprovada automaticamente |
| **Gerente** | Responsaveis pela gestao das reservas | Aprovada automaticamente |
| **Administrador** | Controle total do sistema | Aprovada automaticamente |

---

## Regras Gerais do Sistema

Estas regras se aplicam a **todos os cargos**:

- **Horario de funcionamento:** reservas somente entre **08:00 e 19:00**
- **Blocos de tempo:** as reservas sao feitas em intervalos de **30 minutos**
- **Dias uteis:** reservas permitidas apenas de **segunda a sexta-feira**
- **Datas passadas:** nao e possivel reservar para datas ou horarios ja passados
- **Recorrencia:** reservas recorrentes podem ter no maximo **180 dias** de periodo
- **Manutencao:** salas em manutencao **nao podem ser reservadas**
- **Chave da sala:** e retirada e devolvida na **portaria**
- **Controles remotos:** devem permanecer na sala

---

## 1. Usuario

**Perfil:** Alunos e demais pessoas que utilizam as salas do CBiot.

### Menu Lateral

O usuario tem acesso as seguintes secoes:

**PRINCIPAL**
- Inicio
- Consultar disponibilidade
- Minhas reservas

**CONTA**
- Notificacoes
- Sair

---

### Inicio (Mapa de Salas)

A tela inicial exibe todas as salas cadastradas em formato de cards. Cada card mostra:

- Nome da sala
- Bloco e andar
- Capacidade (numero de pessoas)
- Equipamentos disponiveis
- Status de manutencao (quando aplicavel)

**Para solicitar uma reserva a partir do mapa:**
1. Clique no card da sala desejada (salas em manutencao nao podem ser selecionadas)
2. O formulario de reserva sera aberto com a sala ja preenchida

**Para solicitar uma reserva sem selecionar sala no mapa:**
1. Clique no botao **"+ Solicitar reserva"** no canto superior direito
2. Preencha todos os campos no formulario

---

### Formulario de Reserva

Ao solicitar uma reserva, preencha:

| Campo | Obrigatorio | Descricao |
|---|---|---|
| Sala | Sim | Selecione a sala desejada |
| Data | Sim | Data da reserva (dias uteis) |
| Horario de inicio | Sim | Blocos de 30 min entre 08:00 e 18:30 |
| Horario de fim | Sim | Blocos de 30 min entre 08:30 e 19:00 |
| Titulo | Sim | Finalidade da reserva |
| Descricao | Nao | Detalhes adicionais |

**Reserva recorrente:**
1. Ative a opcao de recorrencia no formulario
2. Selecione os dias da semana desejados (segunda a sexta)
3. Defina a data de inicio e a data final do periodo (maximo 180 dias)
4. O sistema criara uma reserva para cada dia selecionado no periodo
5. Datas com conflito de horario serao ignoradas automaticamente

> **Importante:** Para o cargo Usuario, as reservas ficam com status **PENDENTE** ate que um gerente ou administrador aprove. Voce sera notificado quando houver uma decisao.

---

### Consultar Disponibilidade

Duas formas de consulta:

**Por sala:**
1. Selecione a aba **"Por sala"**
2. Escolha a sala e a data
3. Clique em **"Ver horarios"**
4. A grade de horarios sera exibida com blocos de 30 minutos coloridos:
   - **Verde (Disponivel):** horario livre para reserva
   - **Roxo (Selecionado):** horario que voce selecionou
   - **Vermelho (Reservado):** horario ja ocupado
   - **Laranja (Pendente):** solicitacao aguardando aprovacao
   - **Cinza (Indisponivel):** sala em manutencao naquele horario
5. Clique em um bloco para selecionar o inicio, clique em outro para selecionar o fim
6. Clique em **"+ Solicitar Reserva"** para abrir o formulario com os horarios preenchidos

**Por data e hora:**
1. Selecione a aba **"Por data e hora"**
2. Escolha a data, horario de inicio e horario de fim
3. Clique em **"Buscar salas"**
4. Serao exibidas todas as salas disponiveis naquele horario
5. Clique em uma sala para abrir o formulario de reserva

---

### Minhas Reservas

Acompanhe suas reservas em tres abas:

**Ativas**
- Reservas aprovadas e futuras
- Acoes disponiveis: **Editar solicitacao**, **Cancelar solicitacao**
- Para reservas recorrentes: **Cancelar serie** (cancela todas as ocorrencias)

**Pendentes**
- Solicitacoes aguardando analise do gerente
- Exibe a data de solicitacao e mensagem "aguardando analise do gerente"

**Historico**
- Reservas passadas, canceladas ou rejeitadas
- Permite visualizar detalhes

**Editar uma reserva:**
- Clique em **"Editar solicitacao"** para alterar titulo, descricao, data ou horario

**Cancelar uma reserva:**
- Clique em **"Cancelar solicitacao"** para uma reserva individual
- Clique em **"Cancelar serie"** para cancelar todas as ocorrencias de uma reserva recorrente

---

### Notificacoes

O menu **Notificacoes** exibe eventos sobre suas reservas. Um badge vermelho no menu lateral indica o numero de notificacoes nao lidas.

Tipos de notificacao:

| Tipo | Descricao |
|---|---|
| **Aprovada** | Sua solicitacao foi aprovada |
| **Rejeitada** | Sua solicitacao foi rejeitada |
| **Cancelada** | Sua reserva foi cancelada por um gerente/admin |
| **Editada** | Sua reserva foi editada por um gerente/admin |
| **Manutencao** | Sua reserva foi cancelada devido a manutencao da sala |

Cada notificacao mostra o titulo da reserva, a data/hora do evento, a mensagem e, quando aplicavel, o motivo.

Acoes disponiveis:
- **Marcar como lida** (individual)
- **Marcar todas como lidas**
- **Remover** notificacao

---

## 2. Lider de Grupo

**Perfil:** Professores, tecnicos e servidores do CBiot.

### Diferenca em relacao ao Usuario

O Lider de Grupo tem acesso as **mesmas telas e funcionalidades** do Usuario, com duas diferencas importantes:

1. **Reservas aprovadas automaticamente:** ao solicitar uma reserva, ela e confirmada imediatamente sem passar por fila de aprovacao. O status ja aparece como **CONFIRMADA**.

2. **Prioridade sobre reservas pendentes:** ao reservar um horario que ja tem uma solicitacao pendente de um Usuario, a solicitacao pendente e automaticamente rejeitada e o usuario e notificado.

### Menu Lateral

Identico ao do Usuario:

**PRINCIPAL**
- Inicio
- Consultar disponibilidade
- Minhas reservas

**CONTA**
- Notificacoes
- Sair

### Observacoes

- Na tela **Minhas Reservas**, a aba "Pendentes" nao aparece, pois as reservas nunca ficam pendentes.
- Na tela **Consultar Disponibilidade**, solicitacoes pendentes de outros usuarios **nao bloqueiam** os horarios do Lider de Grupo (apenas reservas ja aprovadas aparecem como ocupadas).

---

## 3. Gerente

**Perfil:** Responsaveis pela gestao e aprovacao de reservas no CBiot.

### Menu Lateral

Alem das secoes do Lider de Grupo, o Gerente tem acesso ao menu **ADMINISTRATIVO**:

**PRINCIPAL**
- Inicio
- Consultar disponibilidade
- Minhas reservas

**ADMINISTRATIVO**
- Solicitacoes de Reserva (com badge vermelho indicando pendentes)
- Gerenciar Reservas
- Relatorios

**CONTA**
- Notificacoes
- Sair

---

### Solicitacoes de Reserva

Tela para aprovar ou rejeitar solicitacoes de usuarios. O badge vermelho no menu lateral indica quantas solicitacoes estao pendentes.

**Aba Pendentes:**
- Lista todas as solicitacoes aguardando analise
- Cada solicitacao mostra: usuario, e-mail, sala, data, horario, finalidade e descricao
- Solicitacoes recorrentes sao identificadas com o badge **RECORRENTE**
- Acoes: **Aprovar solicitacao** ou **Rejeitar**
- Ao rejeitar, sera solicitada confirmacao
- O usuario e notificado automaticamente sobre a decisao

**Aba Historico:**
- Lista solicitacoes ja processadas (rejeitadas)
- Mostra quem processou e quando

---

### Gerenciar Reservas

Tela para visualizar e gerenciar todas as reservas do sistema (exceto pendentes, que ficam em Solicitacoes).

**Filtros disponiveis:**
- **Busca por texto:** pesquise por nome de usuario ou sala
- **Status:** Todas, Confirmadas, Rejeitadas, Canceladas
- **Sala:** filtre por sala especifica
- **Periodo:** Proximas reservas, Reservas passadas ou Todas
- **Data:** filtre por uma data especifica

**Acoes por reserva:**
- **Editar:** alterar titulo, descricao, data ou horario. Se a reserva for de outro usuario, informe o motivo da edicao (o usuario sera notificado).
- **Cancelar:** cancelar a reserva. Se for de outro usuario, informe o motivo do cancelamento (o usuario sera notificado).

**Exportar:** clique em **"Exportar CSV"** para baixar a lista filtrada.

---

### Relatorios

Tela com estatisticas de uso das salas.

**Periodos disponiveis:**
- Ultimos 30 dias
- Ultimos 90 dias
- Ano atual
- Todo o historico
- Personalizado (selecione datas de inicio e fim, clique em **"Aplicar"**)

**Metricas exibidas:**

| Metrica | Descricao |
|---|---|
| Total de reservas | Todas as reservas no periodo (todos os status) |
| Horas reservadas | Total de horas das reservas confirmadas |
| Media diaria | Media de reservas confirmadas por dia |
| Usuarios distintos | Quantidade de usuarios que fizeram reservas |

**Ranking:** exibe as 5 salas mais reservadas no periodo (reservas confirmadas).

**Exportar:** clique em **"Exportar CSV"** para baixar os dados do periodo.

---

## 4. Administrador

**Perfil:** Controle total sobre o sistema — gerencia salas, usuarios e todas as reservas.

### Menu Lateral

O Administrador tem acesso completo:

**PRINCIPAL**
- Inicio
- Consultar disponibilidade
- Minhas reservas

**ADMINISTRATIVO**
- Solicitacoes de Reserva (com badge vermelho indicando pendentes)
- Gerenciar Reservas
- Gerenciar Salas
- Gerenciar Usuarios
- Relatorios

**CONTA**
- Notificacoes
- Sair

---

### Gerenciar Salas

Tela para cadastrar, editar, bloquear e remover salas. O painel superior mostra o total de salas cadastradas, quantas estao operacionais e quantas estao em manutencao.

Cada card de sala exibe: nome, predio, andar, capacidade, equipamentos e status (OPERACIONAL ou EM MANUTENCAO).

**Cadastrar nova sala:**
1. Clique em **"+ Cadastrar nova sala"**
2. Preencha os campos:
   - **Nome** (obrigatorio)
   - **Bloco** (numero do predio)
   - **Andar** (1 andar ou 2 andar)
   - **Capacidade** (numero de pessoas)
   - **Equipamentos** (separados por virgula)
3. Clique em **"Cadastrar"**

**Editar sala:**
1. No card da sala, clique em **"Editar"**
2. Altere as informacoes desejadas
3. Clique em **"Salvar alteracoes"**

**Bloquear sala para manutencao:**
1. No card da sala, clique em **"Tornar indisponivel"**
2. Preencha:
   - **Sala** (ja preenchida se clicou no card)
   - **Data inicio** e **Data fim**
   - **Hora inicio** (padrao: 08:00) e **Hora fim** (padrao: 19:00)
   - **Motivo** (ex.: reforma, manutencao eletrica)
3. Clique em **"Bloquear"**

> **Atencao:** Ao bloquear uma sala, todas as reservas que conflitam com o periodo de manutencao serao **automaticamente canceladas** e os usuarios serao **notificados**.

**Liberar sala:**
- No card de uma sala em manutencao, clique em **"Liberar para uso"** para remover todos os bloqueios

**Remover sala:**
- Clique em **"Remover"** para excluir a sala permanentemente
- Todas as reservas associadas tambem serao removidas
- Sera solicitada confirmacao antes da exclusao

---

### Gerenciar Usuarios

Tela para gerenciar acessos e papeis dos usuarios. O painel superior mostra a contagem por cargo.

**Referencia de papeis:**

| Papel | Descricao |
|---|---|
| **Administrador** | Controle total sobre o sistema |
| **Gerente** | Gerencia reservas: aprovar, rejeitar, editar e cancelar |
| **Lider de Grupo** | Professores, tecnicos e servidores — reservas aprovadas automaticamente |
| **Usuario** | Alunos e demais — reservas precisam de aprovacao do gerente |

**Alterar papel de um usuario:**
1. Clique em **"Alterar papel"** ao lado do usuario
2. Visualize o papel atual e selecione o novo papel
3. Clique em **"Confirmar alteracao"**
4. A alteracao entra em vigor imediatamente

**Aprovar usuario pendente:**
- Clique em **"Aprovar"** para ativar o acesso do usuario ao sistema

**Desativar usuario:**
- Clique em **"Desativar"** para revogar o acesso de um usuario ativo

**Reativar usuario:**
- Clique em **"Reativar"** para restaurar o acesso de um usuario desativado

> **Observacao:** Nao e possivel alterar o proprio papel. O botao "Alterar papel" nao aparece para o usuario logado.

---

## Resumo de Permissoes por Cargo

| Funcionalidade | Usuario | Lider de Grupo | Gerente | Admin |
|---|:---:|:---:|:---:|:---:|
| Ver mapa de salas | SIM | SIM | SIM | SIM |
| Consultar disponibilidade | SIM | SIM | SIM | SIM |
| Solicitar reserva | SIM | SIM | SIM | SIM |
| Solicitar reserva recorrente | SIM | SIM | SIM | SIM |
| Reserva aprovada automaticamente | NAO | SIM | SIM | SIM |
| Prioridade sobre pendentes | NAO | SIM | SIM | SIM |
| Editar propria reserva | SIM | SIM | SIM | SIM |
| Cancelar propria reserva | SIM | SIM | SIM | SIM |
| Ver notificacoes | SIM | SIM | SIM | SIM |
| Aprovar/rejeitar solicitacoes | NAO | NAO | SIM | SIM |
| Gerenciar todas as reservas | NAO | NAO | SIM | SIM |
| Editar reserva de terceiros | NAO | NAO | SIM | SIM |
| Cancelar reserva de terceiros | NAO | NAO | SIM | SIM |
| Ver relatorios | NAO | NAO | SIM | SIM |
| Exportar CSV | NAO | NAO | SIM | SIM |
| Gerenciar salas | NAO | NAO | NAO | SIM |
| Criar/remover manutencao | NAO | NAO | NAO | SIM |
| Gerenciar usuarios | NAO | NAO | NAO | SIM |
| Alterar papel de usuarios | NAO | NAO | NAO | SIM |
| Aprovar/desativar usuarios | NAO | NAO | NAO | SIM |
