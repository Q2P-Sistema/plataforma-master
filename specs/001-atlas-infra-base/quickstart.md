# Quickstart: Atlas Infraestrutura Base

**Feature**: 001-atlas-infra-base
**Date**: 2026-04-12

## Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 20 LTS (via nvm, `.nvmrc` no repo)
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Git

## Setup Local (5 passos)

### 1. Clonar e instalar dependências

```bash
git clone git@github.com:<org>/plataforma-master.git
cd plataforma-master
pnpm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Editar `.env` com:
- `DATABASE_URL` — Postgres local (o docker-compose sobe um pra você)
- `REDIS_URL` — Redis local (idem)
- `SEED_ADMIN_EMAIL` — e-mail do primeiro admin
- `SEED_ADMIN_PASSWORD` — senha do primeiro admin
- `SESSION_SECRET` — string aleatória pra assinar cookies
- `N8N_HEALTH_URL` — URL do health check do n8n (se estiver rodando; opcional em dev)

### 3. Subir serviços locais

```bash
docker compose up -d
```

Sobe: Postgres 16 (porta 5432), Redis 8 (porta 6379).

### 4. Rodar migrations e seed

```bash
pnpm --filter @atlas/db migrate
```

Cria schemas `atlas` e `shared`, tabelas `users`, `sessions`, `audit_log`, triggers, e faz seed do admin inicial.

### 5. Iniciar em modo desenvolvimento

```bash
pnpm dev
```

Turbo sobe `apps/api` (porta 3005) e `apps/web` (porta 5173) com hot-reload.

## Verificação

1. Abrir `http://localhost:5173` → tela de login
2. Fazer login com `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
3. Ver sidebar com 7 módulos (todos desabilitados por default)
4. Acessar `http://localhost:3005/api/v1/health` → status healthy

## Comandos úteis

| Comando | O que faz |
|---------|-----------|
| `pnpm dev` | Sobe api + web em modo dev com hot-reload |
| `pnpm build` | Build de produção de todos os workspaces |
| `pnpm lint` | Lint (ESLint + boundaries) |
| `pnpm typecheck` | Verificação de tipos TS |
| `pnpm test` | Roda Vitest em todos os workspaces |
| `pnpm --filter @atlas/db migrate` | Aplica migrations pendentes |
| `pnpm --filter @atlas/db generate` | Gera migration a partir de diff no schema Drizzle |
| `docker compose up -d` | Sobe Postgres + Redis locais |
| `docker compose down` | Para serviços locais |

## Deploy em Staging

```bash
# Build e push de imagens
docker build -t <dockerhub-user>/atlas-api:staging -f apps/api/Dockerfile .
docker build -t <dockerhub-user>/atlas-web:staging -f apps/web/Dockerfile .
docker push <dockerhub-user>/atlas-api:staging
docker push <dockerhub-user>/atlas-web:staging

# Deploy no Swarm (via SSH ou Portainer)
docker stack deploy -c deploy/atlas-staging.stack.yml atlas-staging
```

## Deploy em Produção

Automático via GitHub Actions no merge em `main`. Pipeline:
1. Lint + typecheck + test
2. Build imagens Docker
3. Push pra Docker Hub
4. Portainer/Swarm atualiza a stack `atlas`

Rollback: `docker service update --rollback atlas_api` + `docker service update --rollback atlas_web`
