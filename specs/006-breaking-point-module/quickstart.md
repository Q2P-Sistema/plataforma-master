# Quickstart: Breaking Point

**Feature Branch**: `006-breaking-point-module`  
**Created**: 2026-04-14

---

## Pré-requisitos

- Monorepo rodando localmente (`pnpm install` na raiz)
- Banco `dev_acxe_q2p_sanitizado` acessível
- Migration 0007 aplicada
- `MODULE_BREAKINGPOINT_ENABLED=true` no `.env`

---

## Como rodar a migration

```bash
cd packages/db
pnpm run migrate
# Ou direto:
psql $DATABASE_URL -f migrations/0007_breaking_point.sql
```

---

## Como testar a projeção manualmente

```bash
# 1. Checar se dados OMIE estão presentes
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"tbl_contasPagar_ACXE\" WHERE status_titulo IN ('ABERTO','ATRASADO');"

# 2. Checar saldo CC
psql $DATABASE_URL -c "SELECT \"nCodCC\", descricao, saldo_atual FROM \"tbl_contasCorrentes_ACXE\" WHERE inativo='N' AND bloqueado='N';"

# 3. Fazer requisição para a projeção
curl -s http://localhost:3000/api/v1/bp/projecao?empresa=acxe \
  -H "Cookie: session=..." | jq '.data.breaking_points'
```

---

## Fluxo de dados resumido

```
1. GET /api/v1/bp/projecao
   ├─ dados.service.ts lê BD OMIE (saldo_cc, dup_total, estoque, pagamentos/recebimentos semanais)
   ├─ config.service.ts lê bp_params + bp_banco_limites + bp_contas_config
   └─ motor.service.ts calcula 26 semanas + breaking points
      └─ Retorna kpis + semanas[] + breaking_points

2. Aba Configurar
   ├─ GET /api/v1/bp/bancos → lista bancos para edição
   ├─ PUT /api/v1/bp/bancos/:id → salva limite editado
   └─ GET /api/v1/bp/projecao recalcula automaticamente (cache invalidado)
```

---

## Estrutura de arquivos criados por esta feature

```
modules/breakingpoint/
├── package.json          (atualizado com deps: @atlas/core, @atlas/auth, @atlas/db)
├── tsconfig.json
├── src/
│   ├── index.ts          (export bpRouter)
│   ├── routes/
│   │   └── breakingpoint.routes.ts
│   └── services/
│       ├── config.service.ts   (CRUD bp_params, bp_banco_limites, bp_contas_config)
│       ├── dados.service.ts    (queries OMIE: saldo_cc, dup_total, pagamentos, recebimentos, estoque)
│       └── motor.service.ts    (calcEngine puro, sem I/O — testável com Vitest)

packages/db/
├── migrations/
│   └── 0007_breaking_point.sql
└── src/schemas/
    └── breakingpoint.ts   (Drizzle schema para as 3 tabelas)

apps/api/src/
└── modules.ts             (adicionar import e registro do bpRouter)

apps/web/src/
├── App.tsx                (adicionar rotas /breakingpoint/* e BP_SUB_ITEMS)
└── pages/breakingpoint/
    ├── BPLayout.tsx
    ├── BPDashboardPage.tsx
    ├── BPTabelaPage.tsx
    ├── BPEstruturaBancosPage.tsx
    ├── BPLimitesPage.tsx
    └── BPConfigPage.tsx
```

---

## Notas de implementação

- **motor.service.ts** não faz I/O — recebe `MotorInput` e retorna `MotorOutput`. Isso permite testar a lógica de cálculo puro sem banco.
- **Estoque D+15**: se módulo Hedge não estiver habilitado, `dados.service.ts` retorna `estoque_valor_venda = 0` sem erro.
- **cat_finimp_cod nulo**: se o gestor ainda não configurou o código FINIMP, o motor trata todos os pagamentos como "Op. Corrente" (não ativa lógica de bloqueio de duplicatas) e exibe aviso `config_incompleta = true`.
- **Contas sem toggle**: contas não encontradas em `bp_contas_config` são incluídas por padrão (comportamento inclusivo).
- **Cache**: `GET /projecao` tem cache de 5 min (mesmo mecanismo do Hedge — `cache.service.ts`). Invalidar ao salvar qualquer parâmetro via `PUT`.
