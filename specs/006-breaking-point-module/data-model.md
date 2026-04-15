# Data Model: Breaking Point — Projeção de Liquidez

**Feature Branch**: `006-breaking-point-module`  
**Created**: 2026-04-14

---

## Tabelas Novas (schema `breakingpoint.*`)

### breakingpoint.bp_params

Parâmetros globais manuais por empresa. Uma linha por empresa.

| Coluna | Tipo | Nulo | Default | Descrição |
|--------|------|------|---------|-----------|
| `id` | UUID | NOT NULL | gen_random_uuid() | PK |
| `empresa` | VARCHAR(10) | NOT NULL | — | 'acxe' \| 'q2p' — UNIQUE |
| `dup_antecip_usado` | NUMERIC(15,2) | NOT NULL | 0 | Total já antecipado de duplicatas (BRL) |
| `markup_estoque` | NUMERIC(5,4) | NOT NULL | 0.22 | Markup de venda sobre custo (ex: 0.22 = 22%) |
| `alerta_gap_limiar` | NUMERIC(15,2) | NOT NULL | 300000 | Limiar (BRL) abaixo do qual semana com gap ≥ 0 vira ALERTA |
| `cat_finimp_cod` | VARCHAR(50) | NULL | — | Código de categoria OMIE que representa FINIMP |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | Última atualização |
| `updated_by` | UUID | NULL | — | FK → atlas.users(id) |

**Índice único**: `(empresa)`

**Audit trigger**: INSERT, UPDATE → `shared.audit_log`

---

### breakingpoint.bp_banco_limites

Limites de crédito por banco, por empresa.

| Coluna | Tipo | Nulo | Default | Descrição |
|--------|------|------|---------|-----------|
| `id` | UUID | NOT NULL | gen_random_uuid() | PK |
| `empresa` | VARCHAR(10) | NOT NULL | — | 'acxe' \| 'q2p' |
| `banco_id` | VARCHAR(50) | NOT NULL | — | Slug único ex: 'bradesco', 'itau' |
| `banco_nome` | VARCHAR(100) | NOT NULL | — | Nome para exibição |
| `cor_hex` | VARCHAR(7) | NOT NULL | '#666666' | Cor de identificação visual |
| `antecip_limite` | NUMERIC(15,2) | NOT NULL | 0 | Limite de antecipação (BRL) |
| `antecip_usado` | NUMERIC(15,2) | NOT NULL | 0 | Já usado no período (BRL) |
| `antecip_taxa` | NUMERIC(5,4) | NOT NULL | 0.85 | Taxa de antecipação ex: 0.85 = 85% |
| `finimp_limite` | NUMERIC(15,2) | NOT NULL | 0 | Limite FINIMP (BRL) |
| `finimp_usado` | NUMERIC(15,2) | NOT NULL | 0 | FINIMP utilizado (BRL) — redundante com BD OMIE, mantido para reconciliação |
| `finimp_garantia_pct` | NUMERIC(5,4) | NOT NULL | 0.40 | % duplicatas bloqueadas como garantia FINIMP |
| `cheque_limite` | NUMERIC(15,2) | NOT NULL | 0 | Limite cheque especial (BRL) |
| `cheque_usado` | NUMERIC(15,2) | NOT NULL | 0 | Cheque especial utilizado (BRL) |
| `ativo` | BOOLEAN | NOT NULL | true | Banco ativo na estrutura |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | Última atualização |
| `updated_by` | UUID | NULL | — | FK → atlas.users(id) |

**Índice único**: `(empresa, banco_id)`

**Audit trigger**: INSERT, UPDATE, DELETE → `shared.audit_log`

---

### breakingpoint.bp_contas_config

Toggle de inclusão de conta corrente no cálculo de saldo CC.

| Coluna | Tipo | Nulo | Default | Descrição |
|--------|------|------|---------|-----------|
| `n_cod_cc` | BIGINT | NOT NULL | — | Código OMIE da conta corrente (PK composta) |
| `empresa` | VARCHAR(10) | NOT NULL | — | 'acxe' \| 'q2p' (PK composta) |
| `incluir` | BOOLEAN | NOT NULL | true | true = incluir no cálculo |
| `updated_at` | TIMESTAMPTZ | NOT NULL | now() | Última atualização |

**PK composta**: `(n_cod_cc, empresa)`

**Nota**: Contas sem registro nesta tabela são tratadas como `incluir = true` (default inclusivo).

---

## Tabelas Lidas (OMIE — somente leitura, schema `public`)

### public.tbl_contasPagar_ACXE

Pagamentos projetados (cap_semanas). Motor lê para calcular saídas de caixa semanais.

Campos usados: `valor_documento`, `data_vencimento`, `status_titulo`, `codigo_categoria`

Filtro: `status_titulo IN ('ABERTO', 'ATRASADO') AND data_vencimento BETWEEN now() AND now() + 182`

---

### public.tbl_contasReceber_ACXE

Recebimentos projetados (rec_semanas). Motor lê para calcular entradas de caixa semanais.

Campos usados: `valor_documento`, `data_vencimento`, `status_titulo`

Filtro: `status_titulo IN ('ABERTO', 'ATRASADO') AND data_vencimento BETWEEN now() AND now() + 182`

---

### public.tbl_contasCorrentes_ACXE

Saldo de caixa atual. Motor lê para inicializar `saldo_cc`.

Campos usados: `nCodCC`, `saldo_atual`, `inativo`, `bloqueado`, `descricao`, `codigo_banco`

Filtro: `inativo = 'N' AND bloqueado = 'N'` — restringido pelo toggle em `bp_contas_config`

---

### public.vw_hedge_estoque (view existente)

Valor de estoque para projeção de liquidação D+15.

Campos usados: `empresa`, `valor_total_brl`

Filtro: `empresa = $empresa`

---

## Entidade de Leitura: Semana Projetada (não persistida)

Calculada em memória pelo motor, retornada pela API.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `semana` | integer | Número da semana (0 = hoje, 1..25) |
| `label` | string | "Hoje" ou "S1"..."S25" |
| `data_fmt` | string | Data formatada "DD MMM" |
| `pagamento` | number | Saídas de caixa na semana (BRL) |
| `tipo` | string | Tipo dominante: "Fornecedor" \| "FINIMP" \| "Op.Corrente" |
| `is_finimp` | boolean | Se a semana tem pagamento FINIMP |
| `rec_dup` | number | Recebimento de duplicatas (BRL) |
| `rec_estoque` | number | Recebimento de estoque D+15 (BRL) |
| `saldo_cc` | number | Saldo CC projetado ao fim da semana (BRL) |
| `antecip_disp` | number | Antecipação disponível (BRL) |
| `finimp_disp` | number | FINIMP disponível (BRL) |
| `finimp_saldo` | number | Saldo devedor FINIMP (BRL) |
| `dup_bloq` | number | Duplicatas bloqueadas como garantia (BRL) |
| `dup_livre` | number | Duplicatas livres para antecipação (BRL) |
| `liquidez_total` | number | Liquidez total disponível (BRL) |
| `gap` | number | Gap de liquidez = liquidez_total - pagamento (BRL) |
| `cap_compra` | number | Capacidade de compras (BRL) |
| `estoque_rest` | number | Saldo de estoque ainda não liquidado (BRL) |
| `status_gap` | string | "critico" \| "alerta" \| "ok" |

---

## Entidade de Leitura: Breaking Points (não persistida)

Calculada junto com as semanas projetadas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `break_caixa` | `{ semana, data, val }` \| null | Primeira semana com saldo CC negativo |
| `break_antecip` | `{ semana, data, val }` \| null | Primeira semana com antecipação < limiar |
| `break_total` | `{ semana, data, val }` \| null | Primeira semana com gap < 0 |
| `trava_finimp` | `{ semana, data }` \| null | Primeira semana onde dup_bloq > dup_livre × 0.6 |

---

## Diagrama de Dependências

```
OMIE (n8n sync)
  └─► tbl_contasPagar_ACXE ──────────┐
  └─► tbl_contasReceber_ACXE ─────────┤
  └─► tbl_contasCorrentes_ACXE ───────┤──► motor.service.ts ──► API /bp/projecao
  └─► vw_hedge_estoque ───────────────┤         ▲
                                      │         │
breakingpoint.bp_params ──────────────┤─────────┘
breakingpoint.bp_banco_limites ───────┘
breakingpoint.bp_contas_config ─────────────────►  (filtra tbl_contasCorrentes)
```

---

## Migration

Arquivo: `packages/db/migrations/0007_breaking_point.sql`

Inclui:
1. `CREATE SCHEMA IF NOT EXISTS breakingpoint`
2. Criação das 3 tabelas com índices
3. Triggers de audit log para `bp_params` e `bp_banco_limites`
4. Seed de defaults para empresa 'acxe': 5 bancos (Bradesco, Itaú, Santander, BTG, Sicoob)
5. Seed de `bp_params` para 'acxe' com defaults
