import { describe, it, expect } from 'vitest';
import { calcular, type MotorInput } from '../services/motor.service.js';
import type { DadosBase } from '../services/dados.service.js';

function emptyPagamentos() {
  return Array.from({ length: 26 }, (_, w) => ({ semana: w, total: 0, finimp_total: 0 }));
}

function emptyRecebimentos() {
  return Array.from({ length: 26 }, (_, w) => ({ semana: w, total: 0 }));
}

function baseInput(overrides: Partial<MotorInput> = {}): MotorInput {
  const dados: DadosBase = {
    saldo_cc: 2_140_000,
    dup_total: 4_200_000,
    estoque_custo_brl: 820_000,
    finimp_saldo: 850_000,
    finimp_amort_mensal: 120_000,
    pagamentos_semanais: emptyPagamentos(),
    recebimentos_semanais: emptyRecebimentos(),
    contas_ativas_count: 3,
    contas_excluidas_count: 0,
  };
  return {
    dados,
    data_base: new Date('2026-04-14T00:00:00Z'),
    dup_antecip_usado: 0,
    dup_antecip_limite: 3_000_000,
    dup_antecip_taxa: 0.85,
    finimp_limite: 2_000_000,
    finimp_garantia_pct: 0.4,
    markup_estoque: 0.22,
    alerta_gap_limiar: 300_000,
    cat_finimp_cod_nulo: false,
    ...overrides,
  };
}

describe('motor.calcular', () => {
  it('(a) sem pagamentos: nenhum breaking point em 26 semanas', () => {
    const out = calcular(baseInput());
    expect(out.breaking_points.break_caixa).toBeNull();
    expect(out.breaking_points.break_total).toBeNull();
    expect(out.semanas).toHaveLength(26);
    expect(out.semanas[0]!.status_gap).toBe('ok');
  });

  it('(b) breaking point por pagamento grande em S12', () => {
    const pagamentos = emptyPagamentos();
    pagamentos[11] = { semana: 11, total: 10_000_000, finimp_total: 0 };
    const out = calcular(baseInput({ dados: { ...baseInput().dados, pagamentos_semanais: pagamentos } }));
    expect(out.breaking_points.break_total).not.toBeNull();
    expect(out.breaking_points.break_total!.semana).toBe(12);
    expect(out.breaking_points.break_total!.val).toBeLessThan(0);
  });

  it('(c) saldo CC negativo desde a primeira semana', () => {
    const pagamentos = emptyPagamentos();
    pagamentos[0] = { semana: 0, total: 5_000_000, finimp_total: 0 };
    const out = calcular(baseInput({ dados: { ...baseInput().dados, pagamentos_semanais: pagamentos } }));
    expect(out.breaking_points.break_caixa).not.toBeNull();
    expect(out.breaking_points.break_caixa!.semana).toBe(1);
    expect(out.semanas[0]!.saldo_cc).toBeLessThan(0);
  });

  it('(d) trava FINIMP quando dup_bloq > dup_livre × 0.6', () => {
    // dup_total 2M, finimp 2M × 0.4 = 800k bloqueadas → dup_livre 1.2M → 800k > 720k
    const out = calcular(
      baseInput({
        dados: {
          ...baseInput().dados,
          dup_total: 2_000_000,
          finimp_saldo: 2_000_000,
        },
        finimp_garantia_pct: 0.4,
      }),
    );
    expect(out.breaking_points.trava_finimp).not.toBeNull();
  });

  it('(e) estoque D+15 liquida a 18% por semana a partir de S2', () => {
    const out = calcular(baseInput());
    expect(out.semanas[0]!.rec_estoque).toBe(0);
    expect(out.semanas[1]!.rec_estoque).toBe(0);
    // S2: markup aplicado; custo 820k × 1.22 = 1.000.400, 18% disso = 180.072
    expect(out.semanas[2]!.rec_estoque).toBeGreaterThan(170_000);
    expect(out.semanas[2]!.rec_estoque).toBeLessThan(190_000);
    // Saldo vai decrescendo
    expect(out.semanas[3]!.rec_estoque).toBeLessThan(out.semanas[2]!.rec_estoque);
  });

  it('(f) config incompleta: limites zerados + cat_finimp nulo', () => {
    const out = calcular(
      baseInput({
        dup_antecip_limite: 0,
        finimp_limite: 0,
        cat_finimp_cod_nulo: true,
      }),
    );
    expect(out.kpis.config_incompleta).toBe(true);
    // Motor não quebra e classifica todos pagamentos como Op.Corrente
    expect(out.semanas.every((s) => s.pagamento === 0 || s.tipo === 'Op.Corrente')).toBe(true);
    // Sem limite de antecipação, antecip_disp fica sempre 0
    expect(out.semanas[0]!.antecip_disp).toBe(0);
  });

  it('status_gap respeita alerta_gap_limiar configurável', () => {
    // Pagamento que deixa gap entre 0 e limiar → ALERTA
    const pagamentos = emptyPagamentos();
    // saldo_cc 2.14M + antecip 3M = liquidez 5.14M; pagamento 5M → gap 140k (< 300k limiar)
    pagamentos[0] = { semana: 0, total: 5_000_000, finimp_total: 0 };
    const out = calcular(baseInput({ dados: { ...baseInput().dados, pagamentos_semanais: pagamentos } }));
    expect(out.semanas[0]!.gap).toBeGreaterThan(0);
    expect(out.semanas[0]!.gap).toBeLessThan(300_000);
    expect(out.semanas[0]!.status_gap).toBe('alerta');

    // Com limiar menor, vira OK
    const out2 = calcular(
      baseInput({
        dados: { ...baseInput().dados, pagamentos_semanais: pagamentos },
        alerta_gap_limiar: 50_000,
      }),
    );
    expect(out2.semanas[0]!.status_gap).toBe('ok');
  });
});
