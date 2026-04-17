import { sendEmail, createLogger, getConfig } from '@atlas/core';

const logger = createLogger('stockbridge:notificacao');

const ADMIN_FALLBACK_EMAIL = 'admin@atlas.local';

function getAdminEmail(): string {
  const config = getConfig();
  return config.SEED_ADMIN_EMAIL ?? ADMIN_FALLBACK_EMAIL;
}

/**
 * T039: notifica o admin quando uma NF de recebimento nao encontra correlato Q2P
 * para o produto ACXE. Replica a mensagem do legado PHP (research.md secao 10).
 */
export async function enviarAlertaProdutoSemCorrelato(args: {
  codigoProdutoAcxe: number;
  notaFiscal: string;
  descricaoProduto: string;
}): Promise<void> {
  const to = getAdminEmail();
  const subject = `StockBridge — Produto sem correlato Q2P (NF ${args.notaFiscal})`;
  const html = `
    <h2 style="color: #f0ad4e;">Acao Necessaria: Produto Nao Encontrado na Q2P</h2>
    <p>Durante o recebimento da <strong>NF ${args.notaFiscal}</strong> no StockBridge, foi identificado que o produto abaixo nao possui correlato cadastrado na Q2P (match por descricao textual).</p>
    <ul>
      <li><strong>Codigo ACXE:</strong> ${args.codigoProdutoAcxe}</li>
      <li><strong>Descricao ACXE:</strong> ${args.descricaoProduto}</li>
    </ul>
    <p>Acoes esperadas:</p>
    <ol>
      <li>Cadastrar o produto correspondente na Q2P com <strong>descricao EXATA</strong> do ACXE.</li>
      <li>Aguardar sync n8n (proximo ciclo).</li>
      <li>Tentar novamente o recebimento no StockBridge.</li>
    </ol>
    <p style="color:#888;font-size:11px;">Sistema Atlas — StockBridge</p>
  `;
  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    logger.error({ err, args }, 'Falha ao enviar email de alerta produto sem correlato');
  }
}

/**
 * Notifica gestor quando uma nova aprovacao e criada (divergencia de recebimento,
 * entrada manual, etc.). Reutilizado por outras US.
 */
export async function enviarAlertaAprovacaoPendente(args: {
  aprovacaoId: string;
  tipoAprovacao: string;
  nivel: 'gestor' | 'diretor';
  loteCodigo: string;
  produto: string;
  quantidadeT: number;
  detalhes?: string;
}): Promise<void> {
  const to = getAdminEmail(); // v1: envia ao admin; refinar com lista de gestores/diretores depois
  const subject = `StockBridge — Aprovacao pendente (${args.nivel}) — ${args.tipoAprovacao}`;
  const html = `
    <h2 style="color: #D97706;">Nova pendencia de aprovacao</h2>
    <p><strong>Tipo:</strong> ${args.tipoAprovacao}</p>
    <p><strong>Lote:</strong> ${args.loteCodigo} — ${args.produto} (${args.quantidadeT} t)</p>
    ${args.detalhes ? `<p><strong>Detalhes:</strong> ${args.detalhes}</p>` : ''}
    <p>Acesse o painel de aprovacoes no StockBridge para revisar.</p>
    <p style="color:#888;font-size:11px;">Sistema Atlas — StockBridge</p>
  `;
  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    logger.error({ err, args }, 'Falha ao enviar email de aprovacao pendente');
  }
}
