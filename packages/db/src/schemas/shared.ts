import {
  pgSchema,
  bigserial,
  varchar,
  uuid,
  timestamp,
  jsonb,
  inet,
  index,
} from 'drizzle-orm/pg-core';

export const sharedSchema = pgSchema('shared');

export const auditLog = sharedSchema.table(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    schemaName: varchar('schema_name', { length: 50 }).notNull(),
    tableName: varchar('table_name', { length: 100 }).notNull(),
    operation: varchar('operation', { length: 10 })
      .notNull()
      .$type<'INSERT' | 'UPDATE' | 'DELETE'>(),
    recordId: varchar('record_id', { length: 255 }).notNull(),
    userId: uuid('user_id'),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: inet('ip_address'),
  },
  (table) => [
    index('audit_log_ts_idx').on(table.ts),
    index('audit_log_schema_table_ts_idx').on(
      table.schemaName,
      table.tableName,
      table.ts,
    ),
    index('audit_log_user_id_ts_idx').on(table.userId, table.ts),
    index('audit_log_record_id_idx').on(table.recordId),
  ],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
