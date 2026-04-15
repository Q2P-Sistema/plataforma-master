-- Migration: 007 Breaking Point
-- Creates breakingpoint schema with 3 tables, indexes, audit triggers, and ACXE seed

-- ── Schema ─────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS breakingpoint;

-- ── Params (global por empresa) ─────────────────────────────
CREATE TABLE breakingpoint.bp_params (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa VARCHAR(10) NOT NULL CHECK (empresa IN ('acxe', 'q2p')),
    dup_antecip_usado NUMERIC(15,2) NOT NULL DEFAULT 0,
    markup_estoque NUMERIC(5,4) NOT NULL DEFAULT 0.22,
    alerta_gap_limiar NUMERIC(15,2) NOT NULL DEFAULT 300000,
    cat_finimp_cod VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES atlas.users(id)
);
CREATE UNIQUE INDEX bp_params_empresa_idx ON breakingpoint.bp_params (empresa);

-- ── Banco Limites (por banco por empresa) ──────────────────
CREATE TABLE breakingpoint.bp_banco_limites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa VARCHAR(10) NOT NULL CHECK (empresa IN ('acxe', 'q2p')),
    banco_id VARCHAR(50) NOT NULL,
    banco_nome VARCHAR(100) NOT NULL,
    cor_hex VARCHAR(7) NOT NULL DEFAULT '#666666',
    antecip_limite NUMERIC(15,2) NOT NULL DEFAULT 0,
    antecip_usado NUMERIC(15,2) NOT NULL DEFAULT 0,
    antecip_taxa NUMERIC(5,4) NOT NULL DEFAULT 0.85,
    finimp_limite NUMERIC(15,2) NOT NULL DEFAULT 0,
    finimp_usado NUMERIC(15,2) NOT NULL DEFAULT 0,
    finimp_garantia_pct NUMERIC(5,4) NOT NULL DEFAULT 0.40,
    cheque_limite NUMERIC(15,2) NOT NULL DEFAULT 0,
    cheque_usado NUMERIC(15,2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES atlas.users(id)
);
CREATE UNIQUE INDEX bp_banco_empresa_idx ON breakingpoint.bp_banco_limites (empresa, banco_id);
CREATE INDEX bp_banco_ativo_idx ON breakingpoint.bp_banco_limites (empresa, ativo);

-- ── Contas Config (toggle por conta corrente) ──────────────
CREATE TABLE breakingpoint.bp_contas_config (
    n_cod_cc BIGINT NOT NULL,
    empresa VARCHAR(10) NOT NULL CHECK (empresa IN ('acxe', 'q2p')),
    incluir BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (n_cod_cc, empresa)
);

-- ── Auto-update updated_at trigger ─────────────────────────
CREATE OR REPLACE FUNCTION breakingpoint.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bp_params_updated_at
    BEFORE UPDATE ON breakingpoint.bp_params
    FOR EACH ROW EXECUTE FUNCTION breakingpoint.set_updated_at();

CREATE TRIGGER trg_bp_banco_limites_updated_at
    BEFORE UPDATE ON breakingpoint.bp_banco_limites
    FOR EACH ROW EXECUTE FUNCTION breakingpoint.set_updated_at();

CREATE TRIGGER trg_bp_contas_config_updated_at
    BEFORE UPDATE ON breakingpoint.bp_contas_config
    FOR EACH ROW EXECUTE FUNCTION breakingpoint.set_updated_at();

-- ── Audit Log Triggers (Principio IV) ──────────────────────

CREATE OR REPLACE FUNCTION breakingpoint.audit_bp_params()
RETURNS TRIGGER AS $$
DECLARE
    old_vals JSONB := NULL;
    new_vals JSONB := NULL;
BEGIN
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        old_vals := to_jsonb(OLD);
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        new_vals := to_jsonb(NEW);
    END IF;

    INSERT INTO shared.audit_log (schema_name, table_name, operation, record_id, old_values, new_values)
    VALUES ('breakingpoint', 'bp_params', TG_OP, COALESCE(NEW.id, OLD.id)::TEXT, old_vals, new_vals);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_bp_params
    AFTER INSERT OR UPDATE OR DELETE ON breakingpoint.bp_params
    FOR EACH ROW EXECUTE FUNCTION breakingpoint.audit_bp_params();

CREATE OR REPLACE FUNCTION breakingpoint.audit_bp_banco_limites()
RETURNS TRIGGER AS $$
DECLARE
    old_vals JSONB := NULL;
    new_vals JSONB := NULL;
BEGIN
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        old_vals := to_jsonb(OLD);
    END IF;
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        new_vals := to_jsonb(NEW);
    END IF;

    INSERT INTO shared.audit_log (schema_name, table_name, operation, record_id, old_values, new_values)
    VALUES ('breakingpoint', 'bp_banco_limites', TG_OP, COALESCE(NEW.id, OLD.id)::TEXT, old_vals, new_vals);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_bp_banco_limites
    AFTER INSERT OR UPDATE OR DELETE ON breakingpoint.bp_banco_limites
    FOR EACH ROW EXECUTE FUNCTION breakingpoint.audit_bp_banco_limites();

-- ── Seed ACXE ──────────────────────────────────────────────
INSERT INTO breakingpoint.bp_params (empresa, dup_antecip_usado, markup_estoque, alerta_gap_limiar, cat_finimp_cod)
VALUES ('acxe', 0, 0.22, 300000, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO breakingpoint.bp_banco_limites
    (empresa, banco_id, banco_nome, cor_hex, antecip_limite, antecip_taxa, finimp_limite, finimp_garantia_pct, cheque_limite)
VALUES
    ('acxe', 'bradesco',  'Bradesco',  '#CC2929', 0, 0.85, 0, 0.40, 0),
    ('acxe', 'itau',      'Itau',      '#F5A623', 0, 0.83, 0, 0.35, 0),
    ('acxe', 'santander', 'Santander', '#CC0000', 0, 0.82, 0, 0.40, 0),
    ('acxe', 'btg',       'BTG',       '#1A1A2E', 0, 0.86, 0, 0.45, 0),
    ('acxe', 'sicoob',    'Sicoob',    '#00703C', 0, 0.80, 0, 0.40, 0)
ON CONFLICT (empresa, banco_id) DO NOTHING;
