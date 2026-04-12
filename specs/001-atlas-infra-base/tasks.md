# Tasks: Atlas Infraestrutura Base

**Input**: Design documents from `/specs/001-atlas-infra-base/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Incluídos para fluxos críticos (autenticação, audit log, feature flags) conforme SC-005 e SC-010 da spec.

**Organization**: Tasks agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: User story à qual a task pertence (US1, US2, etc.)
- Paths relativos à raiz do monorepo

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Configurar dependências, tooling e estrutura base do monorepo (já parcialmente feito na Entrega 1).

- [x] T001 Instalar dependências dos workspaces: `pnpm install` na raiz (valida que pnpm-workspace.yaml resolve todos os packages)
- [x] T002 [P] Criar `packages/core/tsconfig.json` estendendo `tsconfig.base.json` com paths de workspace
- [x] T003 [P] Criar `packages/auth/tsconfig.json` estendendo `tsconfig.base.json`
- [x] T004 [P] Criar `packages/ui/tsconfig.json` estendendo `tsconfig.base.json` com JSX react-jsx
- [x] T005 [P] Criar `packages/db/tsconfig.json` estendendo `tsconfig.base.json`
- [x] T006 [P] Criar `apps/api/tsconfig.json` estendendo `tsconfig.base.json`
- [x] T007 [P] Criar `apps/web/tsconfig.json` estendendo `tsconfig.base.json` com JSX react-jsx
- [x] T008 [P] Adicionar dependências em `packages/core/package.json`: pg, drizzle-orm, pino, ioredis, zod, dotenv
- [x] T009 [P] Adicionar dependências em `packages/auth/package.json`: argon2, otplib, qrcode, @atlas/core
- [x] T010 [P] Adicionar dependências em `packages/ui/package.json`: react, tailwindcss, class-variance-authority, clsx, tailwind-merge
- [x] T011 [P] Adicionar dependências em `packages/db/package.json`: drizzle-orm, drizzle-kit, pg, @atlas/core
- [x] T012 [P] Adicionar dependências em `apps/api/package.json`: express, cors, cookie-parser, csurf, express-rate-limit, @atlas/core, @atlas/auth, @atlas/db
- [x] T013 [P] Adicionar dependências em `apps/web/package.json`: react, react-dom, react-router-dom, zustand, @tanstack/react-query, @atlas/ui
- [x] T014 Criar `deploy/docker-compose.yml` com Postgres 16 (porta 5432) + Redis 8 (porta 6379) pra dev local
- [x] T015 Criar `.env.example` na raiz com todas as variáveis documentadas (DATABASE_URL, REDIS_URL, SESSION_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, N8N_HEALTH_URL, MODULE_*_ENABLED)

**Checkpoint**: `pnpm install` roda sem erro, tsconfig resolve paths entre workspaces, `docker compose up -d` sobe Postgres+Redis.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura core que DEVE estar completa antes de qualquer user story.

**CRITICAL**: Nenhum trabalho de user story começa antes desta fase estar completa.

- [x] T016 Implementar `packages/core/src/config.ts` — loader de env vars com validação Zod (DATABASE_URL, REDIS_URL, SESSION_SECRET, N8N_HEALTH_URL, MODULE flags)
- [x] T017 Implementar `packages/core/src/db.ts` — Drizzle client (pool pg, connection string de config)
- [x] T018 [P] Implementar `packages/core/src/logger.ts` — factory Pino (JSON structured, redaction de campos sensíveis: password, token, secret, cpf, cnpj)
- [x] T019 [P] Implementar `packages/core/src/redis.ts` — ioredis client (connection string de config, reconnect strategy)
- [x] T020 Implementar `packages/core/src/index.ts` — exportar db, logger, redis, config
- [x] T021 Implementar `packages/db/src/schemas/atlas.ts` — Drizzle schema pra `atlas.users` e `atlas.sessions` conforme data-model.md (todos os campos, tipos, constraints, indexes)
- [x] T022 [P] Implementar `packages/db/src/schemas/shared.ts` — Drizzle schema pra `shared.audit_log` conforme data-model.md (BIGSERIAL PK, campos, indexes)
- [x] T023 Implementar `packages/db/src/index.ts` — exportar schemas e tipos inferidos
- [x] T024 Criar `packages/db/drizzle.config.ts` — config do Drizzle Kit (connection string, schemas, out dir)
- [x] T025 Gerar migration `packages/db/migrations/0001_atlas_infra_base.sql` via `drizzle-kit generate` — incluir CREATE SCHEMA atlas/shared, tabelas, indexes, triggers de updated_at, trigger de audit_log em atlas.users, trigger de imutabilidade em shared.audit_log, REVOKE UPDATE/DELETE em audit_log
- [x] T026 Implementar `packages/auth/src/password.ts` — hash e verify com argon2id
- [x] T027 [P] Implementar `packages/auth/src/session.ts` — criar sessão (INSERT atlas.sessions), destruir sessão (DELETE), validar sessão (SELECT + check expiração 8h inatividade / 24h absoluta), touch sessão (UPDATE last_active_at)
- [x] T028 [P] Implementar `packages/auth/src/csrf.ts` — gerar e validar CSRF token (double-submit cookie pattern)
- [x] T029 Implementar `packages/auth/src/auth.middleware.ts` — middleware Express: requireAuth (valida cookie atlas_session, carrega user, atualiza last_active_at), requireRole(role) (checa user.role)
- [x] T030 Implementar `packages/auth/src/rate-limit.ts` — rate limit de login: Redis-backed, 5 tentativas / 10 min por email+IP, bloqueio 30 min
- [x] T031 Implementar `packages/auth/src/index.ts` — exportar middleware, password, session, csrf, rate-limit
- [x] T032 Implementar `apps/api/src/envelope.ts` — middleware de response envelope `{data, error, meta}` + error format `{code, message, fields?}`
- [x] T033 [P] Implementar `apps/api/src/error-handler.ts` — global error handler Express (gera Trace ID, loga Pino, retorna envelope com Trace ID, sanitiza stack em prod)
- [x] T034 Implementar `apps/api/src/modules.ts` — leitor de feature flags MODULE_*_ENABLED de config, exporta lista de módulos com {id, name, enabled}
- [x] T035 Implementar `apps/api/src/server.ts` — Express setup: CORS, cookie-parser, JSON body, CSRF middleware, envelope, error handler, health route, mount de rotas auth/admin, dynamic module mount (placeholder)

**Checkpoint**: `pnpm --filter @atlas/db migrate` cria as tabelas. `pnpm --filter @atlas/api dev` sobe o servidor. `GET /api/v1/health` retorna `{status: "healthy"}`.

---

## Phase 3: User Story 1 — Desenvolvedor sobe o Atlas pela primeira vez (Priority: P1) MVP

**Goal**: Clonar repo, rodar 1 comando, ver tela de login no navegador.

**Independent Test**: Seguir quickstart.md (5 passos), verificar tela de login aparece, /api/v1/health retorna healthy.

### Implementation for User Story 1

- [x] T036 [US1] Implementar `apps/api/src/health.ts` — GET /api/v1/health: checa Postgres (SELECT 1), Redis (PING), n8n (fetch N8N_HEALTH_URL com timeout 3s). Retorna status por dependência + versão do package.json + lista de módulos habilitados. Retorna 503 se Postgres down.
- [x] T037 [US1] Criar seed de admin no final da migration `0001_atlas_infra_base.sql` — INSERT em atlas.users com SEED_ADMIN_EMAIL/PASSWORD (hash argon2 via script Node), role='diretor', condicionado a tabela vazia
- [x] T038 [US1] Inicializar `apps/web/` como projeto Vite+React+TS: `vite.config.ts` (proxy /api → localhost:3005), `tailwind.config.ts` (importa preset do @atlas/ui), `src/main.tsx`, `src/App.tsx` (React Router com rota `/login`)
- [x] T039 [P] [US1] Criar `packages/ui/src/tokens/colors.ts` — tokens de cor do Atlas: paleta quente areia (#F2EDE4 fundo light, #1a1a2e fundo dark), accent --acxe=#0077cc, --q2p=#1a9944, status --warn=#d97706, --crit=#dc2626, --ndf=#7c3aed. CSS variables com set light e dark.
- [x] T040 [P] [US1] Criar `packages/ui/tailwind.config.ts` — preset Tailwind com cores do Atlas, fontes (DM Sans body, Fraunces headings serif, Inconsolata/IBM Plex Mono dados numéricos), darkMode: 'class', extend com tokens
- [x] T041 [P] [US1] Copiar componentes shadcn base pra `packages/ui/src/components/`: Button, Input, Label, Card, Toast (via CLI shadcn ou manual). Verificar que suportam dark mode via CSS variables.
- [x] T042 [P] [US1] Implementar `packages/ui/src/components/ThemeToggle.tsx` — toggle light/dark/system na topbar. Lê `prefers-color-scheme` como default, salva preferência em localStorage, aplica classe `dark` no `<html>`
- [x] T043 [US1] Implementar `apps/web/src/pages/LoginPage.tsx` — form e-mail + senha, submit via fetch POST /api/v1/auth/login, feedback de erro, loading state
- [x] T044 [US1] Atualizar `apps/api/Dockerfile` — multi-stage build: estágio 1 pnpm install + build TS, estágio 2 node:20-alpine copia dist + node_modules
- [x] T045 [P] [US1] Criar `apps/web/Dockerfile` — multi-stage: estágio 1 pnpm install + vite build, estágio 2 nginx:alpine copia dist + nginx.conf
- [x] T046 [US1] Atualizar `deploy/docker-compose.yml` — adicionar services api e web com build context, mounts pra hot-reload, depends_on postgres+redis
- [x] T047 [US1] Escrever teste Vitest+Supertest `apps/api/src/__tests__/health.test.ts` — GET /api/v1/health retorna 200 com status healthy e lista de módulos

**Checkpoint**: `docker compose up` sobe tudo. Navegador em http://localhost:5173 mostra tela de login. GET localhost:3005/api/v1/health retorna healthy.

---

## Phase 4: User Story 2 — Operador faz login e vê painel com módulos (Priority: P1)

**Goal**: Login funcional, painel com sidebar dos 7 módulos, logout.

**Independent Test**: Login com admin seed, ver sidebar com 7 módulos, clicar em módulo desabilitado mostra placeholder, logout funciona.

### Implementation for User Story 2

- [ ] T048 [US2] Implementar `apps/api/src/routes/auth.routes.ts` — POST /api/v1/auth/login (valida email+senha, cria sessão, set cookie, retorna user data; se 2FA ativo retorna requires2FA+tempToken). POST /api/v1/auth/logout (destroi sessão, limpa cookie). GET /api/v1/auth/me (retorna user autenticado).
- [ ] T049 [US2] Implementar `apps/web/src/stores/auth.store.ts` — Zustand store: user, isAuthenticated, login(), logout(), checkSession()
- [ ] T050 [US2] Implementar `apps/web/src/hooks/useAuth.ts` — hook que usa auth store + TanStack Query pra GET /api/v1/auth/me no mount, redirect pra /login se não autenticado
- [ ] T051 [US2] Implementar `apps/web/src/hooks/useModules.ts` — hook que lê lista de módulos de /api/v1/health, retorna array com {id, name, enabled, icon, path}
- [ ] T052 [US2] Implementar `packages/ui/src/components/Sidebar.tsx` — 7 itens de módulo, visual diferenciado pra habilitado (link ativo, cor) vs desabilitado (cinza, cursor not-allowed), ícone + nome, colapsa em mobile
- [ ] T053 [P] [US2] Implementar `packages/ui/src/components/TopBar.tsx` — nome do usuário, badge do perfil (operador/gestor/diretor), botão logout
- [ ] T054 [P] [US2] Implementar `packages/ui/src/layouts/ShellLayout.tsx` — layout com Sidebar à esquerda + TopBar no topo + área de conteúdo (Outlet do React Router)
- [ ] T055 [US2] Implementar `apps/web/src/pages/DashboardPage.tsx` — usa ShellLayout, conteúdo mostra welcome message ou redireciona pro primeiro módulo ativo
- [ ] T056 [P] [US2] Implementar `apps/web/src/components/ModulePlaceholder.tsx` — página "Módulo em implementação" com ícone e nome do módulo
- [ ] T057 [US2] Atualizar `apps/web/src/App.tsx` — adicionar rotas protegidas: / (DashboardPage), /hedge, /stockbridge, /breakingpoint, /clevel, /comexinsight, /comexflow, /forecast (todas ModulePlaceholder), /login (LoginPage). Guard de autenticação.
- [ ] T058 [US2] Escrever teste Vitest+Supertest `apps/api/src/__tests__/auth.test.ts` — login com credenciais corretas retorna 200 + cookie, login com credenciais erradas retorna 401, GET /me sem cookie retorna 401, logout limpa sessão

**Checkpoint**: Login com admin seed funciona. Sidebar mostra 7 módulos (todos desabilitados). Clicar mostra placeholder. Logout redireciona pra login.

---

## Phase 5: User Story 3 — Gestor faz login com 2FA (Priority: P2)

**Goal**: Login com TOTP pra gestor/diretor, setup obrigatório no primeiro acesso.

**Independent Test**: Promover admin pra gestor que não tem 2FA → primeiro login pede setup → configura TOTP → próximo login pede código.

### Implementation for User Story 3

- [ ] T059 [US3] Implementar `packages/auth/src/totp.service.ts` — generateSecret(), generateQRCodeDataUrl(secret, email), verifyCode(secret, code). Usa otplib TOTP + qrcode.
- [ ] T060 [US3] Adicionar rotas em `apps/api/src/routes/auth.routes.ts` — POST /api/v1/auth/verify-2fa (valida tempToken+code, cria sessão real), POST /api/v1/auth/setup-2fa (gera secret+QR, salva totp_secret encriptado), POST /api/v1/auth/confirm-2fa (verifica código, seta totp_enabled=true)
- [ ] T061 [US3] Implementar `apps/web/src/pages/TwoFactorPage.tsx` — form de 6 dígitos, submit verifica 2FA, redirect pra dashboard
- [ ] T062 [P] [US3] Implementar `apps/web/src/pages/TwoFactorSetupPage.tsx` — mostra QR code, campo pra digitar código de confirmação, instrução passo-a-passo
- [ ] T063 [US3] Atualizar `apps/web/src/App.tsx` — rota /2fa (TwoFactorPage), rota /2fa/setup (TwoFactorSetupPage), lógica de redirect: se login retorna requires2FA→/2fa, se user é gestor/diretor sem totp_enabled→/2fa/setup
- [ ] T064 [US3] Escrever teste `apps/api/src/__tests__/totp.test.ts` — setup gera secret, confirm com código correto ativa, login subsequente pede 2FA, código errado 3x bloqueia

**Checkpoint**: Admin (diretor) sem 2FA configurado → primeiro login redireciona pra /2fa/setup. Após scan QR e confirmação de código, próximo login pede código TOTP.

---

## Phase 6: User Story 4 — Administrador gerencia usuários (Priority: P2)

**Goal**: CRUD de usuários com perfis, auditoria de todas as ações.

**Independent Test**: Criar usuário via admin, fazer login com ele, mudar perfil, desativar, verificar audit log.

### Implementation for User Story 4

- [ ] T065 [US4] Implementar `packages/auth/src/auth.service.ts` — createUser(name, email, role), updateUser(id, fields), deactivateUser(id), reactivateUser(id), resetPassword(id), listUsers(). Todas as mutações gravam user_id no contexto da sessão pra trigger de audit log.
- [ ] T066 [US4] Implementar `apps/api/src/routes/admin.routes.ts` — GET /api/v1/admin/users, POST /api/v1/admin/users, PATCH /api/v1/admin/users/:id, PATCH .../deactivate, .../reactivate, POST .../reset-password. Todas protegidas por requireRole('diretor'). GET /api/v1/admin/audit-log com filtros query.
- [ ] T067 [US4] Implementar `apps/web/src/pages/AdminUsersPage.tsx` — tabela de usuários (nome, email, perfil, status, último acesso), botões criar/editar/desativar, modal de criação (nome, email, role), modal de confirmação (desativar/reativar)
- [ ] T068 [P] [US4] Implementar componente `packages/ui/src/components/DataTable.tsx` — tabela genérica reutilizável com sorting, paginação, ações por linha (usado aqui e em módulos futuros)
- [ ] T069 [P] [US4] Implementar componente `packages/ui/src/components/Modal.tsx` — modal genérico (confirm, form) com overlay, ESC pra fechar, focus trap
- [ ] T070 [US4] Escrever teste `apps/api/src/__tests__/admin.test.ts` — criar user retorna 201, listar retorna array, deactivate encerra sessões, operador tentando criar user retorna 403, toda ação gera registro em shared.audit_log
- [ ] T071 [US4] Escrever teste `apps/api/src/__tests__/audit.test.ts` — criar user → SELECT shared.audit_log WHERE table_name='users' retorna 1 row com operation='INSERT' e new_values contendo name+email+role

**Checkpoint**: Diretor cria operador. Operador faz login. Diretor promove a gestor → próximo login pede 2FA. Diretor desativa → login bloqueado. Audit log mostra todas as ações.

---

## Phase 7: User Story 5 — Deploy em produção via CI/CD (Priority: P3)

**Goal**: Merge em main → pipeline → imagens → Swarm atualiza → Atlas acessível no domínio.

**Independent Test**: Push em main, verificar GHA verde, acessar domínio de prod, ver tela de login.

### Implementation for User Story 5

- [ ] T072 [US5] Criar `.github/workflows/ci.yml` — trigger on push main + PR. Steps: checkout, setup pnpm, install, lint (turbo), typecheck (turbo), test (turbo), build Docker images (api + web), push Docker Hub, trigger Portainer webhook (se em main)
- [ ] T073 [US5] Criar `deploy/atlas.stack.yml` — Docker Swarm stack: service atlas_api (imagem Docker Hub, port 3005, healthcheck, labels Traefik /api/*), service atlas_web (imagem Docker Hub, port 80, labels Traefik /), networks, secrets refs
- [ ] T074 [P] [US5] Criar `apps/web/nginx.conf` — config nginx pra SPA: try_files $uri /index.html, gzip, cache headers pra assets, proxy /api pra upstream (não necessário se Traefik faz o routing externo)
- [ ] T075 [US5] Documentar procedimento de rollback no `quickstart.md` — `docker service update --rollback atlas_api` + `docker service update --rollback atlas_web`. Nota: SC-006 exige <1min; rollback nativo do Swarm é instantâneo (reverte pra task anterior). Teste automatizado de timing não incluído — validar manualmente no primeiro deploy real.

**Checkpoint**: Push em main dispara GHA. Pipeline verde. `docker stack deploy -c deploy/atlas.stack.yml atlas` no Swarm. Domínio mostra login com HTTPS.

---

## Phase 8: User Story 6 — Staging no mesmo Swarm (Priority: P3)

**Goal**: Stack staging paralela isolada no mesmo Swarm.

**Independent Test**: Deploy staging, acessar staging.dominio, criar user no staging, verificar que não aparece em prod.

### Implementation for User Story 6

- [ ] T076 [US6] Criar `deploy/atlas-staging.stack.yml` — mesma estrutura que atlas.stack.yml mas com prefixo atlas-staging-*, variáveis de ambiente apontando pra banco staging (database atlas_staging), labels Traefik com Host staging.dominio.com
- [ ] T077 [US6] Documentar em `quickstart.md` o processo de deploy staging: build com tag :staging, push, `docker stack deploy -c deploy/atlas-staging.stack.yml atlas-staging`

**Checkpoint**: `docker stack deploy` do staging. Acessar staging.dominio.com mostra login. Criar user no staging não aparece em prod.

---

## Phase 9: User Story 7 — Habilitação incremental de módulos (Priority: P2)

**Goal**: Feature flags controlam quais módulos estão ativos, sem rebuild.

**Independent Test**: Mudar MODULE_HEDGE_ENABLED=true no .env, redeploy, ver Hedge ativo na sidebar.

### Implementation for User Story 7

- [ ] T078 [US7] Atualizar `apps/api/src/modules.ts` — ler MODULE_HEDGE_ENABLED, MODULE_STOCKBRIDGE_ENABLED, etc. do config. Exportar função registerModuleRoutes(app) que monta rotas somente dos módulos habilitados. Endpoint /api/v1/health já retorna lista de módulos.
- [ ] T079 [US7] Atualizar `apps/web/src/hooks/useModules.ts` — consumir lista de módulos de /api/v1/health, passar pra Sidebar. Módulos desabilitados no backend não mostram link no front.
- [ ] T080 [US7] Atualizar `apps/web/src/App.tsx` — rotas de módulo são geradas dinamicamente a partir da lista de módulos habilitados. Acesso direto a URL de módulo desabilitado → redirect pra dashboard com toast "módulo não disponível"
- [ ] T081 [US7] Escrever teste `apps/api/src/__tests__/modules.test.ts` — com MODULE_HEDGE_ENABLED=true, GET /api/v1/health retorna hedge.enabled=true. Com MODULE_HEDGE_ENABLED=false, retorna false. Rota /api/v1/hedge/* retorna 404 quando desabilitado.

**Checkpoint**: Todos os módulos desabilitados → sidebar mostra 7 itens cinza. Habilitar Hedge → sidebar mostra Hedge ativo (ainda é placeholder, mas o mecanismo funciona).

---

## Phase 10: User Story 8 — Usuário reseta senha esquecida (Priority: P2)

**Goal**: Usuário que esqueceu a senha recebe link de reset via Sendgrid.

**Independent Test**: Clicar "esqueci minha senha", receber e-mail (verificar via Sendgrid sandbox ou log), usar link, definir nova senha, fazer login.

### Implementation for User Story Transversal

- [ ] T082 [P] Implementar `packages/core/src/email.ts` — wrapper Sendgrid (@sendgrid/mail) com template de e-mail, fallback log em dev (não envia e-mail real, loga o link no console)
- [ ] T083 Adicionar rota em `apps/api/src/routes/auth.routes.ts` — POST /api/v1/auth/forgot-password (gera token hash, salva em user, envia email via @atlas/core email). POST /api/v1/auth/reset-password (valida token + expiração, atualiza password_hash, limpa token)
- [ ] T084 Implementar `apps/web/src/pages/ForgotPasswordPage.tsx` — form com campo e-mail, submit, mensagem genérica "se o e-mail existir, link será enviado"
- [ ] T085 [P] Implementar `apps/web/src/pages/ResetPasswordPage.tsx` — form nova senha + confirmação, valida token da URL, submit reseta
- [ ] T086 Atualizar `apps/web/src/App.tsx` — adicionar rotas /forgot-password e /reset-password/:token

**Checkpoint**: Fluxo forgot → email (em dev: link no console) → reset → login com nova senha funciona.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Qualidade, segurança, documentação.

> **Nota**: SC-001 a SC-004 e SC-008 (metas de tempo: dev <10min, deploy <10min, login <2s, dashboard <1s, staging <5min) são validados manualmente no primeiro deploy real. Testes de performance automatizados são escopo de uma spec futura quando volume justificar.

- [ ] T087 [P] Criar `packages/ui/src/components/Badge.tsx` — badge de status (ativo/inativo) e perfil (operador/gestor/diretor) com cores semânticas
- [ ] T088 [P] Criar `packages/ui/src/components/LoadingSpinner.tsx` — spinner/skeleton pra loading states
- [ ] T089 [P] Implementar `apps/web/src/pages/NotFoundPage.tsx` — 404 amigável com link pra dashboard
- [ ] T090 Implementar `apps/web/src/components/ErrorBoundary.tsx` — catch de erros React, mostra "algo deu errado" + Trace ID
- [ ] T091 Validar WCAG AA básico: contraste de cores nos tokens, labels ARIA em todos os inputs, focus visible em botões, navegação por teclado na sidebar + modais
- [ ] T092 Rodar `pnpm lint` e `pnpm typecheck` — corrigir quaisquer erros
- [ ] T093 Rodar `pnpm test` — garantir todos os testes passam
- [ ] T094 Atualizar `README.md` com instruções finais de quickstart, link pros specs, e badges de status
- [ ] T095 Verificar que `.env.example` está completo e `deploy/docker-compose.yml` sobe sem erro numa máquina limpa
- [ ] T096 Build de produção: `docker build` dos Dockerfiles api e web completa sem erro

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` verde. Docker build das duas imagens sucede. README atualizado.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — começa imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 completa — BLOQUEIA todas as user stories
- **US1 (Phase 3)**: Depende de Phase 2 — ambiente dev funcional + tela de login
- **US2 (Phase 4)**: Depende de US1 — login funcional necessário pra ver painel
- **US3 (Phase 5)**: Depende de US2 — fluxo de login base precisa existir
- **US4 (Phase 6)**: Depende de US2 — CRUD de usuários precisa de auth + shell
- **US5 (Phase 7)**: Depende de US1 — precisa ter algo pra deployar
- **US6 (Phase 8)**: Depende de US5 — staging é derivado do deploy prod
- **US7 (Phase 9)**: Depende de US2 — sidebar precisa existir pra mostrar módulos
- **Reset senha (Phase 10)**: Depende de US2 — auth precisa existir
- **Polish (Phase 11)**: Depende de todas as user stories desejadas

### User Story Dependencies

- **US1 (P1)**: Foundational → pode começar imediatamente após Phase 2
- **US2 (P1)**: US1 → login funcional necessário
- **US3 (P2)**: US2 → fluxo auth base necessário
- **US4 (P2)**: US2 → shell e auth necessários. **Pode ser paralelo com US3.**
- **US5 (P3)**: US1 → algo pra deployar. **Pode ser paralelo com US2-US4.**
- **US6 (P3)**: US5 → stack prod precisa existir
- **US7 (P2)**: US2 → sidebar precisa existir. **Pode ser paralelo com US3-US4.**
- **Reset senha**: US2 → auth base necessário. **Pode ser paralelo com US3-US4.**

### Parallel Opportunities

```
After Phase 2 (Foundational):
  → US1 (dev environment + login page)

After US1:
  → US2 (login + sidebar)

After US2:
  → US3 (2FA)          ┐
  → US4 (admin users)   ├── Parallelizable
  → US7 (feature flags) ├── (different files, no deps)
  → Reset senha         ┘
  → US5 (CI/CD)         ← Also parallel (infra files only)

After US5:
  → US6 (staging)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 — dev environment + login page
4. Complete Phase 4: US2 — login funcional + sidebar
5. **STOP and VALIDATE**: Login funciona, sidebar mostra 7 módulos, health check OK
6. Deploy manual pra validar Dockerfiles funcionam

### Incremental Delivery

1. Setup + Foundational → Base pronta
2. US1 → dev environment funcional (MVP mínimo!)
3. US2 → login + navegação (MVP usável!)
4. US3 + US4 + US7 + Reset → em paralelo, incremental
5. US5 → CI/CD automatizado (deploy)
6. US6 → staging
7. Polish → qualidade final

---

## Notes

- Tasks [P] = arquivos diferentes, sem dependências entre si
- [USn] label mapeia task à user story pra rastreabilidade
- Cada user story é independentemente completável e testável (exceto dependências de cadeia US1→US2)
- Verificar testes falham antes de implementar (quando marcados pra TDD)
- Commit após cada task ou grupo lógico
- Parar em qualquer checkpoint pra validar independentemente
- Evitar: tasks vagas, conflito de arquivo, dependências cross-story que quebrem independência
