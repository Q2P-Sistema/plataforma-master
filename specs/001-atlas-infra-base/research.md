# Research: Atlas Infraestrutura Base

**Feature**: 001-atlas-infra-base
**Date**: 2026-04-12
**Status**: Complete — nenhum NEEDS CLARIFICATION. Todas as decisões técnicas foram tomadas durante o alinhamento arquitetural (constituição + TECH_STACK + ADRs 0001-0007).

## Decisões Técnicas Consolidadas

### 1. Autenticação

**Decision**: Credenciais próprias (e-mail + senha) com argon2id hash, sessão em cookie httpOnly+Secure+SameSite=Lax, CSRF token via double-submit cookie pattern.
**Rationale**: Sistema interno corporativo sem necessidade de SSO/OAuth. argon2id é o padrão OWASP moderno. Cookies httpOnly são mais seguros que JWT em localStorage contra XSS. O sistema PHP legado (StockBridge) usa modelo equivalente.
**Alternatives considered**: SSO corporativo (Google Workspace/M365) — rejeitado porque a empresa não usa; OAuth social — rejeitado por ser desnecessário em B2B interno; JWT em localStorage — rejeitado por vulnerabilidade a XSS.

### 2. Segunda Fator (2FA)

**Decision**: TOTP via `otplib` (Google Authenticator, 1Password). Obrigatório para gestor/diretor, opcional para operador.
**Rationale**: TOTP é offline, sem custo por mensagem, e suportado pelos autenticadores que os gestores já usam. Obrigar apenas perfis com poder de aprovação reduz atrito sem comprometer segurança.
**Alternatives considered**: SMS 2FA (rejeitado por custo e SIM-swap); email 2FA (rejeitado por ser menos seguro que TOTP); WebAuthn/passkeys (considerado pra fase futura, não pra MVP).

### 3. Query Builder e Migrations

**Decision**: Drizzle ORM (modo query builder, não modo ORM cheio) + Drizzle Kit para migrations declarativas.
**Rationale**: Drizzle gera queries próximas do SQL real (transparente), fornece tipos TS derivados do schema (type-safe), e o Kit gera migrations SQL a partir de diffs no schema TS. Evita ORM pesado que esconde plano de execução e abstrai demais em sistema financeiro.
**Alternatives considered**: SQL puro + pg (rejeitado: perde tipos, verboso); Prisma (rejeitado: ORM pesado, geração de query opaca); Knex (rejeitado: menos type-safe que Drizzle, migrations em JS não TS-declarativo).

### 4. Design System

**Decision**: shadcn/ui componentes copiados para `packages/ui/` + Tailwind CSS.
**Rationale**: shadcn não é lib npm instalada — é código copiado pro repo, customizável livremente, sem lock-in de versão. Tailwind dá velocidade de estilização sem CSS espaguete. Combinação é o padrão moderno pra React SPAs.
**Alternatives considered**: Material UI (rejeitado: visual "igual a todo mundo", pesado); Chakra UI (rejeitado: menos flexível); CSS Modules puro (rejeitado: mais lento de prototipar).

### 5. Estado do Frontend

**Decision**: Zustand (client state: user logado, tema, UI state) + TanStack Query (server state: cache de dados do backend, invalidação, refetch).
**Rationale**: Separação clara entre "estado que o app controla" e "dados que vêm do servidor". TanStack Query elimina 80% do boilerplate de fetch/cache. Zustand é leve (2kb) sem ceremônia.
**Alternatives considered**: Redux (rejeitado: boilerplate desproporcional pra escopo); Context API puro (rejeitado: re-render excessivo em scale médio); Jotai (viável, mas Zustand é mais estabelecido).

### 6. Logging

**Decision**: Pino (estruturado JSON) → Loki → Grafana, tudo self-hosted no Swarm.
**Rationale**: Pino é o logger Node mais rápido, com JSON nativo. Loki + Grafana são free e rodam no mesmo Swarm, dando busca e dashboards. Zero custo mensal vs Sentry/Datadog.
**Alternatives considered**: Winston (rejeitado: mais lento, menos ergonômico em JSON mode); Sentry (considerado como adição futura, não mandatório agora); Datadog (rejeitado por custo pra sistema interno).

### 7. Deploy e CI/CD

**Decision**: GitHub Actions → build de imagens Docker → push Docker Hub → Portainer/Swarm atualiza stack.
**Rationale**: Flavio já usa esse pipeline em outros projetos. GitHub Actions free pra repo privado (2000 min/mês). Docker Hub é o registry que ele já tem. Portainer gerencia o Swarm visualmente.
**Alternatives considered**: GitLab CI (rejeitado: repo é no GitHub); GHCR em vez de Docker Hub (viável, mas Flavio já tem Docker Hub); ArgoCD/FluxCD (overkill pra uma VPS Swarm).

### 8. Feature Flags de Módulo

**Decision**: Variáveis de ambiente no `.env` (ex: `MODULE_HEDGE_ENABLED=true`). No boot, `apps/api` lê as flags e registra apenas os módulos habilitados. Frontend recebe lista de módulos habilitados via endpoint `/api/v1/health` ou similar.
**Rationale**: Simplicidade máxima. Sem lib de feature flags (LaunchDarkly, Unleash) — desnecessário pra "ligar/desligar módulo inteiro". Flags mais granulares (canário, percentual) são YAGNI.
**Alternatives considered**: DB-backed flags (rejeitado: overhead desnecessário pra toggle de módulo); LaunchDarkly (rejeitado: custo + complexidade pra caso trivial).

### 9. Ambiente de Staging

**Decision**: Stack yaml separada no mesmo Swarm, prefixada `atlas-staging-*`. Banco de dados staging como database separado no mesmo Postgres server (ou container Postgres dedicado). Traefik roteia `staging.atlas.dominio.com` → stack staging.
**Rationale**: Sem custo de VPS extra. Isolamento via rede Docker e banco separado é suficiente pra validação. Staging não precisa de performance idêntica a prod — precisa de paridade funcional.
**Alternatives considered**: VPS separada (rejeitado por custo); staging só local via docker-compose (rejeitado: não testa Traefik/Swarm behavior).

### 10. Audit Log

**Decision**: Tabela `shared.audit_log` com triggers PL/pgSQL em tabelas de domínio. Trigger intercepta INSERT/UPDATE/DELETE e grava quem, o quê, quando, valores antes/depois. REVOKE UPDATE/DELETE no audit_log para o role da aplicação.
**Rationale**: Princípio IV da Constituição. Trigger é impossível de contornar. Nenhum caminho de código (TS, n8n, psql manual) pode escrever em tabela de domínio sem gerar registro de auditoria.
**Alternatives considered**: Audit via middleware TS (rejeitado: contornável por SQL direto); pgaudit extension (considerado como complemento, não substituição de triggers dedicados).
