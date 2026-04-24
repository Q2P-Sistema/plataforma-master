import type { OmieCnpj } from '../client.js';
import type { ConsultarNFResponse } from './nf.js';
import type { IncluirAjusteEstoqueInput, IncluirAjusteEstoqueResponse } from './ajuste-estoque.js';
import type { AlterarPedidoCompraInput, AlterarPedidoCompraResponse } from './pedido-compra.js';

/**
 * Implementacao mock da API OMIE para dev sem credenciais (OMIE_MODE=mock).
 * Retorna respostas sinteticas deterministicas.
 */

let mockIdSeq = 1_000_000;
function nextMockId(): string { mockIdSeq += 1; return String(mockIdSeq); }

export function mockConsultarNF(cnpj: OmieCnpj, numeroNota: number): ConsultarNFResponse {
  // Produto real com correlato ACXE↔Q2P (match por descricao "PEAD 5502").
  // Permite testar o fluxo completo de recebimento em dev sem bater em API real.
  return {
    nNF: numeroNota,
    cChaveNFe: `MOCK-CHAVE-${cnpj}-${numeroNota}`,
    dEmi: '15/04/2026',
    nCodProd: cnpj === 'acxe' ? 4_452_881_285 : 3_033_098_357,
    codigoLocalEstoque: cnpj === 'acxe' ? '4498926337' : '8115873874',
    qCom: 25_000,
    uCom: 'KG',
    xProd: 'PEAD 5502',
    vUnCom: 1.2,
    vNF: 30_000,
    nCodCli: 12345,
    cRazao: 'FORNECEDOR MOCK',
  };
}

export function mockIncluirAjusteEstoque(
  cnpj: OmieCnpj,
  _input: IncluirAjusteEstoqueInput,
): IncluirAjusteEstoqueResponse {
  return {
    idMovest: `MOCK-MOVEST-${cnpj}-${nextMockId()}`,
    idAjuste: `MOCK-AJUSTE-${cnpj}-${nextMockId()}`,
    descricaoStatus: 'Ajuste registrado (mock)',
  };
}

export function mockAlterarPedidoCompra(
  cnpj: OmieCnpj,
  input: AlterarPedidoCompraInput,
): AlterarPedidoCompraResponse {
  return {
    status: 'ok',
    descricao: `Pedido ${input.cCodIntPed} alterado (mock) em ${cnpj}`,
    codigoPedido: 99_999,
  };
}
