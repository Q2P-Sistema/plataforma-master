import {
  pgSchema,
  uuid,
  varchar,
  boolean,
  timestamp,
  numeric,
  bigint,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const breakingpointSchema = pgSchema('breakingpoint');

// ── BP Params (global por empresa) ─────────────────────────
export const bpParams = breakingpointSchema.table(
  'bp_params',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    empresa: varchar('empresa', { length: 10 })
      .notNull()
      .$type<'acxe' | 'q2p'>(),
    dupAntecipUsado: numeric('dup_antecip_usado', { precision: 15, scale: 2 }).notNull().default('0'),
    markupEstoque: numeric('markup_estoque', { precision: 5, scale: 4 }).notNull().default('0.22'),
    alertaGapLimiar: numeric('alerta_gap_limiar', { precision: 15, scale: 2 }).notNull().default('300000'),
    catFinimpCod: varchar('cat_finimp_cod', { length: 50 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
  },
  (table) => [uniqueIndex('bp_params_empresa_idx').on(table.empresa)],
);

// ── BP Banco Limites (por banco por empresa) ───────────────
export const bpBancoLimites = breakingpointSchema.table(
  'bp_banco_limites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    empresa: varchar('empresa', { length: 10 })
      .notNull()
      .$type<'acxe' | 'q2p'>(),
    bancoId: varchar('banco_id', { length: 50 }).notNull(),
    bancoNome: varchar('banco_nome', { length: 100 }).notNull(),
    corHex: varchar('cor_hex', { length: 7 }).notNull().default('#666666'),
    antecipLimite: numeric('antecip_limite', { precision: 15, scale: 2 }).notNull().default('0'),
    antecipUsado: numeric('antecip_usado', { precision: 15, scale: 2 }).notNull().default('0'),
    antecipTaxa: numeric('antecip_taxa', { precision: 5, scale: 4 }).notNull().default('0.85'),
    finimpLimite: numeric('finimp_limite', { precision: 15, scale: 2 }).notNull().default('0'),
    finimpUsado: numeric('finimp_usado', { precision: 15, scale: 2 }).notNull().default('0'),
    finimpGarantiaPct: numeric('finimp_garantia_pct', { precision: 5, scale: 4 }).notNull().default('0.40'),
    chequeLimite: numeric('cheque_limite', { precision: 15, scale: 2 }).notNull().default('0'),
    chequeUsado: numeric('cheque_usado', { precision: 15, scale: 2 }).notNull().default('0'),
    ativo: boolean('ativo').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
  },
  (table) => [
    uniqueIndex('bp_banco_empresa_idx').on(table.empresa, table.bancoId),
    index('bp_banco_ativo_idx').on(table.empresa, table.ativo),
  ],
);

// ── BP Contas Config (toggle por conta corrente) ───────────
export const bpContasConfig = breakingpointSchema.table(
  'bp_contas_config',
  {
    nCodCc: bigint('n_cod_cc', { mode: 'number' }).notNull(),
    empresa: varchar('empresa', { length: 10 })
      .notNull()
      .$type<'acxe' | 'q2p'>(),
    incluir: boolean('incluir').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.nCodCc, table.empresa] })],
);

export type BpParams = typeof bpParams.$inferSelect;
export type NewBpParams = typeof bpParams.$inferInsert;
export type BpBancoLimite = typeof bpBancoLimites.$inferSelect;
export type NewBpBancoLimite = typeof bpBancoLimites.$inferInsert;
export type BpContaConfig = typeof bpContasConfig.$inferSelect;
export type NewBpContaConfig = typeof bpContasConfig.$inferInsert;
