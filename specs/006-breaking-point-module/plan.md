# Implementation Plan: Breaking Point — Projeção de Liquidez

**Branch**: `006-breaking-point-module` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/006-breaking-point-module/spec.md`

## Summary

Implementar o módulo Breaking Point: projeção de liquidez BRL em 26 semanas com motor de cálculo que combina dados do BD OMIE (contas a pagar/receber, saldo CC, estoque) com parâmetros manuais de crédito bancário persistidos em schema próprio. Interface com 5 abas: Dashboard (countdowns + KPIs + gráfico), Tabela, Estrutura Bancária, Limites e Configurar (edição de parâmetros manuais + toggle de contas correntes).

## Technical Context

**Language/Version**: TypeScript 5.5+ strict, Node.js 20 LTS  
**Primary Dependencies**: Express 4 (API), React 18 + Vite (frontend), Drizzle ORM (schema + migrations), raw SQL via getPool() (queries OMIE), Recharts (gráficos), Zod (validação), shadcn/ui + Tailwind (UI)  
**Storage**: PostgreSQL 16 — leitura em `public.*` (tabelas OMIE), escrita em `breakingpoint.*` (config manual)  
**Testing**: Vitest — cobertura obrigatória do `motor.service.ts` (cálculo puro)  
**Target Platform**: Linux server / Docker Swarm  
**Project Type**: Módulo de monólito web (monorepo pnpm + Turborepo)  
**Performance Goals**: Projeção 26 semanas em < 3s; recalculo pós-config em < 2s  
**Constraints**: Leitura somente do Postgres (sem chamada OMIE); limites bancários 100% manuais; UI fase 1 restrita a ACXE (schema e API já suportam Q2P sem migration adicional)  
**Scale/Scope**: ~10 usuários internos; dados OMIE já no BD via n8n

## Constitution Check

*GATE: Verificado antes da fase de implementação. Re-checar em code review.*

| Princípio | Status | Observação |
|-----------|--------|------------|
| I. Monólito Modular com Fronteiras | ✅ PASS | Schema `breakingpoint.*` próprio; export via `index.ts`; cross-módulo de estoque via `vw_hedge_estoque` (view em `public`, não acesso direto a tabela privada hedge) |
| II. OMIE é Fonte de Verdade, Atlas Lê do Postgres | ✅ PASS | Nenhuma chamada à API OMIE; todas as leituras no BD local sincronizado pelo n8n |
| III. Dinheiro Só em TypeScript | ✅ PASS | `motor.service.ts` em TS com testes Vitest; nenhum cálculo financeiro no n8n |
| IV. Audit Log Append-Only | ✅ PASS | Triggers de audit em `bp_params` e `bp_banco_limites` na migration 0007 |
| V. Validação Paralela, Zero Big-Bang | ✅ PASS | Módulo greenfield (sem legado Breaking Point em produção); não se aplica validação paralela |

**Complexity Tracking**: Nenhuma violação — seção omitida.

## Project Structure

### Documentation (this feature)

```text
specs/006-breaking-point-module/
├── plan.md              ← este arquivo
├── spec.md              ← especificação funcional
├── research.md          ← decisões técnicas e schema real das tabelas OMIE
├── data-model.md        ← modelo de dados (3 tabelas novas + tabelas OMIE lidas)
├── quickstart.md        ← como rodar e testar
├── contracts/
│   └── api.md           ← 7 endpoints REST documentados
├── checklists/
│   └── requirements.md  ← checklist de qualidade (todos passando)
└── tasks.md             ← gerado por /speckit-tasks (próximo passo)
```

### Source Code

```text
packages/db/
├── migrations/
│   └── 0007_breaking_point.sql    ← schema breakingpoint.*, 3 tabelas, triggers, seed
└── src/schemas/
    ├── breakingpoint.ts           ← Drizzle schema (bp_params, bp_banco_limites, bp_contas_config)
    └── index.ts                   ← re-exportar tipos do breakingpoint

modules/breakingpoint/
├── package.json                   ← deps: @atlas/core, @atlas/auth, @atlas/db
├── tsconfig.json
└── src/
    ├── index.ts                   ← export { bpRouter }
    ├── routes/
    │   └── breakingpoint.routes.ts  ← 7 endpoints + auth + cache invalidation
    └── services/
        ├── config.service.ts      ← CRUD bp_params, bp_banco_limites, bp_contas_config
        ├── dados.service.ts       ← queries OMIE (saldo_cc, dup_total, pagamentos, recebimentos, estoque)
        └── motor.service.ts       ← calcEngine puro (sem I/O) + tipos MotorInput/MotorOutput

apps/api/src/
└── modules.ts                     ← adicionar registro do bpRouter (quando MODULE_BREAKINGPOINT_ENABLED)

apps/web/src/
├── App.tsx                        ← adicionar BP_SUB_ITEMS + rotas /breakingpoint/*
└── pages/breakingpoint/
    ├── BPLayout.tsx               ← wrapper com 5 abas + navegação
    ├── BPDashboardPage.tsx        ← countdowns + 6 KPIs + gráfico ComposedChart + gráfico FINIMP
    ├── BPTabelaPage.tsx           ← tabela 26 semanas com toggle "ver todas" + semáforo
    ├── BPEstruturaBancosPage.tsx  ← cards por banco (antecip/FINIMP/cheque: limite/usado/disponível)
    ├── BPLimitesPage.tsx          ← breakdown de limites e totais agregados
    └── BPConfigPage.tsx           ← formulário edição bp_params + bp_banco_limites + toggle contas
```

**Structure Decision**: Web application — backend em `modules/breakingpoint/`, frontend em `apps/web/src/pages/breakingpoint/`. Padrão idêntico ao módulo Hedge.
