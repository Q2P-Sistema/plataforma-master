import { FATOR_PARA_TONELADA, type UnidadeMedida } from '../types.js';

/**
 * Converte uma quantidade em unidade arbitraria para toneladas.
 * Preserva sinal (valores negativos para saidas).
 */
export function converterParaToneladas(quantidade: number, unidade: UnidadeMedida): number {
  return quantidade * FATOR_PARA_TONELADA[unidade];
}

const UNIDADE_LABEL: Record<UnidadeMedida, string> = {
  t: 't',
  kg: 'kg',
  saco: 'saco',
  bigbag: 'big bag',
};

/**
 * Formata quantidade + unidade para exibicao (pt-BR).
 */
export function fmtQtdUnidade(quantidade: number, unidade: UnidadeMedida): string {
  const formatado = quantidade.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${formatado} ${UNIDADE_LABEL[unidade]}`;
}
