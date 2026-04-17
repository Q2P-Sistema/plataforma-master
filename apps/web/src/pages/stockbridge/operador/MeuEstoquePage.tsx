/**
 * Placeholder da pagina "Meu Estoque" do operador.
 * US1 AC5 (opcional): mostrar saldo fisico por item do armazem vinculado.
 * Consumira `shared.vw_sb_saldo_por_produto` quando o endpoint de cockpit (US2) estiver pronto.
 */
export function MeuEstoquePage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-serif text-atlas-ink mb-1">Meu Estoque</h1>
      <p className="text-sm text-atlas-muted mb-6">
        Saldo fisico dos SKUs do seu armazem vinculado.
      </p>
      <div className="p-12 text-center text-sm text-atlas-muted border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
        Em construcao — sera implementado junto com o Cockpit (US2).
      </div>
    </div>
  );
}
