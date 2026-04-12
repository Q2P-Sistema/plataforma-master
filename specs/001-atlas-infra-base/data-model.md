# Data Model: Atlas Infraestrutura Base

**Feature**: 001-atlas-infra-base
**Date**: 2026-04-12

## Schemas

Esta spec cria dois schemas no Postgres:
- **`atlas`** — tabelas de infraestrutura compartilhada (autenticação, usuários, sessões).
- **`shared`** — tabela de auditoria acessível por todos os módulos (append-only).

Módulos de domínio (hedge, stockbridge, etc.) criarão seus próprios schemas em suas respectivas specs.

## Entities

### atlas.users

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| name | VARCHAR(255) | NOT NULL | Nome completo do usuário |
| email | VARCHAR(255) | NOT NULL, UNIQUE | E-mail (usado como login) |
| password_hash | VARCHAR(255) | NOT NULL | Hash argon2id da senha |
| role | VARCHAR(20) | NOT NULL, CHECK IN ('operador','gestor','diretor') | Perfil de acesso |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK IN ('active','inactive') | Estado da conta |
| totp_secret | VARCHAR(255) | NULL | Segredo TOTP (encriptado). NULL = 2FA não configurado |
| totp_enabled | BOOLEAN | NOT NULL, DEFAULT FALSE | 2FA ativo? Obrigatório pra gestor/diretor |
| password_reset_token | VARCHAR(255) | NULL | Token de reset de senha (hash) |
| password_reset_expires | TIMESTAMPTZ | NULL | Expiração do token de reset |
| last_login_at | TIMESTAMPTZ | NULL | Último login bem-sucedido |
| failed_login_attempts | INTEGER | NOT NULL, DEFAULT 0 | Tentativas consecutivas de login falhadas |
| locked_until | TIMESTAMPTZ | NULL | Bloqueio temporário por tentativas excessivas |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Criação |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Última atualização |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

**Indexes**:
- UNIQUE(email) WHERE deleted_at IS NULL
- INDEX(role)
- INDEX(status)

**Triggers**:
- `trg_users_updated_at` — SET updated_at = NOW() on UPDATE
- `trg_users_audit` — INSERT em `shared.audit_log` on INSERT/UPDATE/DELETE

### atlas.sessions

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Identificador da sessão |
| user_id | UUID | NOT NULL, FK → atlas.users(id) ON DELETE CASCADE | Usuário dono |
| csrf_token | VARCHAR(255) | NOT NULL | Token CSRF associado à sessão |
| ip_address | INET | NULL | IP de origem do login |
| user_agent | TEXT | NULL | User-agent do navegador |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Criação (momento do login) |
| expires_at | TIMESTAMPTZ | NOT NULL | Expiração absoluta (24h após criação) |
| last_active_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Último request (pra expiração por inatividade de 8h) |

**Indexes**:
- INDEX(user_id)
- INDEX(expires_at) — pra cleanup de sessões expiradas

**Cleanup**: job periódico (n8n ou cron simples) limpa sessões com `expires_at < NOW()`.

### shared.audit_log

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| id | BIGSERIAL | PK | Auto-increment sequencial (BIGINT pra volume longo prazo) |
| ts | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Momento da operação |
| schema_name | VARCHAR(50) | NOT NULL | Schema afetado (atlas, hedge, stockbridge, etc.) |
| table_name | VARCHAR(100) | NOT NULL | Tabela afetada |
| operation | VARCHAR(10) | NOT NULL, CHECK IN ('INSERT','UPDATE','DELETE') | Tipo de mutação |
| record_id | TEXT | NOT NULL | ID do registro afetado (cast do PK) |
| user_id | UUID | NULL | Quem fez (NULL se operação de sistema/trigger sem contexto de sessão) |
| old_values | JSONB | NULL | Valores antes da mutação (NULL em INSERT) |
| new_values | JSONB | NULL | Valores depois da mutação (NULL em DELETE) |
| ip_address | INET | NULL | IP de origem (quando disponível via session context) |

**Indexes**:
- INDEX(ts DESC)
- INDEX(schema_name, table_name, ts DESC)
- INDEX(user_id, ts DESC)
- INDEX(record_id)

**Constraints de imutabilidade**:
- REVOKE UPDATE, DELETE ON shared.audit_log FROM atlas_app_role
- Trigger `trg_audit_log_immutable` que rejeita UPDATE e DELETE com RAISE EXCEPTION (defense-in-depth, caso o REVOKE seja contornado por role admin)

### Entidades sem tabela dedicada

- **Módulo**: representado por variáveis de ambiente (`MODULE_HEDGE_ENABLED`, `MODULE_STOCKBRIDGE_ENABLED`, etc.) lidas no boot do `apps/api`. Não há tabela de módulos — a lista é fixa em código (7 módulos conhecidos) e o flag liga/desliga. Se no futuro precisar de metadados dinâmicos por módulo (ex: versão, data de ativação), criar tabela `atlas.modules`.
- **Perfil**: representado como CHECK constraint em `atlas.users.role` (`operador`, `gestor`, `diretor`). Não há tabela separada de perfis — a hierarquia é fixa e pequena (3 valores). Permissões granulares futuras (policies) seriam implementadas em código TS, não em tabela de permissões.

## Relationships

```
atlas.users ──1:N──→ atlas.sessions (user_id FK)
atlas.users ──1:N──→ shared.audit_log (user_id, loose FK — sem CASCADE, pra preservar audit mesmo se user for hard-deleted no futuro)
```

## State Transitions

### User Status
```
active ──[admin desativa]──→ inactive ──[admin reativa]──→ active
```
- Transição para `inactive` encerra todas as sessões ativas imediatamente.
- Soft delete (`deleted_at` preenchido) é distinto de `inactive` — `inactive` pode ser reativado, `deleted_at` é "excluído para efeitos de login e listagem".

### Session Lifecycle
```
created ──[request]──→ active (last_active_at atualizado)
active ──[8h inatividade]──→ expired (removida por cleanup)
active ──[24h absoluto]──→ expired (removida por cleanup)
active ──[logout explícito]──→ removed (DELETE imediato)
active ──[admin desativa conta]──→ removed (DELETE imediato de todas as sessões do user)
```

### 2FA Setup (gestor/diretor)
```
not_configured (totp_secret NULL) ──[primeiro login pós-promoção]──→ setup_required
setup_required ──[scan QR + confirma código]──→ configured (totp_enabled=true)
configured ──[admin reseta]──→ not_configured
```

## Seed Data

A migration inclui um seed de 1 usuário diretor inicial pra bootstrap do sistema:
- email: definido via variável de ambiente `SEED_ADMIN_EMAIL`
- senha: definida via `SEED_ADMIN_PASSWORD` (o sistema faz hash com argon2 no boot)
- role: 'diretor'
- totp_enabled: false (configura no primeiro login)

Esse seed só roda se a tabela `atlas.users` estiver vazia (idempotente).
