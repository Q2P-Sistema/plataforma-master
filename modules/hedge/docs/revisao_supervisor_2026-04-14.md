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

### T02 — Badge PTAX não aparece no header das abas
**Problema:** O badge com valor do dólar não está visível no topo das páginas do módulo hedge.
**Suspeita:** O `HedgeLayout` pode não estar sendo renderizado corretamente com nested routes, ou o posicionamento no DOM não está sobrepondo o header do shell da aplicação.
**Ação:** Investigar por que o `HedgeLayout` não exibe o badge; corrigir posicionamento ou integração com o layout principal.

### T03 — Gráfico histórico PTAX vazio
**Problema:** O mini gráfico de 15 dias no card PTAX não renderiza dados.
**Causa provável:** O endpoint `/api/v1/hedge/ptax?dias=15` usa a tabela `hedge.ptax_historico` que pode estar sem dados populados.
**Ação:** Trocar a fonte do gráfico para a tabela `public.tbl_cotacaoDolar` que já existe no BD com dados reais. Ajustar o endpoint ou criar rota dedicada lendo dessa tabela.

---

## Notas / Dúvidas Registradas

---

## Regra para próximas sessões

> Anotar no arquivo de tarefas antes de implementar. Não sair codando sem confirmação do supervisor.

