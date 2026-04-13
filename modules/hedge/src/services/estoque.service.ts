import { getPool, createLogger } from '@atlas/core';

const logger = createLogger('hedge:estoque');

interface EstoqueFiltros {
  empresa?: 'acxe' | 'q2p';
}

interface EstoqueAgregado {
  localidade: string;
  empresa: string;
  origem: string;
  itens: number;
  valor_brl: number;
  custo_usd_estimado: number;
  ptax_ref: number;
}

export async function getEstoque(filtros: EstoqueFiltros = {}): Promise<EstoqueAgregado[]> {
  const pool = getPool();

  let query = `
    SELECT
      empresa,
      local_descricao AS localidade,
      origem,
      COUNT(*)::int AS itens,
      SUM(valor_total_brl)::numeric AS valor_brl,
      SUM(valor_total_usd)::numeric AS custo_usd_estimado,
      MAX(ptax_ref)::numeric AS ptax_ref
    FROM public.vw_hedge_estoque
  `;

  const params: string[] = [];
  if (filtros.empresa) {
    params.push(filtros.empresa);
    query += ` WHERE empresa = $1`;
  }

  query += ` GROUP BY empresa, local_descricao, origem ORDER BY empresa, valor_brl DESC`;

  const { rows } = await pool.query(query, params);

  logger.debug({ count: rows.length, empresa: filtros.empresa }, 'Estoque loaded from vw_hedge_estoque');

  return rows.map((r: any) => ({
    localidade: r.localidade,
    empresa: r.empresa,
    origem: r.origem,
    itens: r.itens,
    valor_brl: Number(r.valor_brl),
    custo_usd_estimado: Number(r.custo_usd_estimado),
    ptax_ref: Number(r.ptax_ref),
  }));
}
