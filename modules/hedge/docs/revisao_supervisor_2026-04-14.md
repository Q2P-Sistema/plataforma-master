# Revisão Supervisória — Módulo Hedge
**Data:** 2026-04-14  
**Objetivo:** Validar lógicas de cálculo e identificar melhorias

---

## Tarefas Identificadas

> Itens a serem executados posteriormente. Adicionar aqui durante o papo.

### ~~T01~~ — PTAX visível — **FEITO**
- Card "PTAX Atual" redesenhado: valor grande colorido (verde=caiu, vermelho=subiu), variação % vs dia anterior, data ref + horário da última busca
- Mini gráfico de 15 dias abaixo do valor (usando `ptaxHistorico` real, não snapshots)
- Card "Câmbio PTAX" vazio/quebrado removido; seção charts row passou de 3 para 2 colunas
- `HedgeLayout` criado como wrapper compartilhado — badge PTAX (valor + var% + horário) aparece no header de todas as abas do módulo
- Backend: `fetchedAt` exposto no endpoint `/api/v1/hedge/ptax`

---

## Notas / Dúvidas Registradas

> Contexto das perguntas feitas durante a revisão.

