import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/auth.store.js';

interface ConfigProduto {
  produtoCodigoAcxe: number;
  nomeProduto: string;
  familiaOmie: string | null;
  familiaAtlas: string | null;
  consumoMedioDiarioKg: number | null;
  leadTimeDias: number | null;
  incluirEmMetricas: boolean;
}

function useApiFetch() {
  const csrfToken = useAuthStore((s) => s.csrfToken);
  return async (url: string, opts: RequestInit = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    const res = await fetch(url, { credentials: 'include', ...opts, headers });
    const body = (await res.json()) as { data: unknown; error: { message?: string } | null };
    if (!res.ok) throw new Error(body.error?.message ?? 'Erro');
    return body;
  };
}

const GRID_COLS = 'grid-cols-[3fr_2fr_1fr_1.3fr_1fr_1fr]';

export function ConfigProdutosPage() {
  const apiFetch = useApiFetch();
  const [busca, setBusca] = useState('');

  const { data = [] } = useQuery<ConfigProduto[]>({
    queryKey: ['sb', 'config-produtos'],
    queryFn: async () => (await apiFetch('/api/v1/stockbridge/config/produtos')).data as ConfigProduto[],
  });

  const filtrado = data.filter((p) =>
    !busca ||
    p.nomeProduto.toLowerCase().includes(busca.toLowerCase()) ||
    String(p.produtoCodigoAcxe).includes(busca) ||
    (p.familiaOmie?.toLowerCase().includes(busca.toLowerCase()) ?? false) ||
    (p.familiaAtlas?.toLowerCase().includes(busca.toLowerCase()) ?? false),
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-serif text-atlas-ink mb-1">Configuração de Produtos</h1>
        <p className="text-sm text-atlas-muted">
          Consumo médio diário (calculado das vendas Q2P+ACXE), lead time e família.
          Dados sincronizados do banco — sem edição manual.
        </p>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, código ou família..."
        className="w-full mb-4 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded text-sm"
      />

      <div
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        <div className={`sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-600 grid ${GRID_COLS} text-xs text-atlas-muted font-semibold px-3 py-2`}>
          <div>SKU</div>
          <div>Família OMIE</div>
          <div>Família Atlas</div>
          <div className="text-right">Consumo (kg/dia)</div>
          <div className="text-right">Lead Time (dias)</div>
          <div className="text-center">Em métricas</div>
        </div>

        <div>
          {filtrado.map((p) => (
            <div
              key={p.produtoCodigoAcxe}
              className={`grid ${GRID_COLS} text-xs border-b border-slate-100 dark:border-slate-700/60 px-3 py-2 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 items-center`}
            >
              <div>
                <div className="font-medium">{p.nomeProduto}</div>
                <div className="text-[10px] font-mono text-atlas-muted">{p.produtoCodigoAcxe}</div>
              </div>
              <div className="text-atlas-muted">{p.familiaOmie ?? '—'}</div>
              <div className="text-atlas-muted">{p.familiaAtlas ?? '—'}</div>
              <div className="text-right">
                {p.consumoMedioDiarioKg != null ? p.consumoMedioDiarioKg.toFixed(2) : '—'}
              </div>
              <div className="text-right">{p.leadTimeDias ?? '—'}</div>
              <div className="text-center">
                <span className={`text-xs px-2 py-0.5 rounded ${p.incluirEmMetricas ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.incluirEmMetricas ? 'sim' : 'não'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
