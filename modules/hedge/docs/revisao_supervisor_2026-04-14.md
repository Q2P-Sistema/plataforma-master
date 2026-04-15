# Revisão Supervisória — Módulo Hedge
**Data:** 2026-04-14  
**Objetivo:** Validar lógicas de cálculo e identificar melhorias

---

## Tarefas Identificadas

### ~~T01~~ — PTAX visível — **IMPLEMENTADO**
- Card "PTAX Atual" redesenhado: valor grande colorido (verde=caiu, vermelho=subiu), variação % vs dia anterior, data ref + horário da última busca
- Mini gráfico de 15 dias abaixo do valor (usando `ptaxHistorico` real, não snapshots)
- Card "Câmbio PTAX" vazio/quebrado removido; seção charts row passou de 3 para 2 colunas
- `HedgeLayout` criado como wrapper compartilhado — badge PTAX (valor + var% + horário) aparece no header de todas as abas do módulo
- Backend: `fetchedAt` exposto no endpoint `/api/v1/hedge/ptax`

### ~~T02~~ — Badge PTAX não aparece no TopBar — **IMPLEMENTADO**
- `topBarSlot` passa `<HedgePtaxBadge />` via `ShellLayout` → `TopBar.centerSlot` quando rota começa com `/hedge`
- Badge aparece no header global em todas as abas do módulo hedge

### ~~T03~~ — Gráfico histórico PTAX vazio — **IMPLEMENTADO**
- Root cause: `getPool` não estava importado em `modules/hedge/src/services/ptax.service.ts` — causava `ReferenceError` silencioso, API retornava 500
- Fix: adicionado `getPool` ao import de `@atlas/core`
- Melhorias adicionais: labels com 3 chars mês PT-BR ("15 Abr"), linha de tendência (regressão linear) no gráfico, ponto intraday do boletim BCB appended como último ponto quando mais recente que `tbl_cotacaoDolar`

### ~~T04~~ — Card "Receita Projetada" exibindo BRL em vez de USD — **IMPLEMENTADO**
- Trocado `recebiveis_brl` → `recebiveis_usd`, label "Receita USD Projetada", formato `$ 11.9M` (`fmtM`)
- Arquivo: `apps/web/src/pages/hedge/PositionDashboard.tsx` linha 215

### ~~T05~~ — PTAX boletins intraday BCB — **IMPLEMENTADO**
- Migrado de SGS-1 (fechamento diário) para `CotacaoDolarDia` (boletins ~3x/dia: ~10h, ~12h, ~16h BRT)
- `fetchedAt` = `dataHoraCotacao` real do boletim BCB (não timestamp do servidor)
- Redis TTL: 3600s. Frontend: staleTime 1h, sem `refetchInterval`
- Label: "Boletim BCB HH:MM · Ref. YYYY-MM-DD"

### T06 — Fórmula de exposição cambial — **DISCUSSÃO EM ABERTO**
**Proposta do supervisor:** `exposicao_usd_total = total_pagar_usd - estoque_importado (no chão + embarcados)`
**Interpretação:** o estoque de importados já comprados (em armazém ou em trânsito) representa dólares que já saíram do caixa ou têm compromisso firme — abater da exposição dá o líquido real a hedgear.
**Pendente:** validar os componentes exatos (no chão = `est_importado_brl` / PTAX? embarcados = `est_transito_brl`?) e comparar com cálculo atual de `est_nao_pago_usd`.

---

## Notas / Dúvidas Registradas

---

## Regra para próximas sessões

> Anotar no arquivo de tarefas antes de implementar. Não sair codando sem confirmação do supervisor.

