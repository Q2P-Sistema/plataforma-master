# Feature Specification: Breaking Point — Projeção de Liquidez

**Feature Branch**: `006-breaking-point-module`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "o módulo do breakingpoint"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver projeção de liquidez e alertas de breaking point (Priority: P1)

O gestor de tesouraria abre o módulo e enxerga, de forma imediata, em qual semana a empresa ficará sem caixa. O painel principal mostra 4 contadores regressivos (dias até cada evento crítico), 6 KPIs de posição atual e um gráfico de 26 semanas com curvas de liquidez, pagamentos projetados e capacidade de compras.

**Por que P1**: Sem essa visão o gestor não tem como antecipar crises de caixa. É o núcleo do módulo.

**Independent Test**: Acessar `/breakingpoint` com dados reais carregados. O painel deve exibir os 4 countdowns e o gráfico sem interação adicional do usuário. Entrega valor imediato mesmo sem as outras funcionalidades.

**Acceptance Scenarios**:

1. **Given** o módulo está habilitado e há dados de contas a pagar/receber no sistema, **When** o gestor acessa o Breaking Point, **Then** são exibidos: semana do primeiro colapso de liquidez, semana do saldo CC negativo, semana do esgotamento de antecipação, semana da trava FINIMP↔antecipação — todos com contagem regressiva em dias.
2. **Given** a projeção não detecta nenhum evento crítico nas 26 semanas, **When** o gestor acessa o painel, **Then** cada contador exibe "Sem risco nos 180 dias" com indicador verde.
3. **Given** um breaking point é detectado nas próximas 4 semanas, **When** o gestor acessa o painel, **Then** o fundo do painel e o indicador visual refletem nível de urgência crítico (vermelho), diferenciando de alertas distantes (âmbar/teal).
4. **Given** o gráfico está exibido, **When** o gestor passa o cursor sobre uma semana, **Then** aparece tooltip com: pagamentos, recebimento de duplicatas, recebimento de estoque D+15, saldo CC, capacidade de antecipação, capacidade de compras e gap de liquidez daquela semana.
5. **Given** o dashboard está exibido, **When** o gestor rola abaixo do gráfico principal, **Then** vê um segundo gráfico mostrando a evolução semanal do saldo FINIMP e das duplicatas bloqueadas como garantia.

---

### User Story 2 — Configurar parâmetros manuais e toggle de contas correntes (Priority: P2)

O gestor acessa a aba Configurar e informa os limites de crédito bancário (antecipação, FINIMP, cheque especial por banco), a taxa de antecipação, percentual de garantia FINIMP e markup de estoque. Também seleciona quais contas correntes entram no cálculo de caixa (excluindo contas PDV, aplicações ou bloqueadas judicialmente).

**Por que P2**: Os dados de limite bancário não existem no ERP. Sem esses parâmetros o motor usa zeros e a projeção é incorreta. A configuração é pré-requisito para precisão dos cálculos.

**Independent Test**: Editar qualquer parâmetro na aba Configurar e salvar. A projeção no gráfico deve recalcular refletindo o novo valor. Testável de forma isolada sem as demais abas.

**Acceptance Scenarios**:

1. **Given** o gestor acessa a aba Configurar, **When** edita o limite de antecipação de um banco e salva, **Then** a projeção e os countdowns são recalculados em até 2 segundos com o novo valor.
2. **Given** há contas correntes cadastradas no sistema, **When** o gestor desmarca uma conta PDV na lista de contas ativas, **Then** o saldo CC exibido nos KPIs e na projeção exclui o saldo dessa conta.
3. **Given** o gestor salva parâmetros, **When** fecha o navegador e reabre o módulo, **Then** os parâmetros configurados anteriormente estão preservados.
4. **Given** o gestor tenta salvar uma taxa de antecipação acima de 100% ou um percentual de garantia negativo, **When** submete o formulário, **Then** o sistema exibe erro de validação e não salva.

---

### User Story 3 — Analisar estrutura bancária e limites de crédito (Priority: P3)

O gestor acessa a aba Estrutura e visualiza, banco a banco, a situação dos limites de antecipação de duplicatas, FINIMP e cheque especial — mostrando limite total, quanto já foi usado e quanto resta disponível.

**Por que P3**: Permite identificar qual banco tem mais margem disponível para operações de crédito de curto prazo, apoiando decisões de antecipação ou contratação de FINIMP.

**Independent Test**: Acessar a aba Estrutura e verificar que os dados de cada banco correspondem aos parâmetros configurados na aba Configurar.

**Acceptance Scenarios**:

1. **Given** há bancos configurados, **When** o gestor acessa a aba Estrutura, **Then** vê para cada banco: nome, limite de antecipação, usado e disponível; limite FINIMP, usado e disponível; limite cheque especial, usado e disponível.
2. **Given** um banco tem toda a antecipação consumida, **When** exibido na aba Estrutura, **Then** o indicador de capacidade disponível aparece em destaque vermelho.

---

### User Story 4 — Consultar tabela semanal detalhada com semáforo (Priority: P3)

O gestor acessa a aba Tabela e vê todas as 26 semanas em formato tabular, com a opção de filtrar apenas as semanas em alerta ou crise.

**Por que P3**: Complementa o gráfico com dados exatos por semana. Útil para apresentar em reuniões de gestão.

**Independent Test**: Acessar a aba Tabela e verificar que os valores numéricos batem com o tooltip do gráfico para a mesma semana.

**Acceptance Scenarios**:

1. **Given** o gestor acessa a aba Tabela, **When** o painel carrega, **Then** exibe por padrão apenas semanas com status ALERTA ou CRISE; um toggle "Ver todas" expande para as 26 semanas.
2. **Given** a tabela está exibida, **When** o gestor observa uma linha, **Then** cada semana mostra: número da semana, data, tipo de pagamento dominante, valor dos pagamentos, saldo CC, capacidade de antecipação, capacidade de compras, saldo FINIMP, duplicatas bloqueadas, gap de liquidez e badge de status (CRISE / ALERTA / OK).

---

### Edge Cases

- O que acontece quando não há contas a pagar nas próximas 26 semanas? → Projeção mostra liquidez crescente sem breaking point.
- O que acontece quando todos os parâmetros manuais são zero (configuração inicial)? → Motor usa zeros para limites bancários; projeção ainda funciona com saldo CC e recebimentos do BD; aviso visual indica que configuração está incompleta.
- O que acontece quando o saldo CC atual já é negativo? → Contador de "Saldo CC Negativo" exibe "Hoje" (semana 0).
- O que acontece quando uma conta corrente excluída no toggle tem o maior saldo? → A exclusão reflete imediatamente em todos os KPIs e na projeção; o gestor pode desfazer reincluindo a conta.
- O que acontece com pagamentos cujo código de categoria FINIMP não está mapeado? → São tratados como "Op. Corrente" e não ativam a lógica de bloqueio de duplicatas; aviso visual indica categoria não mapeada na aba Configurar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE calcular a projeção de liquidez semana a semana por 26 semanas (180 dias) a partir da data atual.
- **FR-002**: O sistema DEVE identificar e sinalizar o primeiro evento de cada tipo: colapso de liquidez total, saldo CC negativo, esgotamento de capacidade de antecipação e trava FINIMP↔antecipação.
- **FR-003**: O sistema DEVE calcular a capacidade de compras semanal como: caixa disponível + antecipação disponível + FINIMP disponível − obrigações da semana com buffer de 20%.
- **FR-004**: O sistema DEVE calcular o gap de liquidez semanal como: saldo CC + antecipação disponível + recebimento de duplicatas projetado + recebimento de estoque D+15 − pagamentos da semana.
- **FR-005**: O sistema DEVE calcular o saldo CC a partir das contas correntes ativas no sistema, respeitando o toggle de inclusão/exclusão por conta definido pelo gestor.
- **FR-006**: O sistema DEVE calcular o total de duplicatas a receber com base nos títulos em aberto no ERP.
- **FR-007**: O sistema DEVE calcular o FINIMP em aberto como soma dos títulos a pagar com categoria FINIMP e status aberto.
- **FR-008**: O sistema DEVE calcular a amortização mensal de FINIMP com base nos vencimentos do mês corrente.
- **FR-009**: O sistema DEVE calcular as duplicatas bloqueadas como garantia FINIMP: `saldo_finimp × percentual_garantia`.
- **FR-010**: O sistema DEVE calcular a antecipação disponível como: `(duplicatas_livres × taxa_antecipação) − antecipação_já_usada`, respeitando o limite total configurado.
- **FR-011**: O sistema DEVE projetar os pagamentos semanais com base nos títulos a pagar vencendo em cada semana, classificados por tipo (Fornecedor, FINIMP, Op. Corrente). A classificação segue a regra: código de categoria igual a `cat_finimp_cod` → FINIMP; demais → Fornecedor (regra padrão, refinável em fase futura). Títulos com `cat_finimp_cod` não configurado caem em "Op. Corrente".
- **FR-012**: O sistema DEVE projetar a receita semanal de duplicatas com base nos vencimentos dos títulos a receber; para semanas sem vencimentos, usar estimativa proporcional ao total de recebíveis restantes.
- **FR-013**: O sistema DEVE permitir ao gestor configurar, por banco: limite de antecipação, valor já usado, taxa de antecipação; limite de FINIMP, valor usado, percentual de garantia; limite de cheque especial e valor usado.
- **FR-014**: O sistema DEVE agregar os limites bancários para calcular totais globais usados no motor de projeção.
- **FR-015**: O sistema DEVE permitir ao gestor incluir ou excluir contas correntes individualmente do cálculo de saldo CC.
- **FR-016**: O sistema DEVE persistir todos os parâmetros manuais (limites bancários, toggles de conta, taxas) entre sessões.
- **FR-017**: O sistema DEVE recalcular a projeção imediatamente após qualquer alteração de parâmetro pelo gestor.
- **FR-018**: O sistema DEVE classificar cada semana projetada com status: **CRISE** (gap < 0), **ALERTA** (0 ≤ gap < `alerta_gap_limiar`), **OK** (gap ≥ `alerta_gap_limiar`). O limiar é um parâmetro configurável em `bp_params` (default R$ 300.000).
- **FR-019**: O sistema DEVE permitir ao gestor alternar entre visualização filtrada (só ALERTA/CRISE) e completa (26 semanas) na aba Tabela.
- **FR-020**: O sistema DEVE aplicar o markup de estoque (configurável em `bp_params.markup_estoque`) para converter o valor de custo do estoque em valor de venda: `estoque_valor_venda = estoque_custo_brl × (1 + markup_estoque)`. Esse valor de venda é usado na projeção de liquidação D+15 a partir da semana 2, com taxa fixa de liquidação de 18% por semana sobre o saldo restante.
- **FR-021**: O sistema DEVE exibir aviso visual quando parâmetros manuais obrigatórios ainda não foram configurados (limites bancários zerados).

### Key Entities

- **Projeção Semanal**: Representa uma semana do horizonte de 26 semanas. Atributos: número da semana, data de início, total de pagamentos, tipo dominante de pagamento, recebimento de duplicatas, recebimento de estoque, saldo CC projetado, antecipação disponível, FINIMP disponível, duplicatas bloqueadas, capacidade de compras, gap de liquidez, status (CRISE/ALERTA/OK).
- **Parâmetros Globais**: Conjunto de configurações manuais não disponíveis no ERP. Atributos: antecipação já usada, markup de estoque, código de categoria FINIMP no ERP. Escopo por empresa (ACXE / Q2P).
- **Limite Bancário**: Configuração de crédito de um banco para a empresa. Atributos: identificador do banco, nome, cor de identificação visual, limites e valores usados de antecipação/FINIMP/cheque especial, taxa de antecipação, percentual de garantia FINIMP, ativo/inativo. Escopo por empresa.
- **Toggle de Conta Corrente**: Define se uma conta corrente do sistema entra no cálculo de saldo CC. Atributos: código da conta, empresa, incluir (sim/não).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O gestor identifica a semana do primeiro breaking point em menos de 5 segundos após abrir o módulo.
- **SC-002**: Qualquer alteração de parâmetro na aba Configurar reflete na projeção em menos de 2 segundos.
- **SC-003**: 100% dos parâmetros manuais (limites bancários, toggles de conta, taxas) são editáveis pela interface sem necessidade de acesso técnico ao sistema.
- **SC-004**: Os valores exibidos na tabela semanal são numericamente consistentes com os valores no tooltip do gráfico para a mesma semana.
- **SC-005**: O módulo carrega e exibe a projeção completa de 26 semanas em menos de 3 segundos.
- **SC-006**: Parâmetros configurados pelo gestor são preservados após fechar e reabrir o módulo.

## Assumptions

- Os dados de contas a pagar e receber sincronizados pelo n8n são suficientes para calcular os pagamentos e recebimentos semanais projetados.
- A classificação dos pagamentos em Fornecedor, FINIMP ou Op. Corrente é feita pelo código de categoria no ERP; o gestor informa qual código representa FINIMP na aba Configurar.
- O valor de estoque disponível para liquidação (D+15) virá do mesmo dado de estoque usado pelo módulo Hedge; se o Hedge não estiver habilitado, o campo estoque será zero.
- O motor, schema e API do módulo suportam as empresas ACXE e Q2P desde o início (parâmetros escopo por empresa). A UI da fase 1 expõe apenas ACXE; seletor de empresa na UI fica para fase futura sem necessidade de novas migrations.
- Não há integração com sistemas bancários em tempo real; todos os limites e valores utilizados de crédito bancário são inseridos manualmente pelo gestor.
- A projeção usa os vencimentos reais dos títulos a receber para distribuir recebimentos por semana.
- O cálculo de capacidade de compras usa buffer fixo de 20% sobre as obrigações como margem de segurança operacional.
- Apenas usuários com papel gestor ou diretor têm acesso ao módulo Breaking Point.
