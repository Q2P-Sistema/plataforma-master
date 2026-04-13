import { describe, it, expect } from 'vitest';
import { calcularCamadas, selecionarInstrumento } from '../services/motor.service.js';

// Default config matching migration seed values
const defaultConfig = {
  camada1_minima: 60,
  camada1_ajuste_ep: 8,
  estoque_bump_threshold: 0.5,
  ndf_rates: {},
};

describe('Motor de Minima Variancia', () => {
  describe('calcularCamadas', () => {
    it('L1 + L2 + L3 always sum to 100%', () => {
      for (let lambda = 0; lambda <= 1; lambda += 0.1) {
        for (let estoque = 0; estoque <= 1; estoque += 0.25) {
          const result = calcularCamadas({ lambda, pct_estoque_nao_pago: estoque }, defaultConfig);
          const sum = result.l1_pct + result.l2_pct + result.l3_pct;
          expect(Math.abs(sum - 100)).toBeLessThan(0.1);
        }
      }
    });

    it('lambda 0 gives L2 = 0%', () => {
      const result = calcularCamadas({ lambda: 0, pct_estoque_nao_pago: 0 }, defaultConfig);
      expect(result.l2_pct).toBe(0);
      expect(result.l1_pct).toBe(60);
      expect(result.l3_pct).toBe(40);
    });

    it('lambda 1 gives L2 = 25%', () => {
      const result = calcularCamadas({ lambda: 1, pct_estoque_nao_pago: 0 }, defaultConfig);
      expect(result.l2_pct).toBe(25);
      expect(result.l1_pct).toBe(60);
      expect(result.l3_pct).toBe(15);
    });

    it('estoque > 50% bumps L1 from 60 to 68', () => {
      const noEstoque = calcularCamadas({ lambda: 0.5, pct_estoque_nao_pago: 0.3 }, defaultConfig);
      expect(noEstoque.l1_pct).toBe(60);

      const comEstoque = calcularCamadas({ lambda: 0.5, pct_estoque_nao_pago: 0.6 }, defaultConfig);
      expect(comEstoque.l1_pct).toBe(68);
    });

    it('high lambda + estoque bump caps at 100', () => {
      const result = calcularCamadas({ lambda: 1, pct_estoque_nao_pago: 0.9 }, defaultConfig);
      // L1 = 68, L2 = 25, L3 = 7
      expect(result.l1_pct).toBe(68);
      expect(result.l2_pct).toBe(25);
      expect(result.l3_pct).toBe(7);
      expect(result.l1_pct + result.l2_pct + result.l3_pct).toBe(100);
    });

    it('respects custom config values', () => {
      const customConfig = { camada1_minima: 50, camada1_ajuste_ep: 15, estoque_bump_threshold: 0.3, ndf_rates: {} };
      const result = calcularCamadas({ lambda: 0, pct_estoque_nao_pago: 0.4 }, customConfig);
      // L1 = min(50+15, 90) = 65 (estoque 0.4 > threshold 0.3)
      expect(result.l1_pct).toBe(65);
      expect(result.l3_pct).toBe(35);
    });
  });

  describe('selecionarInstrumento', () => {
    it('<=15 days returns Trava cambial', () => {
      expect(selecionarInstrumento(1)).toBe('Trava cambial');
      expect(selecionarInstrumento(15)).toBe('Trava cambial');
    });

    it('<=35 days returns NDF 30d', () => {
      expect(selecionarInstrumento(16)).toBe('NDF 30d');
      expect(selecionarInstrumento(35)).toBe('NDF 30d');
    });

    it('<=70 days returns NDF 60d', () => {
      expect(selecionarInstrumento(36)).toBe('NDF 60d');
      expect(selecionarInstrumento(70)).toBe('NDF 60d');
    });

    it('<=100 days returns NDF 90d', () => {
      expect(selecionarInstrumento(71)).toBe('NDF 90d');
      expect(selecionarInstrumento(100)).toBe('NDF 90d');
    });

    it('<=150 days returns NDF 120d', () => {
      expect(selecionarInstrumento(101)).toBe('NDF 120d');
      expect(selecionarInstrumento(150)).toBe('NDF 120d');
    });

    it('>150 days returns NDF 180d', () => {
      expect(selecionarInstrumento(151)).toBe('NDF 180d');
      expect(selecionarInstrumento(365)).toBe('NDF 180d');
    });
  });
});
