# API Contracts: Atlas Infraestrutura Base

**Feature**: 001-atlas-infra-base
**Base URL**: `/api/v1`
**Auth**: Cookie `atlas_session` (httpOnly, Secure, SameSite=Lax) + header `x-csrf-token`
**Envelope**: Todas as respostas usam `{ data: T | null, error: ErrorObj | null, meta?: {} }`
**Error format**: `{ code: string, message: string, fields?: Record<string, string> }`

## Public Routes (sem autenticação)

### POST /api/v1/auth/login

Autenticação com e-mail e senha. Retorna cookie de sessão ou pede 2FA.

**Request**:
```json
{ "email": "usuario@acxe.com.br", "password": "..." }
```

**Response 200** (login completo, sem 2FA):
```json
{ "data": { "user": { "id", "name", "email", "role" }, "requires2FA": false }, "error": null }
```
Set-Cookie: atlas_session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400

**Response 200** (requer 2FA):
```json
{ "data": { "requires2FA": true, "tempToken": "..." }, "error": null }
```
Sessão não é criada até o 2FA ser verificado. `tempToken` é válido por 5 minutos.

**Response 401** (credenciais inválidas):
```json
{ "data": null, "error": { "code": "INVALID_CREDENTIALS", "message": "E-mail ou senha incorretos" } }
```

**Response 429** (rate limit):
```json
{ "data": null, "error": { "code": "TOO_MANY_ATTEMPTS", "message": "Conta bloqueada por 30 minutos" } }
```

### POST /api/v1/auth/verify-2fa

Verifica código TOTP após login com credenciais.

**Request**:
```json
{ "tempToken": "...", "code": "123456" }
```

**Response 200**: Mesmo formato do login completo + Set-Cookie.
**Response 401**: `{ "code": "INVALID_2FA_CODE", "message": "Código inválido" }`

### POST /api/v1/auth/forgot-password

Solicita link de reset de senha.

**Request**:
```json
{ "email": "usuario@acxe.com.br" }
```

**Response 200** (sempre, mesmo se e-mail não existe — previne enumeração):
```json
{ "data": { "message": "Se o e-mail existir, um link de recuperação será enviado" }, "error": null }
```

### POST /api/v1/auth/reset-password

Reseta senha via token recebido por e-mail.

**Request**:
```json
{ "token": "...", "newPassword": "..." }
```

**Response 200**: `{ "data": { "message": "Senha alterada com sucesso" }, "error": null }`
**Response 400**: `{ "code": "INVALID_TOKEN", "message": "Token inválido ou expirado" }`

### GET /api/v1/health

Health check público (sem auth). Retorna status de cada dependência.

**Response 200**:
```json
{
  "data": {
    "status": "healthy",
    "version": "0.1.0",
    "uptime_seconds": 3600,
    "dependencies": {
      "postgres": { "status": "up", "latency_ms": 2 },
      "redis": { "status": "up", "latency_ms": 1 },
      "n8n": { "status": "up", "latency_ms": 15 }
    },
    "modules": {
      "hedge": { "enabled": true },
      "stockbridge": { "enabled": false },
      "breakingpoint": { "enabled": false },
      "clevel": { "enabled": false },
      "comexinsight": { "enabled": false },
      "comexflow": { "enabled": false },
      "forecast": { "enabled": false }
    }
  },
  "error": null
}
```

**Response 503** (quando alguma dependência crítica está down):
```json
{
  "data": {
    "status": "degraded",
    "dependencies": { "postgres": { "status": "down", "error": "connection refused" }, ... }
  },
  "error": null
}
```

## Protected Routes (requerem autenticação)

### GET /api/v1/auth/me

Retorna dados do usuário autenticado.

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Flavio",
    "email": "flavio@acxe.com.br",
    "role": "diretor",
    "totp_enabled": true,
    "last_login_at": "2026-04-12T10:00:00Z"
  },
  "error": null
}
```

### POST /api/v1/auth/logout

Encerra sessão atual. Remove cookie.

**Response 200**: `{ "data": { "message": "Sessão encerrada" }, "error": null }`
Clear-Cookie: atlas_session

### POST /api/v1/auth/setup-2fa

Gera segredo TOTP e retorna QR code pra configuração. Requer autenticação.

**Response 200**:
```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "otpauth://totp/Atlas:flavio@acxe.com.br?secret=...&issuer=Atlas",
    "qrCodeDataUrl": "data:image/png;base64,..."
  },
  "error": null
}
```

### POST /api/v1/auth/confirm-2fa

Confirma configuração 2FA com código de verificação.

**Request**: `{ "code": "123456" }`
**Response 200**: `{ "data": { "totp_enabled": true }, "error": null }`
**Response 400**: `{ "code": "INVALID_2FA_CODE", "message": "Código inválido. Tente novamente." }`

## Protected Routes — Admin (requerem role `diretor`)

### GET /api/v1/admin/users

Lista todos os usuários.

**Response 200**:
```json
{
  "data": [
    { "id", "name", "email", "role", "status", "totp_enabled", "last_login_at", "created_at" }
  ],
  "error": null,
  "meta": { "total": 12 }
}
```

### POST /api/v1/admin/users

Cria novo usuário.

**Request**:
```json
{ "name": "João Silva", "email": "joao@q2p.com.br", "role": "operador" }
```

**Response 201**:
```json
{
  "data": { "id", "name", "email", "role", "temporaryPassword": "..." },
  "error": null
}
```

### PATCH /api/v1/admin/users/:id

Atualiza dados de um usuário (role, status, name).

**Request** (parcial):
```json
{ "role": "gestor" }
```

**Response 200**: Usuário atualizado.
**Side effect**: Se role mudou pra gestor/diretor e 2FA não está ativo, o próximo login do usuário exigirá configuração.

### PATCH /api/v1/admin/users/:id/deactivate

Desativa conta. Encerra todas as sessões ativas imediatamente.

**Response 200**: `{ "data": { "status": "inactive" }, "error": null }`

### PATCH /api/v1/admin/users/:id/reactivate

Reativa conta.

**Response 200**: `{ "data": { "status": "active" }, "error": null }`

### POST /api/v1/admin/users/:id/reset-password

Admin reseta senha de outro usuário. Gera senha temporária.

**Response 200**: `{ "data": { "temporaryPassword": "..." }, "error": null }`

### GET /api/v1/admin/audit-log

Consulta o audit log (append-only). Filtros opcionais via query string.

**Query params**: `?schema=atlas&table=users&user_id=uuid&from=2026-04-01&to=2026-04-12&limit=50&offset=0`

**Response 200**:
```json
{
  "data": [
    { "id", "ts", "schema_name", "table_name", "operation", "record_id", "user_id", "old_values", "new_values", "ip_address" }
  ],
  "error": null,
  "meta": { "total": 342, "limit": 50, "offset": 0 }
}
```

## Frontend Routes (React Router)

| Path | Componente | Auth | Role |
|------|-----------|------|------|
| `/login` | LoginPage | Não | — |
| `/2fa` | TwoFactorPage | Parcial (tempToken) | — |
| `/2fa/setup` | TwoFactorSetupPage | Sim | gestor/diretor sem 2FA |
| `/` | DashboardPage (redirect pra módulo ativo ou home) | Sim | Todos |
| `/admin/users` | AdminUsersPage | Sim | diretor |
| `/hedge`, `/stockbridge`, ... | ModulePlaceholder ou módulo real | Sim | Todos (se módulo habilitado) |
| `*` | NotFoundPage | — | — |
