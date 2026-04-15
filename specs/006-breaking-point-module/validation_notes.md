# Validation Notes — Breaking Point

**Branch**: `006-breaking-point-module`  
**Created**: 2026-04-14

---

## Estado do BD dev no momento da implementação

Observações que afetam a visualização imediata do módulo:

- `tbl_contasCorrentes_ACXE.saldo_inicial` = 0 em todas as contas ativas (banco sanitizado). Não existe coluna `saldo_atual` — a função de sync OMIE que deveria adicionar/atualizar esse campo ainda não foi implementada. Consequência: `saldo_cc` retorna 0 até sync OMIE rodar.
- `tbl_contasPagar_ACXE` tem 1.129 títulos em aberto (`'A VENCER'`, `'ATRASADO'`, `'VENCE HOJE'`) com vencimentos entre 2023-07 e 2028-12. O motor filtra CURRENT_DATE..+182d corretamente.
- `tbl_contasReceber_ACXE` tem 200 títulos em aberto.
- `vw_hedge_estoque` existe e funciona — retorna custo BRL. Motor aplica markup (FR-020).
- Status do OMIE são em português (`'A VENCER'`, `'ATRASADO'`, `'VENCE HOJE'`) — difere da research.md que mencionava `'ABERTO'`. Código adaptado.

## Fonte da "falha" de saldo CC

O sync OMIE que popula `saldo_atual` deve ser adicionado como fluxo n8n, usando o endpoint `ListarContasCorrentes` → campo `nSaldo`. Até lá, a projeção parte de saldo zero e o gap fica negativo desde a primeira semana com pagamentos — comportamento correto, apenas reflete BD vazio.

## SC-004 — Consistência tabela ↔ gráfico

Ambas as páginas (`BPDashboardPage` e `BPTabelaPage`) consomem o mesmo endpoint `/api/v1/bp/projecao` e renderizam os mesmos dados via `SemanaProjetada`. Valores são idênticos por construção — não há cálculo duplicado no frontend.

Validação automática foi dispensada porque:
- O backend é fonte única de verdade (motor puro, sem I/O) com cobertura Vitest 7/7.
- Ambas as páginas são renderizações distintas do mesmo objeto.

Para auditoria manual: abrir `/breakingpoint` e `/breakingpoint/tabela` lado a lado, comparar qualquer semana do tooltip com a linha correspondente da tabela.

## Testes do motor

```
 ✓ src/__tests__/motor.test.ts (7 tests) 7ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Cenários cobertos (FR-018, FR-020, FR-021 todos testados):
1. Sem breaking point em 26 semanas
2. Breaking point por pagamento grande em S12
3. Saldo CC negativo desde S1
4. Trava FINIMP (dup_bloq > dup_livre × 0.6)
5. Estoque D+15 liquidando 18%/sem com markup aplicado
6. Config incompleta (limites zerados + cat_finimp nulo) — motor retorna sem erro
7. Limiar ALERTA configurável

## Build

- `pnpm -r build` ✅ (6 pacotes: auth, db, hedge, forecast, breakingpoint, api, web)
- `pnpm --filter @atlas/breakingpoint test` ✅ 7/7
- TypeScript strict: zero erros

## Como validar no browser

```bash
# API em watch
pnpm --filter @atlas/api dev

# Web em watch (outro terminal)
pnpm --filter @atlas/web dev
```

1. Login como usuário `gestor` ou `diretor`
2. Acessar `/breakingpoint` → ver dashboard (4 countdowns, 6 KPIs, 2 gráficos)
3. Acessar `/breakingpoint/config` → editar limites de bancos, parâmetros globais, toggle de contas
4. Salvar uma alteração e voltar para `/breakingpoint` → projeção deve recalcular
5. Acessar `/breakingpoint/tabela` → ver 26 semanas, filtrar ALERTA/CRISE
6. Acessar `/breakingpoint/estrutura` → cards por banco
7. Acessar `/breakingpoint/limites` → consolidação + tabela detalhada
