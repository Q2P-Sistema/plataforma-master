import { FATOR_PARA_KG, type UnidadeMedida } from '../types.js';

/**
 * Converte uma quantidade em unidade arbitraria para Kg.
 * Preserva sinal (valores negativos para saidas).
 */
export function converterParaKg(quantidade: number, unidade: UnidadeMedida): number {
  return quantidade * FATOR_PARA_KG[unidade];
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

export type Criticidade = 'critico' | 'alerta' | 'ok' | 'excesso';

const LEAD_TIME_DEFAULT_DIAS = 60;

/**
 * Calcula cobertura de estoque em dias.
 * saldo / consumoMedioDiario, arredondado para inteiro.
 * Retorna null se consumo nao configurado (sem base para dividir).
 */
export function calcularCobertura(saldoFisicoKg: number, consumoMedioDiarioKg: number | null): number | null {
  if (consumoMedioDiarioKg == null || consumoMedioDiarioKg <= 0) return null;
  return Math.round(saldoFisicoKg / consumoMedioDiarioKg);
}

/**
 * Classifica criticidade do SKU segundo regras do FR-005:
 *   critico  — cobertura < 50% do lead time
 *   alerta   — cobertura entre 50% e 120% do lead time
 *   ok       — cobertura entre 120% e 400% do lead time
 *   excesso  — saldo fisico > consumo * lead time * 4 (sobra > 4x)
 *
 * Quando nao e possivel calcular (sem consumo ou sem lead time), retorna 'ok'.
 */
export function classificarCriticidade(
  cobertura: number | null,
  leadTimeDias: number | null,
  saldoFisicoKg: number,
  consumoMedioDiarioKg: number | null,
): Criticidade {
  if (consumoMedioDiarioKg == null || consumoMedioDiarioKg <= 0) return 'ok';
  const lt = leadTimeDias ?? LEAD_TIME_DEFAULT_DIAS;
  const cob = cobertura ?? calcularCobertura(saldoFisicoKg, consumoMedioDiarioKg);
  if (cob == null) return 'ok';

  if (saldoFisicoKg > consumoMedioDiarioKg * lt * 4) return 'excesso';
  if (cob < lt * 0.5) return 'critico';
  if (cob < lt * 1.2) return 'alerta';
  return 'ok';
}
