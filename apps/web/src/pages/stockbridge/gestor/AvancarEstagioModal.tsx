import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '@atlas/ui';
import { useAuthStore } from '../../../stores/auth.store.js';

type EstagioTransito = 'transito_intl' | 'porto_dta' | 'transito_interno' | 'reservado';

interface Props {
  lote: {
    id: string;
    codigo: string;
    estagioTransito: EstagioTransito;
    fornecedorNome: string;
    di: string | null;
    dta: string | null;
  };
  onClose: () => void;
  onSucesso: () => void;
}

// Proximos estagios permitidos a partir do atual
const PROXIMO_ESTAGIO: Record<EstagioTransito, EstagioTransito | null> = {
  transito_intl: 'porto_dta',
  porto_dta: 'transito_interno',
  transito_interno: null,
  reservado: null,
};

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

export function AvancarEstagioModal({ lote, onClose, onSucesso }: Props) {
  const apiFetch = useApiFetch();
  const destino = PROXIMO_ESTAGIO[lote.estagioTransito];

  const [di, setDi] = useState(lote.di ?? '');
  const [dta, setDta] = useState(lote.dta ?? '');
  const [nfTransporte, setNfTransporte] = useState('');
  const [dtPrevChegada, setDtPrevChegada] = useState('');

  const avancarMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { proximo_estagio: destino };
      if (destino === 'porto_dta') {
        body.di = di;
        body.dta = dta;
      }
      if (destino === 'transito_interno') {
        body.nota_fiscal = nfTransporte;
      }
      if (dtPrevChegada) body.dt_prev_chegada = dtPrevChegada;
      return apiFetch(`/api/v1/stockbridge/transito/${lote.id}/avancar`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: onSucesso,
  });

  const podeEnviar = useMemo(() => {
    if (!destino) return false;
    if (destino === 'porto_dta') return di.trim() && dta.trim();
    if (destino === 'transito_interno') return nfTransporte.trim();
    return true;
  }, [destino, di, dta, nfTransporte]);

  if (!destino) {
    return (
      <Modal open title="Avançar estágio" onClose={onClose}>
        <p className="text-sm text-atlas-muted">
          Lotes em <strong>{lote.estagioTransito}</strong> não avançam por este painel —
          o próximo passo é recebimento físico no armazém (ver "Fila OMIE" no operador).
        </p>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-atlas-btn-bg text-atlas-btn-text rounded text-sm">OK</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title={`Avançar lote ${lote.codigo}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-atlas-muted">
          De <strong>{lote.estagioTransito}</strong> → <strong>{destino}</strong>
          <br />
          Fornecedor: {lote.fornecedorNome}
        </p>

        {destino === 'porto_dta' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-atlas-muted mb-1">Número da DI *</label>
              <input
                value={di}
                onChange={(e) => setDi(e.target.value)}
                placeholder="Ex: DI-2026-12345"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-atlas-muted mb-1">Número da DTA *</label>
              <input
                value={dta}
                onChange={(e) => setDta(e.target.value)}
                placeholder="Ex: DTA-2026-6789"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded text-sm"
              />
            </div>
          </>
        )}

        {destino === 'transito_interno' && (
          <div>
            <label className="block text-xs font-semibold text-atlas-muted mb-1">NF de transporte *</label>
            <input
              value={nfTransporte}
              onChange={(e) => setNfTransporte(e.target.value)}
              placeholder="Número da NF emitida pós-DI"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-atlas-muted mb-1">Nova data prevista de chegada (opcional)</label>
          <input
            type="date"
            value={dtPrevChegada}
            onChange={(e) => setDtPrevChegada(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded text-sm"
          />
        </div>

        {avancarMut.isError && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {(avancarMut.error as Error).message}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded text-sm">Cancelar</button>
          <button
            onClick={() => avancarMut.mutate()}
            disabled={!podeEnviar || avancarMut.isPending}
            className={`px-5 py-2 rounded text-sm font-medium ${podeEnviar ? 'bg-atlas-btn-bg text-atlas-btn-text hover:opacity-90' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {avancarMut.isPending ? 'Enviando...' : `Avançar para ${destino}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
