# Research: Breaking Point — Projeção de Liquidez

**Feature Branch**: `006-breaking-point-module`  
**Created**: 2026-04-14  
**Status**: Complete — todos os NEEDS CLARIFICATION resolvidos

---

## Decisão 1: Fonte de dados para cada parâmetro do motor

**Decision**: Dados do BD OMIE onde disponíveis; input manual persistido em tabelas próprias para o restante.

| Parâmetro do motor | Fonte | Coluna/Query |
|---|---|---|
| `saldo_cc` | `tbl_contasCorrentes_ACXE` | `SUM(saldo_atual) WHERE inativo='N' AND bloqueado='N' AND nCodCC = ANY(contas_ativas)` |
| `dup_total` | `tbl_contasReceber_ACXE` | `SUM(valor_documento) WHERE status_titulo IN ('ABERTO','ATRASADO')` |
| `cap_semanas[].val` | `tbl_contasPagar_ACXE` | `SUM(valor_documento) GROUP BY week(data_vencimento)` para 26 semanas |
| `cap_semanas[].tipo` | `tbl_contasPagar_ACXE` | Mapeado via `codigo_categoria` → Fornecedor/FINIMP/Op.Corrente |
| `finimp_usado` | `tbl_contasPagar_ACXE` | `SUM(valor_documento) WHERE codigo_categoria = $cat_finimp AND status IN ('ABERTO','ATRASADO')` |
| `finimp_amort_mensal` | `tbl_contasPagar_ACXE` | `SUM(valor_documento) WHERE codigo_categoria = $cat_finimp AND data_vencimento BETWEEN início_mês AND fim_mês` |
| `rec_semanas[].val` | `tbl_contasReceber_ACXE` | `SUM(valor_documento) GROUP BY week(data_vencimento)` para 26 semanas |
| `estoque_valor_venda` | `vw_hedge_estoque` + `bp_params.markup_estoque` | `SUM(valor_brl) × (1 + markup_estoque)` — view retorna custo, motor aplica markup para obter valor de venda |
| `dup_antecip_usado` | `breakingpoint.bp_params` | Input manual |
| `dup_antecip_limite` | `breakingpoint.bp_banco_limites` | Soma dos limites ativos |
| `dup_antecip_taxa` | `breakingpoint.bp_banco_limites` | Média ponderada pelo limite |
| `finimp_limite` | `breakingpoint.bp_banco_limites` | Soma dos limites FINIMP ativos |
| `finimp_garantia_pct` | `breakingpoint.bp_banco_limites` | Média ponderada pelo limite FINIMP |
| `markup_estoque` | `breakingpoint.bp_params` | Input manual (default 0.22) — aplicado pelo motor para converter custo→venda |
| `alerta_gap_limiar` | `breakingpoint.bp_params` | Input manual (default 300000) — limiar BRL para classificação ALERTA |
| `cat_finimp_cod` | `breakingpoint.bp_params` | Input manual — código categoria no OMIE |

**Rationale**: Máxima automação com dados do BD sincronizado pelo n8n; apenas dados que o OMIE nunca irá ter (limites bancários, taxas de crédito) são manuais.

**Alternatives considered**: Usar 100% mock (descartado — elimina valor operacional); usar API OMIE diretamente (descartado — viola Princípio II da Constituição).

---

## Decisão 2: Motor de cálculo semanal

**Decision**: Port direto do `calcEngine` do legado `breaking-point-claude.jsx` para TypeScript, com substituição dos `PARAMS` hardcoded por dados reais do BD.

**Lógica por semana:**
```
recebimentos_semana = rec_dup[w] + rec_estoque[w]
dup_bloq = finimp_saldo × finimp_garantia_pct
dup_livre = MAX(0, dup_total - dup_bloq)
antecip_bruta = MIN(dup_livre × dup_antecip_taxa, dup_antecip_limite)
antecip_disp = MAX(0, antecip_bruta - dup_antecip_usado)
finimp_disp = MAX(0, finimp_limite - finimp_saldo)
liquidez_total = saldo_cc + antecip_disp + rec_dup[w] + rec_estoque[w]
gap = liquidez_total - pagamentos[w]
reserva_obrig = pagamentos[w] × 1.20
cap_compra = MAX(0, saldo_cc + antecip_disp + finimp_disp - reserva_obrig)
saldo_cc = saldo_cc + rec_dup[w] + rec_estoque[w] - pagamentos[w]  # carry-forward
finimp_saldo -= amort_finimp_semana[w]
```

**Estoque D+15**: disponível a partir da semana 2, liquidado a 18% por semana sobre o saldo restante.

**Rationale**: A lógica do legado é correta e foi validada visualmente. Port para TS garante testabilidade, tipagem e cobertura de Vitest (exigência Princípio III).

---

## Decisão 3: Schema de banco próprio

**Decision**: Schema `breakingpoint.*` com 3 tabelas: `bp_params`, `bp_banco_limites`, `bp_contas_config`.

**Rationale**: Princípio I da Constituição — toda nova tabela nasce em schema de módulo, nunca em `public`.

**Tabelas definidas:**
- `bp_params` — parâmetros globais por empresa (1 linha por empresa)
- `bp_banco_limites` — limites por banco por empresa (N bancos × M empresas)
- `bp_contas_config` — toggle de inclusão por conta corrente

**Alternativas descartadas**: Usar tabela `public.config` genérica (viola fronteiras de módulo).

---

## Decisão 4: Estrutura de código no monorepo

**Decision**: Seguir padrão do módulo Hedge:
```
modules/breakingpoint/src/
  index.ts
  routes/breakingpoint.routes.ts
  services/
    config.service.ts   # CRUD bp_params + bp_banco_limites + bp_contas_config
    dados.service.ts    # Queries raw SQL nas tabelas OMIE
    motor.service.ts    # Motor de cálculo puro (sem I/O, testável)
packages/db/src/schemas/breakingpoint.ts  # Drizzle schema
packages/db/migrations/0007_breaking_point.sql
apps/web/src/pages/breakingpoint/
  BPLayout.tsx
  BPDashboardPage.tsx   # Countdowns + KPIs + gráfico
  BPTabelaPage.tsx
  BPEstruturaBancosPage.tsx
  BPLimitesPage.tsx
  BPConfigPage.tsx
```

**Rationale**: Consistência com padrão estabelecido; facilita onboarding e code review.

---

## Decisão 5: Recebimentos semanais — método de projeção

**Decision**: Usar vencimentos reais de `tbl_contasReceber_ACXE`; para semanas sem vencimentos, distribuir proporcionalmente o saldo restante.

**Query**:
```sql
SELECT
  FLOOR(EXTRACT(DOY FROM data_vencimento - CURRENT_DATE) / 7)::int AS semana,
  SUM(valor_documento) AS total
FROM public."tbl_contasReceber_ACXE"
WHERE status_titulo IN ('ABERTO', 'ATRASADO')
  AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 182
GROUP BY semana
ORDER BY semana
```

**Rationale**: Mais preciso que estimativa proporcional uniforme do legado (que usa `dup_total × 0.085` por semana). Os vencimentos reais já estão no BD.

---

## Decisão 6: Classificação de pagamentos por tipo

**Decision**: Derivada de `codigo_categoria` da conta a pagar. O código FINIMP é configurável em `bp_params.cat_finimp_cod`. Regra padrão: `codigo_categoria = cat_finimp_cod` → "FINIMP"; demais → "Fornecedor". Títulos quando `cat_finimp_cod` está nulo (config incompleta) → "Op. Corrente", e a lógica de bloqueio de duplicatas não é ativada.

**Rationale**: Regra simples e transparente. Fallback "Op. Corrente" quando config incompleta é conservador (não ativa bloqueio indevido). Refinamento (ex: múltiplos códigos FINIMP, prefixos) fica para fase futura.

---

## Dados de Schema Confirmados (tbl_* do OMIE)

### tbl_contasPagar_ACXE
- `codigo_lancamento_omie` bigint PK
- `valor_documento` numeric(15,2) — BRL
- `data_vencimento` date
- `data_emissao` date
- `status_titulo` text — 'ABERTO', 'ATRASADO', 'LIQUIDADO', 'CANCELADO'
- `codigo_categoria` text
- `codigo_cliente_fornecedor` bigint

### tbl_contasReceber_ACXE
- `codigo_lancamento_omie` bigint PK
- `valor_documento` numeric(15,2) — BRL
- `data_vencimento` date
- `status_titulo` varchar(20)
- `codigo_categoria` varchar(20)
- `codigo_cliente_fornecedor` bigint

### tbl_contasCorrentes_ACXE
- `nCodCC` bigint PK
- `descricao` text
- `codigo_banco` text
- `saldo_atual` numeric(15,2) — sincronizado do OMIE
- `inativo` char(1) — 'S'/'N'
- `bloqueado` char(1) — 'S'/'N'
- `valor_limite` numeric — cheque especial OMIE

### vw_hedge_estoque (view existente)
- `empresa` text
- `local_descricao` text
- `valor_total_brl` numeric
- `valor_total_usd` numeric
