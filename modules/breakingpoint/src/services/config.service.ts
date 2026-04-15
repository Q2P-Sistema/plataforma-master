import { eq, and } from 'drizzle-orm';
import { getDb, createLogger } from '@atlas/core';
import {
  bpParams,
  bpBancoLimites,
  bpContasConfig,
  type BpParams,
  type BpBancoLimite,
} from '@atlas/db';

const logger = createLogger('breakingpoint:config');

export type Empresa = 'acxe' | 'q2p';

export interface ParamsDTO {
  empresa: Empresa;
  dup_antecip_usado: number;
  markup_estoque: number;
  alerta_gap_limiar: number;
  cat_finimp_cod: string | null;
  updated_at: string;
}

export interface BancoDTO {
  id: string;
  empresa: Empresa;
  banco_id: string;
  banco_nome: string;
  cor_hex: string;
  antecip_limite: number;
  antecip_usado: number;
  antecip_taxa: number;
  antecip_disp: number;
  finimp_limite: number;
  finimp_usado: number;
  finimp_garantia_pct: number;
  finimp_disp: number;
  cheque_limite: number;
  cheque_usado: number;
  cheque_disp: number;
  ativo: boolean;
  updated_at: string;
}

function toParamsDTO(row: BpParams): ParamsDTO {
  return {
    empresa: row.empresa,
    dup_antecip_usado: Number(row.dupAntecipUsado),
    markup_estoque: Number(row.markupEstoque),
    alerta_gap_limiar: Number(row.alertaGapLimiar),
    cat_finimp_cod: row.catFinimpCod,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toBancoDTO(row: BpBancoLimite): BancoDTO {
  const antecipLimite = Number(row.antecipLimite);
  const antecipUsado = Number(row.antecipUsado);
  const finimpLimite = Number(row.finimpLimite);
  const finimpUsado = Number(row.finimpUsado);
  const chequeLimite = Number(row.chequeLimite);
  const chequeUsado = Number(row.chequeUsado);
  return {
    id: row.id,
    empresa: row.empresa,
    banco_id: row.bancoId,
    banco_nome: row.bancoNome,
    cor_hex: row.corHex,
    antecip_limite: antecipLimite,
    antecip_usado: antecipUsado,
    antecip_taxa: Number(row.antecipTaxa),
    antecip_disp: Math.max(0, antecipLimite - antecipUsado),
    finimp_limite: finimpLimite,
    finimp_usado: finimpUsado,
    finimp_garantia_pct: Number(row.finimpGarantiaPct),
    finimp_disp: Math.max(0, finimpLimite - finimpUsado),
    cheque_limite: chequeLimite,
    cheque_usado: chequeUsado,
    cheque_disp: Math.max(0, chequeLimite - chequeUsado),
    ativo: row.ativo,
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getParams(empresa: Empresa): Promise<ParamsDTO | null> {
  const db = getDb();
  const rows = await db.select().from(bpParams).where(eq(bpParams.empresa, empresa)).limit(1);
  return rows[0] ? toParamsDTO(rows[0]) : null;
}

export async function upsertParams(
  empresa: Empresa,
  data: {
    dup_antecip_usado: number;
    markup_estoque: number;
    alerta_gap_limiar: number;
    cat_finimp_cod: string | null;
  },
): Promise<ParamsDTO> {
  const db = getDb();
  const existing = await db.select().from(bpParams).where(eq(bpParams.empresa, empresa)).limit(1);
  if (existing.length === 0) {
    const [row] = await db
      .insert(bpParams)
      .values({
        empresa,
        dupAntecipUsado: data.dup_antecip_usado.toString(),
        markupEstoque: data.markup_estoque.toString(),
        alertaGapLimiar: data.alerta_gap_limiar.toString(),
        catFinimpCod: data.cat_finimp_cod,
      })
      .returning();
    logger.info({ empresa }, 'Params criados');
    return toParamsDTO(row!);
  }

  const [row] = await db
    .update(bpParams)
    .set({
      dupAntecipUsado: data.dup_antecip_usado.toString(),
      markupEstoque: data.markup_estoque.toString(),
      alertaGapLimiar: data.alerta_gap_limiar.toString(),
      catFinimpCod: data.cat_finimp_cod,
    })
    .where(eq(bpParams.empresa, empresa))
    .returning();
  logger.info({ empresa }, 'Params atualizados');
  return toParamsDTO(row!);
}

export async function listBancos(empresa: Empresa): Promise<BancoDTO[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(bpBancoLimites)
    .where(eq(bpBancoLimites.empresa, empresa))
    .orderBy(bpBancoLimites.bancoNome);
  return rows.map(toBancoDTO);
}

export interface BancoInput {
  empresa: Empresa;
  banco_id: string;
  banco_nome: string;
  cor_hex: string;
  antecip_limite: number;
  antecip_usado: number;
  antecip_taxa: number;
  finimp_limite: number;
  finimp_usado: number;
  finimp_garantia_pct: number;
  cheque_limite: number;
  cheque_usado: number;
  ativo?: boolean;
}

export async function createBanco(input: BancoInput): Promise<BancoDTO> {
  const db = getDb();
  const [row] = await db
    .insert(bpBancoLimites)
    .values({
      empresa: input.empresa,
      bancoId: input.banco_id,
      bancoNome: input.banco_nome,
      corHex: input.cor_hex,
      antecipLimite: input.antecip_limite.toString(),
      antecipUsado: input.antecip_usado.toString(),
      antecipTaxa: input.antecip_taxa.toString(),
      finimpLimite: input.finimp_limite.toString(),
      finimpUsado: input.finimp_usado.toString(),
      finimpGarantiaPct: input.finimp_garantia_pct.toString(),
      chequeLimite: input.cheque_limite.toString(),
      chequeUsado: input.cheque_usado.toString(),
      ativo: input.ativo ?? true,
    })
    .returning();
  logger.info({ empresa: input.empresa, banco: input.banco_id }, 'Banco criado');
  return toBancoDTO(row!);
}

export async function updateBanco(
  id: string,
  input: Omit<BancoInput, 'empresa' | 'banco_id'>,
): Promise<BancoDTO | null> {
  const db = getDb();
  const [row] = await db
    .update(bpBancoLimites)
    .set({
      bancoNome: input.banco_nome,
      corHex: input.cor_hex,
      antecipLimite: input.antecip_limite.toString(),
      antecipUsado: input.antecip_usado.toString(),
      antecipTaxa: input.antecip_taxa.toString(),
      finimpLimite: input.finimp_limite.toString(),
      finimpUsado: input.finimp_usado.toString(),
      finimpGarantiaPct: input.finimp_garantia_pct.toString(),
      chequeLimite: input.cheque_limite.toString(),
      chequeUsado: input.cheque_usado.toString(),
      ativo: input.ativo ?? true,
    })
    .where(eq(bpBancoLimites.id, id))
    .returning();
  if (!row) return null;
  logger.info({ id }, 'Banco atualizado');
  return toBancoDTO(row);
}

export async function deleteBanco(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(bpBancoLimites).where(eq(bpBancoLimites.id, id)).returning();
  logger.info({ id, count: result.length }, 'Banco deletado');
  return result.length > 0;
}

/**
 * Agrega limites dos bancos ativos para passar ao motor.
 * dup_antecip_taxa = média ponderada pelo antecip_limite.
 * finimp_garantia_pct = média ponderada pelo finimp_limite.
 */
export async function getLimitesAgregados(empresa: Empresa): Promise<{
  dup_antecip_limite: number;
  dup_antecip_taxa: number;
  finimp_limite: number;
  finimp_garantia_pct: number;
}> {
  const db = getDb();
  const rows = await db
    .select()
    .from(bpBancoLimites)
    .where(and(eq(bpBancoLimites.empresa, empresa), eq(bpBancoLimites.ativo, true)));

  let antecipLimiteTotal = 0;
  let antecipTaxaWeighted = 0;
  let finimpLimiteTotal = 0;
  let finimpGarantiaWeighted = 0;

  for (const r of rows) {
    const antecipLim = Number(r.antecipLimite);
    const finimpLim = Number(r.finimpLimite);
    antecipLimiteTotal += antecipLim;
    antecipTaxaWeighted += antecipLim * Number(r.antecipTaxa);
    finimpLimiteTotal += finimpLim;
    finimpGarantiaWeighted += finimpLim * Number(r.finimpGarantiaPct);
  }

  return {
    dup_antecip_limite: antecipLimiteTotal,
    dup_antecip_taxa: antecipLimiteTotal > 0 ? antecipTaxaWeighted / antecipLimiteTotal : 0.85,
    finimp_limite: finimpLimiteTotal,
    finimp_garantia_pct: finimpLimiteTotal > 0 ? finimpGarantiaWeighted / finimpLimiteTotal : 0.4,
  };
}

export async function setContaIncluir(
  nCodCc: number,
  empresa: Empresa,
  incluir: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .insert(bpContasConfig)
    .values({ nCodCc, empresa, incluir })
    .onConflictDoUpdate({
      target: [bpContasConfig.nCodCc, bpContasConfig.empresa],
      set: { incluir },
    });
  logger.info({ nCodCc, empresa, incluir }, 'Conta toggle atualizado');
}
