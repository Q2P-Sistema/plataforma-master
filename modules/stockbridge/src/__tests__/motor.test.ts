import { describe, it, expect } from 'vitest';
import { converterParaToneladas, fmtQtdUnidade } from '../services/motor.service.js';

describe('motor.service#converterParaToneladas', () => {
  it('tonelada mantem o valor', () => {
    expect(converterParaToneladas(25, 't')).toBe(25);
    expect(converterParaToneladas(0.5, 't')).toBe(0.5);
  });

  it('kg converte para tonelada dividindo por 1000', () => {
    expect(converterParaToneladas(1000, 'kg')).toBe(1);
    expect(converterParaToneladas(18_000, 'kg')).toBe(18);
    expect(converterParaToneladas(250, 'kg')).toBe(0.25);
  });

  it('saco de 25kg converte para 0.025t cada', () => {
    expect(converterParaToneladas(40, 'saco')).toBe(1); // 40 sacos × 25kg = 1000kg = 1t
    expect(converterParaToneladas(980, 'saco')).toBeCloseTo(24.5, 3);
    expect(converterParaToneladas(1, 'saco')).toBe(0.025);
  });

  it('bigbag mantem 1:1 com tonelada (1 bigbag = 1t)', () => {
    expect(converterParaToneladas(1, 'bigbag')).toBe(1);
    expect(converterParaToneladas(35, 'bigbag')).toBe(35);
  });

  it('valor zero retorna zero', () => {
    expect(converterParaToneladas(0, 't')).toBe(0);
    expect(converterParaToneladas(0, 'kg')).toBe(0);
    expect(converterParaToneladas(0, 'saco')).toBe(0);
    expect(converterParaToneladas(0, 'bigbag')).toBe(0);
  });

  it('valor negativo preserva sinal (para saidas)', () => {
    expect(converterParaToneladas(-5, 't')).toBe(-5);
    expect(converterParaToneladas(-1000, 'kg')).toBe(-1);
  });
});

describe('motor.service#fmtQtdUnidade', () => {
  it('formata com unidade legivel', () => {
    expect(fmtQtdUnidade(25, 't')).toMatch(/25\s+t/);
    expect(fmtQtdUnidade(1000, 'kg')).toMatch(/1[.,]?000\s+kg/);
    expect(fmtQtdUnidade(40, 'saco')).toMatch(/40\s+saco/);
    expect(fmtQtdUnidade(35, 'bigbag')).toMatch(/35\s+big\s?bag/);
  });
});
