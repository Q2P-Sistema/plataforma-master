import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '@atlas/ui';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface EstoqueRow {
  localidade: string;
  empresa: string;
  origem: string;
  itens: number;
  valor_brl: number;
  custo_usd_estimado: number;
  ptax_ref: number;
}

function formatBrl(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatUsd(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

const ORIGEM_LABELS: Record<string, string> = {
  em_transito: 'Em Transito',
  importado_no_chao: 'Importado (deposito)',
  nacional: 'Nacional',
};

const ORIGEM_COLORS: Record<string, string> = {
  em_transito: '#f59e0b',
  importado_no_chao: '#3b82f6',
  nacional: '#10b981',
};

export function InventoryPage() {
  const [empresa, setEmpresa] = useState('');

  const { data: estoque = [], isLoading } = useQuery<EstoqueRow[]>({
    queryKey: ['hedge', 'estoque', empresa],
    queryFn: async () => {
      const params = empresa ? `?empresa=${empresa}` : '';
      const res = await fetch(`/api/v1/hedge/estoque${params}`, { credentials: 'include' });
      const body = (await res.json()) as any;
      return body.data ?? [];
    },
  });

  const totalBrl = estoque.reduce((s, r) => s + r.valor_brl, 0);
  const totalUsd = estoque.reduce((s, r) => s + r.custo_usd_estimado, 0);
  const totalItens = estoque.reduce((s, r) => s + r.itens, 0);

  // Aggregate by origem for pie chart
  const origemMap = new Map<string, number>();
  for (const r of estoque) {
    origemMap.set(r.origem, (origemMap.get(r.origem) ?? 0) + r.valor_brl);
  }
  const pieData = Array.from(origemMap.entries()).map(([origem, value]) => ({
    name: ORIGEM_LABELS[origem] ?? origem,
    value,
    color: ORIGEM_COLORS[origem] ?? '#6b7280',
  }));

  const columns: Column<EstoqueRow>[] = [
    { key: 'localidade', header: 'Localidade', sortable: true },
    { key: 'empresa', header: 'Empresa', sortable: true, render: (r) => r.empresa.toUpperCase() },
    {
      key: 'origem',
      header: 'Origem',
      sortable: true,
      render: (r) => (
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: ORIGEM_COLORS[r.origem] ?? '#6b7280' }}
          />
          {ORIGEM_LABELS[r.origem] ?? r.origem}
        </span>
      ),
    },
    { key: 'itens', header: 'Produtos', sortable: true },
    { key: 'valor_brl', header: 'Valor BRL', sortable: true, render: (r) => formatBrl(r.valor_brl) },
    { key: 'custo_usd_estimado', header: 'Valor USD', sortable: true, render: (r) => formatUsd(r.custo_usd_estimado) },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-atlas-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-atlas-text">Estoque Importado</h1>
        <select
          value={empresa}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setEmpresa(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-atlas-border bg-atlas-bg text-atlas-text text-sm focus:outline-none focus:ring-2 focus:ring-acxe"
        >
          <option value="">Todas</option>
          <option value="acxe">ACXE</option>
          <option value="q2p">Q2P</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-atlas-card border border-atlas-border rounded-xl p-4">
          <p className="text-xs text-atlas-muted uppercase mb-1">Total BRL</p>
          <p className="text-lg font-semibold text-atlas-text">{formatBrl(totalBrl)}</p>
        </div>
        <div className="bg-atlas-card border border-atlas-border rounded-xl p-4">
          <p className="text-xs text-atlas-muted uppercase mb-1">Total USD</p>
          <p className="text-lg font-semibold text-atlas-text">{formatUsd(totalUsd)}</p>
        </div>
        <div className="bg-atlas-card border border-atlas-border rounded-xl p-4">
          <p className="text-xs text-atlas-muted uppercase mb-1">Produtos</p>
          <p className="text-lg font-semibold text-atlas-text">{totalItens}</p>
        </div>
        <div className="bg-atlas-card border border-atlas-border rounded-xl p-4">
          <p className="text-xs text-atlas-muted uppercase mb-1">Por origem</p>
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatBrl(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable columns={columns} data={estoque} rowKey={(r) => `${r.localidade}-${r.empresa}`} />
    </div>
  );
}
