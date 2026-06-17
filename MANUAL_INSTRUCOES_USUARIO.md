# Manual de Instruções — Sistema de Reserva de Salas CBiot/UFRGS

## Sumário

1. [Visão Geral](#visão-geral)
2. [Regras Gerais do Sistema](#regras-gerais-do-sistema)
3. [Usuário (usuario_cbiot)](#1-usuário-usuario_cbiot)
4. [Líder de Grupo (lider_de_grupo)](#2-líder-de-grupo-lider_de_grupo)
5. [Gerente](#3-gerente)
6. [Administrador (admin)](#4-administrador-admin)

---

## Visão Geral

O sistema de Reserva de Salas do Centro de Biotecnologia (CBiot) da UFRGS permite que usuários solicitem e gerenciem reservas de salas de forma organizada. Cada usuário possui um **cargo** que define suas permissões e o fluxo de aprovação das suas reservas.

| Cargo | Público-alvo | Aprovação de reserva |
|---|---|---|
| **Usuário** | Alunos e demais pessoas | Precisa de aprovação do gerente |
| **Líder de Grupo** | Professores, técnicos e servidores | Auto-aprovada (não precisa de aprovação) |
| **Gerente** | Responsáveis pela gestão das reservas | Auto-aprovada |
| **Administrador** | Controle total do sistema | Auto-aprovada |

---

## Regras Gerais do Sistema

Estas regras se aplicam a **todos os cargos**:

- **Horário de funcionamento:** reservas somente entre **08:00 e 19:00**
- **Blocos de tempo:** as reservas são feitas em intervalos de **30 minutos**
- **Dias úteis:** reservas são permitidas apenas de **segunda a sexta-feira**
- **Datas passadas:** não é possível reservar para datas ou horários já passados
- **Recorrência:** reservas recorrentes podem ter no máximo **180 dias** de período
- **Manutenção:** salas em manutenção **não podem ser reservadas**
- **Chave da sala:** é retirada e devolvida na **portaria**
- **Controles remotos:** devem permanecer na sala

---

## 1. Usuário (usuario_cbiot)

**Perfil:** Alunos e demais pessoas que utilizam as salas do CBiot.

### Funcionalidades Disponíveis

#### Menu Principal

| Funcionalidade | Descrição |
|---|---|
| **Início (Mapa de Salas)** | Visualizar todas as salas cadastradas com informações de bloco, andar, capacidade e equipamentos. Clicar em uma sala para solicitar reserva. |
| **Consultar Disponibilidade** | Verificar horários livres de uma sala em uma data específica, ou buscar salas disponíveis em uma data e horário. |
| **Minhas Reservas** | Acompanhar o status das suas solicitações (pendentes, ativas e histórico). |
| **Notificações** | Receber avisos sobre aprovações, rejeições, cancelamentos e edições nas suas reservas. |

#### Como Solicitar uma Reserva

1. Acesse **Início** e clique na sala desejada, ou clique no botão **"+ Solicitar reserva"**
2. Preencha os campos obrigatórios:
   - **Sala** (se ainda não selecionada)
   - **Data**
   - **Horário de início e fim**
   - **Título** (finalidade da reserva)
   - **Descrição** (opcional)
3. Para reservas **recorrentes**, ative a opção de recorrência, selecione os dias da semana e a data final do período
4. Clique em **"Solicitar reserva"**

> **Importante:** Suas reservas ficam com status **PENDENTE** até que um gerente ou administrador aprove. Você será notificado quando houver uma decisão.

#### Como Consultar Disponibilidade

**Por sala:**
1. Acesse **Consultar Disponibilidade** > aba **"Por sala"**
2. Selecione a sala e a data
3. Clique em **"Ver horários"**
4. Os blocos de 30 min serão exibidos com cores indicando: disponível, reservado, pendente ou em manutenção
5. Clique em um ou dois blocos para selecionar o intervalo e depois em **"+ Solicitar Reserva"**

**Por data e hora:**
1. Acesse **Consultar Disponibilidade** > aba **"Por data e hora"**
2. Selecione data, horário de início e fim
3. Clique em **"Buscar salas"**
4. Serão exibidas todas as salas disponíveis naquele horário
5. Clique em uma sala para solicitar a reserva

#### Como Gerenciar Suas Reservas

Na tela **Minhas Reservas**, você encontra três abas:

- **Ativas:** reservas aprovadas e futuras. Você pode **editar** ou **cancelar** cada uma.
- **Pendentes:** solicitações aguardando análise do gerente.
- **Histórico:** reservas passadas, canceladas ou rejeitadas.

**Editar uma reserva:**
- Clique em **"Editar solicitação"** para alterar título, descrição, data ou horário.

**Cancelar uma reserva:**
- Clique em **"Cancelar solicitação"** para cancelar uma reserva individual.
- Para reservas recorrentes, use **"Cancelar série"** para cancelar todas as ocorrências.

#### Notificações

Acesse o menu **Notificações** para ver eventos sobre suas reservas:
- Aprovação de solicitação
- Rejeição de solicitação
- Cancelamento pelo gerente/admin (com motivo)
- Edição feita pelo gerente/admin (com motivo)
- Cancelamento por manutenção

Você pode **marcar como lida**, **marcar todas como lidas** ou **remover** notificações.

---

## 2. Líder de Grupo (lider_de_grupo)

**Perfil:** Professores, técnicos e servidores do CBiot.

### Diferença Principal

As reservas do Líder de Grupo são **aprovadas automaticamente**, sem necessidade de análise por um gerente.

Além disso, o Líder de Grupo tem **prioridade sobre reservas pendentes**: ao reservar um horário que já tem uma solicitação pendente de um usuário comum, a solicitação pendente é automaticamente rejeitada.

### Funcionalidades Disponíveis

Todas as mesmas funcionalidades do **Usuário**, com as seguintes diferenças:

| Funcionalidade | Diferença em relação ao Usuário |
|---|---|
| **Solicitar Reserva** | A reserva é **aprovada imediatamente** ao ser criada. Não passa por fila de aprovação. |
| **Minhas Reservas** | Não exibe aba "Pendentes", pois as reservas nunca ficam pendentes. |
| **Consultar Disponibilidade** | Solicitações pendentes de outros usuários **não bloqueiam** seus horários (apenas reservas aprovadas aparecem como ocupadas). |

### Como Solicitar uma Reserva

O processo é idêntico ao do Usuário, porém ao finalizar a solicitação:
- A reserva é **confirmada automaticamente**
- O status será **CONFIRMADA** imediatamente
- Se houver conflito com uma solicitação pendente de outro usuário, essa solicitação será automaticamente rejeitada

---

## 3. Gerente

**Perfil:** Responsáveis pela gestão e aprovação de reservas no CBiot.

### Funcionalidades Disponíveis

Todas as funcionalidades do **Líder de Grupo**, mais as seguintes funcionalidades administrativas:

#### Menu Administrativo

| Funcionalidade | Descrição |
|---|---|
| **Solicitações de Reserva** | Aprovar ou rejeitar solicitações pendentes de usuários. |
| **Gerenciar Reservas** | Visualizar, filtrar, editar e cancelar todas as reservas do sistema. |
| **Relatórios** | Visualizar estatísticas de uso das salas por período. |

#### Como Aprovar/Rejeitar Solicitações

1. Acesse **Solicitações de Reserva** no menu Administrativo
2. Na aba **Pendentes**, visualize as solicitações aguardando análise
3. Cada solicitação mostra: usuário, e-mail, sala, data, horário e finalidade
4. Clique em **"Aprovar solicitação"** para confirmar a reserva
5. Clique em **"Rejeitar"** para negar (será solicitada confirmação)
6. Na aba **Histórico**, visualize as solicitações já processadas com informações de quem processou e quando

> O usuário será notificado automaticamente sobre a decisão.

#### Como Gerenciar Reservas

1. Acesse **Gerenciar Reservas** no menu Administrativo
2. Use os filtros disponíveis:
   - **Busca por texto:** pesquise por nome de usuário ou sala
   - **Status:** Todas, Confirmadas, Rejeitadas, Canceladas
   - **Sala:** filtre por sala específica
   - **Período:** Próximas reservas, Reservas passadas ou Todas
   - **Data:** filtre por uma data específica
3. Para cada reserva, você pode:
   - **Editar:** alterar título, descrição, data ou horário (informe o motivo da edição se a reserva for de outro usuário)
   - **Cancelar:** cancelar a reserva (informe o motivo do cancelamento se for de outro usuário)
4. Clique em **"Exportar CSV"** para baixar a lista filtrada em formato CSV

#### Como Visualizar Relatórios

1. Acesse **Relatórios** no menu Administrativo
2. Selecione o período desejado:
   - Últimos 30 dias
   - Últimos 90 dias
   - Ano atual
   - Todo o histórico
   - Personalizado (selecione datas de início e fim)
3. Visualize as métricas:
   - **Total de reservas** no período
   - **Horas reservadas** (reservas confirmadas)
   - **Média diária** de reservas confirmadas
   - **Usuários distintos** que fizeram reservas
4. Veja o **ranking das 5 salas mais reservadas**
5. Clique em **"Exportar CSV"** para baixar os dados do período

---

## 4. Administrador (admin)

**Perfil:** Controle total sobre o sistema — gerencia salas, usuários e todas as reservas.

### Funcionalidades Disponíveis

Todas as funcionalidades do **Gerente**, mais:

#### Menu Administrativo (exclusivo do Admin)

| Funcionalidade | Descrição |
|---|---|
| **Gerenciar Salas** | Cadastrar, editar, bloquear (manutenção) e remover salas. |
| **Gerenciar Usuários** | Gerenciar acessos, alterar papéis e aprovar/desativar usuários. |

#### Como Gerenciar Salas

1. Acesse **Gerenciar Salas** no menu Administrativo
2. Visualize o painel com total de salas, salas operacionais e em manutenção

**Cadastrar nova sala:**
1. Clique em **"+ Cadastrar nova sala"**
2. Preencha: Nome (obrigatório), Bloco, Andar, Capacidade e Equipamentos (separados por vírgula)
3. Clique em **"Cadastrar"**

**Editar sala:**
1. No card da sala, clique em **"Editar"**
2. Altere as informações desejadas
3. Clique em **"Salvar alterações"**

**Bloquear sala para manutenção:**
1. No card da sala, clique em **"Tornar indisponível"**
2. Preencha: Sala, Data início, Data fim, Hora início, Hora fim e Motivo
3. Clique em **"Bloquear"**

> **Atenção:** Ao bloquear uma sala, todas as reservas que conflitam com o período de manutenção serão **automaticamente canceladas** e os usuários serão **notificados**.

**Liberar sala:**
- No card de uma sala em manutenção, clique em **"Liberar para uso"** para remover o bloqueio

**Remover sala:**
- Clique em **"Remover"** para excluir a sala permanentemente (todas as reservas associadas também serão removidas)

#### Como Gerenciar Usuários

1. Acesse **Gerenciar Usuários** no menu Administrativo
2. Visualize o painel com contagem por cargo (administradores, gerentes, líderes de grupo, usuários)

**Referência de papéis:**

| Papel | Permissões |
|---|---|
| **Administrador** | Controle total sobre o sistema |
| **Gerente** | Gerencia reservas (aprovar, rejeitar, editar, cancelar) |
| **Líder de Grupo** | Reservas auto-aprovadas, sem necessidade de aprovação |
| **Usuário** | Reservas precisam de aprovação do gerente |

**Alterar papel de um usuário:**
1. Clique em **"Alterar papel"** ao lado do usuário
2. Selecione o novo papel no seletor
3. Clique em **"Confirmar alteração"**

> A alteração entra em vigor imediatamente.

**Aprovar usuário pendente:**
- Clique em **"Aprovar"** para ativar o acesso do usuário ao sistema

**Desativar usuário:**
- Clique em **"Desativar"** para revogar o acesso do usuário

**Reativar usuário:**
- Clique em **"Reativar"** para restaurar o acesso de um usuário desativado

---

## Resumo de Permissões por Cargo

| Funcionalidade | Usuário | Líder de Grupo | Gerente | Admin |
|---|:---:|:---:|:---:|:---:|
| Ver mapa de salas | SIM | SIM | SIM | SIM |
| Consultar disponibilidade | SIM | SIM | SIM | SIM |
| Solicitar reserva | SIM | SIM | SIM | SIM |
| Reserva auto-aprovada | NAO | SIM | SIM | SIM |
| Prioridade sobre pendentes | NAO | SIM | SIM | SIM |
| Reserva recorrente | SIM | SIM | SIM | SIM |
| Editar própria reserva | SIM | SIM | SIM | SIM |
| Cancelar própria reserva | SIM | SIM | SIM | SIM |
| Ver próprias notificações | SIM | SIM | SIM | SIM |
| Aprovar/rejeitar solicitações | NAO | NAO | SIM | SIM |
| Gerenciar todas as reservas | NAO | NAO | SIM | SIM |
| Editar reserva de terceiros | NAO | NAO | SIM | SIM |
| Cancelar reserva de terceiros | NAO | NAO | SIM | SIM |
| Ver relatórios | NAO | NAO | SIM | SIM |
| Exportar CSV | NAO | NAO | SIM | SIM |
| Gerenciar salas | NAO | NAO | NAO | SIM |
| Criar/remover manutenção | NAO | NAO | NAO | SIM |
| Gerenciar usuários | NAO | NAO | NAO | SIM |
| Alterar papel de usuários | NAO | NAO | NAO | SIM |
| Aprovar/desativar usuários | NAO | NAO | NAO | SIM |
