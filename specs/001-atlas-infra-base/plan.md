# Implementation Plan: Atlas Infraestrutura Base

**Branch**: `001-atlas-infra-base` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-atlas-infra-base/spec.md`

## Summary

Setup completo da infraestrutura compartilhada da plataforma Atlas — autenticação com 3 perfis e 2FA, shell React com navegação dos 7 módulos, design system unificado, audit log imutável via triggers, health checks, feature flags por módulo, pipeline CI/CD, ambientes dev/staging/prod. Nenhuma funcionalidade de domínio (hedge, estoque, comex). Esta infraestrutura é a casca que recebe os módulos de domínio a partir da spec 002-hedge-engine.

## Technical Context

**Language/Version**: TypeScript 5.5+ (strict mode, ES2022, bundler resolution) / Node.js 20 LTS
**Primary Dependencies**: Express 4.x (backend), React 18 (frontend), Vite 5 (build), Drizzle ORM (query builder + migrations), shadcn/ui + Tailwind CSS (design system), Zustand (client state), TanStack Query (server state), Zod (validação runtime), Pino (logs estruturados), argon2 (hash senhas), otplib (TOTP 2FA)
**Storage**: PostgreSQL 16 com pgvector (banco `dev_acxe_q2p_sanitizado` na DigitalOcean) + Redis 8 (cache, rate limit, sessões)
**Testing**: Vitest + Supertest (backend), Vitest (frontend)
**Target Platform**: Linux server (DigitalOcean Docker Swarm com Traefik), web browser (Chrome/Firefox/Edge últimas 2 versões)
**Project Type**: Monorepo (pnpm workspaces + Turborepo) — monólito modular web-service + SPA
**Performance Goals**: Login <2s, dashboard <1s pós-login, deploy completo <10min, rollback <1min
**Constraints**: 2 containers em prod (apps/api + apps/web), VPS única Swarm, staging como stack paralela no mesmo Swarm
**Scale/Scope**: <50 usuários internos, 7 módulos (habilitáveis incrementalmente via feature flag)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Princípio I — Monólito Modular com Fronteiras Inegociáveis

| Gate | Status | Evidência |
|------|--------|-----------|
| ESLint com `eslint-plugin-boundaries` sem violações | PASS | Já configurado em `eslint.config.js` na Entrega 1. CI bloqueia merge com violação. |
| Queries cross-módulo via views no schema `shared` | PASS | Nesta spec não há queries cross-módulo — é infra pura. `packages/db` cria schema `shared` com tabela `audit_log`. |
| Tabelas novas em schema de módulo, não em `public` | PASS | Tabelas desta spec (`users`, `sessions`, `audit_log`) vão em schema `atlas` (infra compartilhada) e `shared` (audit). |

### Princípio II — OMIE é Fonte de Verdade, Atlas Lê do Postgres

| Gate | Status | Evidência |
|------|--------|-----------|
| Leitura via BD, não API OMIE | N/A | Esta spec não interage com OMIE. Deferred pra spec 002+. |

### Princípio III — Dinheiro Só em TypeScript

| Gate | Status | Evidência |
|------|--------|-----------|
| Nenhum cálculo financeiro em n8n | N/A | Esta spec não tem cálculos financeiros. |
| Cálculos cobertos por Vitest | N/A | Sem cálculos nesta spec. |

### Princípio IV — Audit Log Append-Only via Trigger

| Gate | Status | Evidência |
|------|--------|-----------|
| Trigger PL/pgSQL em tabelas de domínio | PASS | FR-006 exige audit log. `shared.audit_log` criada com triggers nas tabelas `atlas.users`. Trigger impede UPDATE/DELETE no `audit_log`. |
| Teste de integração cobre gravação de auditoria | PASS | Planejado: teste que cria/edita usuário e verifica registro em `shared.audit_log`. |
| Privilégios Postgres bloqueiam modificação do audit_log | PASS | Migration cria REVOKE UPDATE, DELETE em `shared.audit_log` para o role da aplicação. |

### Princípio V — Validação Paralela, Zero Big-Bang

| Gate | Status | Evidência |
|------|--------|-----------|
| Plano de validação paralela antes de staging | N/A | Esta spec não substitui nenhum sistema legado. Princípio aplica a partir da spec 002 (Hedge) e especialmente 003 (StockBridge). |

**Resultado: TODOS OS GATES PASSAM.** Sem violações, sem necessidade de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-atlas-infra-base/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/
├── core/                    # DB pool (Drizzle), logger (Pino), config loader, env validation (Zod)
│   ├── src/
│   │   ├── db.ts            # Drizzle client + pool config
│   │   ├── logger.ts        # Pino logger factory
│   │   ├── config.ts        # Env vars loader + Zod validation
│   │   ├── redis.ts         # Redis client (ioredis)
│   │   └── index.ts         # Public exports
│   ├── package.json
│   └── tsconfig.json
│
├── auth/                    # Auth: login, JWT cookie, RBAC, 2FA TOTP
│   ├── src/
│   │   ├── auth.service.ts  # Login, register, password reset, 2FA setup/verify
│   │   ├── auth.middleware.ts  # Express middleware: requireAuth, requireRole
│   │   ├── totp.service.ts  # TOTP generation/verification (otplib)
│   │   ├── password.ts      # argon2 hash/verify
│   │   ├── session.ts       # Cookie management (httpOnly, Secure, SameSite)
│   │   ├── csrf.ts          # CSRF token middleware
│   │   ├── rate-limit.ts    # Login rate limiting (Redis-backed)
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ui/                      # Design system React (shadcn/ui + Tailwind)
│   ├── src/
│   │   ├── components/      # Botão, Input, Card, Sidebar, Modal, Toast, Badge, Table, etc.
│   │   ├── tokens/          # Cores, tipografia, spacing (CSS vars)
│   │   ├── layouts/         # ShellLayout (sidebar + topbar + content area)
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── db/                      # Migrations + schemas Drizzle
│   ├── src/
│   │   ├── schemas/
│   │   │   ├── atlas.ts     # Schema 'atlas': users, sessions
│   │   │   └── shared.ts    # Schema 'shared': audit_log
│   │   └── index.ts
│   ├── migrations/          # Drizzle Kit output (SQL files versionados)
│   │   └── 0001_atlas_infra_base.sql
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── integrations/
│   ├── omie/                # Cliente OMIE (scope reduzido — só escrita de exceção)
│   │   ├── src/
│   │   │   └── index.ts     # Placeholder, implementação na spec 002+
│   │   └── package.json
│   └── bcb/                 # Cliente BCB (PTAX)
│       ├── src/
│       │   └── index.ts     # Placeholder, implementação na spec 002
│       └── package.json

apps/
├── api/                     # Backend Express unificado
│   ├── src/
│   │   ├── server.ts        # Express setup, middleware global, module registration
│   │   ├── health.ts        # GET /api/v1/health (Postgres, Redis, n8n status)
│   │   ├── modules.ts       # Feature flag reader + dynamic module loader
│   │   ├── envelope.ts      # Response envelope middleware {data, error, meta}
│   │   ├── error-handler.ts # Global error handler (Trace ID, sanitize, Pino log)
│   │   └── routes/
│   │       ├── auth.routes.ts   # Login, logout, register, reset-password, 2fa-setup, 2fa-verify
│   │       └── admin.routes.ts  # CRUD users, change role, deactivate, reset password
│   ├── Dockerfile           # Multi-stage: build TS → run node:20-alpine
│   ├── package.json
│   └── tsconfig.json
│
├── web/                     # Frontend React SPA
│   ├── src/
│   │   ├── main.tsx         # Entry point React
│   │   ├── App.tsx          # Router + AuthProvider + ThemeProvider
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── TwoFactorPage.tsx
│   │   │   ├── TwoFactorSetupPage.tsx
│   │   │   ├── DashboardPage.tsx    # Shell com sidebar + módulo ativo ou placeholder
│   │   │   ├── AdminUsersPage.tsx
│   │   │   └── NotFoundPage.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx          # 7 módulos, visual habilitado/desabilitado
│   │   │   ├── TopBar.tsx           # Nome do usuário, perfil, logout
│   │   │   └── ModulePlaceholder.tsx # "Módulo em implementação"
│   │   ├── hooks/
│   │   │   ├── useAuth.ts           # Auth context + session state
│   │   │   └── useModules.ts        # Lista de módulos + status habilitado
│   │   ├── stores/
│   │   │   └── auth.store.ts        # Zustand store (user, isAuthenticated)
│   │   └── lib/
│   │       └── api.ts               # TanStack Query + fetch wrapper com CSRF
│   ├── Dockerfile           # Multi-stage: build Vite → nginx:alpine
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json

deploy/
├── atlas.stack.yml          # Docker Swarm stack (api + web + labels Traefik)
├── atlas-staging.stack.yml  # Stack staging (prefixo atlas-staging-*, banco separado)
└── docker-compose.yml       # Dev local (Postgres + Redis + api + web)

.github/
└── workflows/
    └── ci.yml               # Lint + typecheck + test + build + push Docker Hub
```

**Structure Decision**: Monorepo com pnpm workspaces. `packages/` contém código reutilizável sem estado (core, auth, ui, db). `apps/` contém os processos que sobem em produção (api, web). `deploy/` contém configs de deploy. Estrutura já criada na Entrega 1 — esta spec preenche o conteúdo.

## Complexity Tracking

> Nenhuma violação de Constitution Check. Tabela vazia.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
