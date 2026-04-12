-- =============================================================================
-- Migration 0001: Atlas Infraestrutura Base
-- Creates: schemas atlas + shared, tables users + sessions + audit_log,
--          triggers for updated_at, audit log, and audit immutability.
-- =============================================================================

-- Schemas
CREATE SCHEMA IF NOT EXISTS atlas;
CREATE SCHEMA IF NOT EXISTS shared;

-- =============================================================================
-- atlas.users
-- =============================================================================
CREATE TABLE atlas.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('operador', 'gestor', 'diretor')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  totp_secret VARCHAR(255),
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_unique ON atlas.users (email) WHERE deleted_at IS NULL;
CREATE INDEX users_role_idx ON atlas.users (role);
CREATE INDEX users_status_idx ON atlas.users (status);

-- =============================================================================
-- atlas.sessions
-- =============================================================================
CREATE TABLE atlas.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
  csrf_token VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_user_id_idx ON atlas.sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON atlas.sessions (expires_at);

-- =============================================================================
-- shared.audit_log (APPEND-ONLY)
-- =============================================================================
CREATE TABLE shared.audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  schema_name VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id VARCHAR(255) NOT NULL,
  user_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET
);

CREATE INDEX audit_log_ts_idx ON shared.audit_log (ts DESC);
CREATE INDEX audit_log_schema_table_ts_idx ON shared.audit_log (schema_name, table_name, ts DESC);
CREATE INDEX audit_log_user_id_ts_idx ON shared.audit_log (user_id, ts DESC);
CREATE INDEX audit_log_record_id_idx ON shared.audit_log (record_id);

-- =============================================================================
-- TRIGGER: auto-update updated_at on atlas.users
-- =============================================================================
CREATE OR REPLACE FUNCTION atlas.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON atlas.users
  FOR EACH ROW
  EXECUTE FUNCTION atlas.set_updated_at();

-- =============================================================================
-- TRIGGER: audit log for atlas.users (INSERT/UPDATE/DELETE)
-- =============================================================================
CREATE OR REPLACE FUNCTION atlas.audit_users()
RETURNS TRIGGER AS $$
DECLARE
  v_record_id TEXT;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::TEXT;
    v_old := to_jsonb(OLD) - 'password_hash' - 'totp_secret' - 'password_reset_token';
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id::TEXT;
    v_old := NULL;
    v_new := to_jsonb(NEW) - 'password_hash' - 'totp_secret' - 'password_reset_token';
  ELSE
    v_record_id := NEW.id::TEXT;
    v_old := to_jsonb(OLD) - 'password_hash' - 'totp_secret' - 'password_reset_token';
    v_new := to_jsonb(NEW) - 'password_hash' - 'totp_secret' - 'password_reset_token';
  END IF;

  INSERT INTO shared.audit_log (schema_name, table_name, operation, record_id, old_values, new_values)
  VALUES ('atlas', 'users', TG_OP, v_record_id, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_audit
  AFTER INSERT OR UPDATE OR DELETE ON atlas.users
  FOR EACH ROW
  EXECUTE FUNCTION atlas.audit_users();

-- =============================================================================
-- TRIGGER: immutability guard on shared.audit_log (defense-in-depth)
-- =============================================================================
CREATE OR REPLACE FUNCTION shared.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'shared.audit_log is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON shared.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION shared.prevent_audit_mutation();

-- =============================================================================
-- SEED: admin inicial (só se tabela vazia)
-- =============================================================================
-- O seed do admin é feito pelo código TS no boot do apps/api,
-- porque precisa de argon2 pra hash da senha.
-- Este placeholder documenta a intenção.
-- Ver: apps/api/src/server.ts → seedAdmin()
