import { describe, it, expect } from 'vitest';
import { transicaoEValida } from '../services/transito.service.js';

describe('transito.service#transicaoEValida', () => {
  it('aceita entrada em transito_intl sem estagio previo', () => {
    expect(transicaoEValida(null, 'transito_intl')).toBe(true);
  });

  it('aceita reservado sem estagio previo', () => {
    expect(transicaoEValida(null, 'reservado')).toBe(true);
  });

  it('aceita transito_intl -> porto_dta', () => {
    expect(transicaoEValida('transito_intl', 'porto_dta')).toBe(true);
  });

  it('aceita porto_dta -> transito_interno', () => {
    expect(transicaoEValida('porto_dta', 'transito_interno')).toBe(true);
  });

  it('rejeita pular etapa (transito_intl -> transito_interno)', () => {
    expect(transicaoEValida('transito_intl', 'transito_interno')).toBe(false);
  });

  it('rejeita voltar de fase', () => {
    expect(transicaoEValida('porto_dta', 'transito_intl')).toBe(false);
    expect(transicaoEValida('transito_interno', 'porto_dta')).toBe(false);
  });

  it('rejeita transito_interno -> qualquer outro estagio (proximo e recebimento)', () => {
    expect(transicaoEValida('transito_interno', 'reservado')).toBe(false);
    expect(transicaoEValida('transito_interno', 'porto_dta')).toBe(false);
  });

  it('rejeita reservado -> outros estagios', () => {
    expect(transicaoEValida('reservado', 'transito_intl')).toBe(false);
  });
});
