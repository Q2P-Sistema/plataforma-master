import { getPool, createLogger } from '@atlas/core';

const logger = createLogger('stockbridge:meu-estoque');

export type EmpresaFiltro = 'ACXE' | 'Q2P' | 'Ambos';

export interface MeuEstoqueItem {
  empresa: 'ACXE' | 'Q2P';
  codigoEstoque: string;
  descricaoEstoque: string;
  /** Codigo OMIE da empresa em questao (text — pode ser 'PP-016'). */
  codigoProduto: string;
  /** Codigo numerico ACXE (canonico no Atlas, usado pra config_produto, saidas, etc).
   *  Resolvido via JOIN public.tbl_produtos_ACXE por descricao. Pode ser null
   *  quando nao ha match — frontend deve esconder/desabilitar acoes nesse caso. */
  codigoProdutoAcxe: number | null;
  descricaoProduto: string;
  descricaoFamilia: string | null;
  ncm: string | null;
  saldoKg: number;
  reservadoKg: number;
  volumeTotalKg: number;
}

export interface MeuEstoqueResponse {
  galpoes: string[];               // galpoes considerados na consulta (vazio = todos)
  principal: MeuEstoqueItem[];     // estoques fisicos do galpao (espelhados→Q2P + Q2P-only nacionais)
  especiais: MeuEstoqueItem[];     // VARREDURA, FALTANDO, TRANSITO, TROCA — visiveis mas separados
}

// Estoques especiais (visiveis na secao separada, nao somam ao principal)
const ESPECIAIS = [
  { codigo: '90.0.2', empresa: null,    label: 'TRÂNSITO'  }, // ambos (mas 0024 ja popula via FUP)
  { codigo: '90.0.1', empresa: 'Q2P',   label: 'TROCA'     },
  { codigo: '10.0.3', empresa: 'ACXE',  label: 'VARREDURA' },
  { codigo: '20.0.4', empresa: 'ACXE',  label: 'FALTANDO'  },
] as const;

/**
 * Lista estoque fisico do(s) galpao(es) do usuario, agrupado em principal +
 * especiais. Le direto da view OMIE vw_posicaoEstoqueUnificadaFamilia (fonte
 * de verdade do estoque), nao dos lotes do StockBridge.
 *
 * Regras de empresa:
 *  - Estoques espelhados (sufixo .1 — importado): conta SO Q2P pra evitar 2x
 *  - Estoques Q2P-only (sufixo .2 — nacional): conta Q2P
 *  - Estoques operacionais ACXE-only (20.0.x: PROCESSO/CONSUMO/PRODUCAO):
 *    excluidos (nao sao "galpao fisico")
 *  - Especiais (VARREDURA/FALTANDO/TRANSITO/TROCA): retornados separados
 *
 * Filtro de empresa do caller:
 *  - 'Q2P' (padrao): so Q2P (espelhados-Q2P + Q2P nacionais)
 *  - 'ACXE': so ACXE — mostra a "visao fiscal ACXE" do espelhado
 *  - 'Ambos': mostra Q2P + ACXE-espelhados (atencao: pode duplicar pra mesmo
 *    SKU — UI deve marcar empresa por linha)
 */
export async function listarMeuEstoque(
  galpoes: string[],
  empresa: EmpresaFiltro = 'Q2P',
): Promise<MeuEstoqueResponse> {
  const pool = getPool();

  // Filtro de galpao (gestor/diretor sem galpoes ve tudo)
  const filtroGalpao = galpoes.length > 0
    ? `AND (${galpoes.map((_, i) => `codigo_estoque LIKE $${i + 1} || '.%'`).join(' OR ')})`
    : '';

  const empresaFilter =
    empresa === 'Q2P' ? `AND empresa = 'Q2P'`
    : empresa === 'ACXE' ? `AND empresa = 'ACXE'`
    : '';

  // ── Principal: estoque fisico do galpao ──────────────────────────────
  // Sufixos:
  //   .1 = importado (espelhado ACXE↔Q2P) — conta SO Q2P pra evitar 2x
  //        (a nao ser que filtro explicito empresa=ACXE)
  //   .2 = nacional (Q2P-only) — conta sempre Q2P
  const condicaoPrincipal = empresa === 'ACXE'
    ? `(codigo_estoque LIKE '%.1' AND empresa = 'ACXE')`
    : `(
        (codigo_estoque LIKE '%.1' AND empresa = 'Q2P')
        OR
        (codigo_estoque LIKE '%.2' AND empresa = 'Q2P')
      )`;

  const sqlPrincipal = `
    SELECT
      v.empresa,
      v.codigo_estoque,
      v.descricao_estoque,
      v.codigo_produto,
      pa.codigo_produto AS codigo_produto_acxe,
      v.descricao_produto,
      v.descricao_familia,
      v.ncm,
      COALESCE(v.saldo, 0)         AS saldo_kg,
      COALESCE(v.reservado, 0)     AS reservado_kg,
      COALESCE(v.volume_total, 0)  AS volume_total_kg
    FROM public."vw_posicaoEstoqueUnificadaFamilia" v
    LEFT JOIN public."tbl_produtos_ACXE" pa ON pa.descricao = v.descricao_produto
    WHERE v.saldo > 0
      ${filtroGalpao.replace(/codigo_estoque/g, 'v.codigo_estoque')}
      AND ${condicaoPrincipal.replace(/codigo_estoque/g, 'v.codigo_estoque').replace(/empresa/g, 'v.empresa')}
    ORDER BY v.descricao_produto, v.codigo_estoque
  `;

  const paramsPrincipal = galpoes;

  // ── Especiais: VARREDURA, FALTANDO, TRANSITO, TROCA ────────────────────
  // Sem filtro de galpao (sao globais por empresa). Filtro de empresa aplica.
  const sqlEspeciais = `
    SELECT
      v.empresa,
      v.codigo_estoque,
      v.descricao_estoque,
      v.codigo_produto,
      pa.codigo_produto AS codigo_produto_acxe,
      v.descricao_produto,
      v.descricao_familia,
      v.ncm,
      COALESCE(v.saldo, 0)         AS saldo_kg,
      COALESCE(v.reservado, 0)     AS reservado_kg,
      COALESCE(v.volume_total, 0)  AS volume_total_kg
    FROM public."vw_posicaoEstoqueUnificadaFamilia" v
    LEFT JOIN public."tbl_produtos_ACXE" pa ON pa.descricao = v.descricao_produto
    WHERE v.saldo > 0
      ${empresaFilter.replace(/empresa/g, 'v.empresa')}
      AND (
        ${ESPECIAIS.map(e =>
          e.empresa
            ? `(v.codigo_estoque = '${e.codigo}' AND v.empresa = '${e.empresa}')`
            : `v.codigo_estoque = '${e.codigo}'`,
        ).join(' OR ')}
      )
    ORDER BY v.descricao_estoque, v.descricao_produto
  `;

  const [resPrincipal, resEspeciais] = await Promise.all([
    pool.query(sqlPrincipal, paramsPrincipal).catch((err) => {
      logger.warn({ err: err.message }, 'Query meu-estoque principal falhou');
      return { rows: [] };
    }),
    pool.query(sqlEspeciais).catch((err) => {
      logger.warn({ err: err.message }, 'Query meu-estoque especiais falhou');
      return { rows: [] };
    }),
  ]);

  return {
    galpoes,
    principal: (resPrincipal.rows as Array<Record<string, unknown>>).map(toItem),
    especiais: (resEspeciais.rows as Array<Record<string, unknown>>).map(toItem),
  };
}

function toItem(r: Record<string, unknown>): MeuEstoqueItem {
  return {
    empresa: r.empresa as 'ACXE' | 'Q2P',
    codigoEstoque: String(r.codigo_estoque),
    descricaoEstoque: String(r.descricao_estoque ?? ''),
    codigoProduto: String(r.codigo_produto ?? ''),
    codigoProdutoAcxe: r.codigo_produto_acxe != null ? Number(r.codigo_produto_acxe) : null,
    descricaoProduto: String(r.descricao_produto ?? ''),
    descricaoFamilia: (r.descricao_familia as string | null) ?? null,
    ncm: (r.ncm as string | null) ?? null,
    saldoKg: Number(r.saldo_kg),
    reservadoKg: Number(r.reservado_kg),
    volumeTotalKg: Number(r.volume_total_kg),
  };
}

/**
 * Busca os galpoes vinculados a um usuario via stockbridge.user_galpao.
 * Retorna lista vazia se o usuario nao tem nenhum (gestor/diretor sem vinculo
 * ve tudo no service).
 */
export async function getGalpoesDoUsuario(userId: string): Promise<string[]> {
  const pool = getPool();
  const res = await pool
    .query<{ galpao: string }>(
      'SELECT galpao FROM stockbridge.user_galpao WHERE user_id = $1 ORDER BY galpao',
      [userId],
    )
    .catch(() => ({ rows: [] }));
  return res.rows.map((r) => r.galpao);
}
