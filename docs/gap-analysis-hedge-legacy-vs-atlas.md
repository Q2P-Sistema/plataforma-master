# Gap Analysis: Hedge Engine — Legado vs Atlas

**Data**: 2026-04-13  
**Autor**: Claude (varredura automatizada)  
**Escopo**: Comparacao linha-a-linha de regras de negocio, calculos e funcionalidades entre o sistema legado (`sistema_hedge/backend/`) e o modulo novo (`modules/hedge/src/`)

---

## Resumo Executivo

O modulo Atlas tem a **estrutura correta** (motor 3 camadas, NDF lifecycle, PTAX, buckets, alertas, estoque), mas faltam **15 gaps criticos** de logica de negocio e **7 gaps de funcionalidade** que o legado implementava. Os mais graves sao:

1. **Exposicao ignora estoque nao pago** — o motor novo so usa `pagarUsd`, o legado soma `pagar_usd + est_nao_pago_usd`
2. **Pipeline de sync inexistente** — sem cron, sem sync manual, sem soft-archive
3. **Motor nao usa taxas NDF por prazo** — nao calcula custo por recomendacao
4. **PTAX sem validacao sanitaria** — aceita qualquer valor, nao gera alerta
5. **Simulacao de margem com formula diferente** — parametros e steps divergentes

---

## GAPS CRITICOS — Backend

### GAP-01: Motor MV ignora estoque nao pago nos buckets

| Item | Legado | Atlas |
|------|--------|-------|
| Exposicao por bucket | `pagar_usd + est_nao_pago_usd` | Apenas `pagarUsd` |
| Distribuicao est. nao pago | Proporcional: `estNaoPagoUSD / num_buckets` | Nao existe |

**Arquivo legado**: `routes/posicao.js:58-60`  
**Arquivo Atlas**: `services/posicao.service.ts:106-112`  

**Impacto**: A exposicao real esta **subestimada** em todos os buckets. O motor gera recomendacoes de hedge menores do que deveria.

**Correcao**: Em `recalcularBuckets()`, apos calcular `pagarUsd`, buscar `est_nao_pago_usd` do resumo VPS e distribuir proporcionalmente. Criar campo `estNaoPagoUsd` no schema `bucketMensal`. Somar ambos no motor.

---

### GAP-02: Motor nao usa taxas NDF por prazo

| Item | Legado | Atlas |
|------|--------|-------|
| Lookup taxa por prazo | `ndf_30d..ndf_180d` do params | Nao faz |
| Custo NDF por recomendacao | `notional * (taxa_ndf - ptax)` | Nao calcula |
| `custo_acao_brl` total | Soma de todos custos | Nao existe |
| `taxa_ndf` na recomendacao | Retornado | Nao retornado |

**Arquivo legado**: `services/motor.service.js:44-66`  
**Arquivo Atlas**: `services/motor.service.ts:89-140`  

**Impacto**: O usuario nao sabe quanto custaria executar as recomendacoes. A tabela de recomendacoes fica incompleta sem coluna "Custo" e sem indicacao de taxa.

**Correcao**: No `calcularMotor()`, buscar taxas NDF do configMotor ou ndfTaxas. Para cada recomendacao, adicionar `taxa_ndf`, `custo_ndf_brl`, `prioridade`. Retornar `custo_acao_brl` no resultado global.

---

### GAP-03: Motor nao retorna alertas nem prioridades

| Item | Legado | Atlas |
|------|--------|-------|
| `alertas[]` no resultado | Array de alertas para buckets sub-hedged | Nao retorna |
| `prioridade` por recomendacao | critica (>$1M), alta (>$500K), media (>0) | Nao existe |
| `acao_recomendada` texto | "Contratar NDF 90d de $XXK a R$Y.YY" | Nao existe |
| `status` por recomendacao | ok / sub_hedged | Nao existe |

**Arquivo legado**: `services/motor.service.js:67-88, 114-123`  
**Arquivo Atlas**: `services/motor.service.ts:130-138`  

**Impacto**: Frontend nao mostra urgencia nem acao sugerida. Alertas nao sao gerados automaticamente pelo motor.

**Correcao**: Adicionar logica de prioridade e geracao de alertas no `calcularMotor()`. Retornar `alertas[]` com tipo/titulo/descricao. Na rota, persistir alertas no banco via `gerarAlertas()`.

---

### GAP-04: Motor nao le parametros configurados do banco

| Item | Legado | Atlas |
|------|--------|-------|
| `camada1_minima` | Lido de params.json (default 60) | Hardcoded 60 |
| `camada1_ajuste_ep` | Lido de params.json (default 8) | Hardcoded 8 (implicito em 68) |
| `margem_floor` | Lido de params.json (default 15) | Nao usado |
| Lambda override | Params + query string | So body da request |

**Arquivo legado**: `services/motor.service.js:14-16`, `config/index.js:21-24`  
**Arquivo Atlas**: `services/motor.service.ts:47-53`  

**Impacto**: Alterar parametros na Config Page nao afeta os calculos do motor — os valores sao hardcoded.

**Correcao**: No `calcularCamadas()`, buscar `camada1_minima`, `camada1_ajuste_ep`, `estoque_bump_threshold` do configMotor. Usar `getMotorDefaults()` ja existente mas expandir para incluir todos os params.

---

### GAP-05: Pipeline de sincronizacao completamente ausente

| Item | Legado | Atlas |
|------|--------|-------|
| `sincronizarTudo()` | Puxa 9 views do BD VPS em paralelo | Nao existe |
| Cron job | Weekdays 06:00 BRT (node-cron) | Nao existe |
| `POST /api/sync/agora` | Sync manual com debounce 60s | Nao existe |
| `GET /api/sync/log` | Historico de syncs | Nao existe |
| Soft-archive (T024) | `status='arquivado'` para records ausentes | Nao existe |
| sync_log table | Registra fonte/status/duracao/erro | Schema existe mas nao usado |
| Alerta de falha de sync | Gera alerta critico se sync falhar | Nao existe |

**Arquivos legado**: `services/omie.service.js`, `routes/sync.js`, `jobs/sync.job.js`  
**Arquivo Atlas**: Nenhum equivalente  

**Impacto**: Dados no Atlas ficam desatualizados. Sem recalculo automatico de buckets, sem atualizacao de PTAX, sem geracao de alertas. O `recalcularBuckets()` so roda quando o usuario acessa o dashboard.

**Correcao**: Criar `modules/hedge/src/services/sync.service.ts` com `sincronizarTudo()`. Criar `modules/hedge/src/jobs/sync.job.ts` com cron via n8n ou node-cron. Adicionar rotas `/api/v1/hedge/sync/agora` e `/api/v1/hedge/sync/log`. Implementar soft-archive e debounce.

---

### GAP-06: PTAX sem validacao sanitaria

| Item | Legado | Atlas |
|------|--------|-------|
| Bounds check | `[PTAX_MIN(3.00), PTAX_MAX(10.00)]` | Nenhum |
| Alerta para PTAX invalido | Insere alerta critico | Nao existe |
| Rejeicao de INSERT | Nao persiste se fora do range | Persiste qualquer valor |
| `ptax_anterior` | Retornado com calculo de variacao | Nao existe |
| `variacao_pct` | Calculado e persistido | Nao existe |
| `variacao_30d_pct` | Funcao dedicada | Nao existe |
| Cache Redis | 15 min (current), 1h (history) | Sem cache |

**Arquivo legado**: `services/bcb.service.js:47-53`, `middleware/validate.js:55-58`  
**Arquivo Atlas**: `services/ptax.service.ts:7-30`  

**Impacto**: Valor de PTAX espurio pode contaminar calculos. Sem cache, cada request ao dashboard chama BCB API.

**Correcao**: Adicionar validacao PTAX no `getAtual()`. Gerar alerta se fora do range. Calcular `variacao_pct` e `ptax_anterior`. Implementar cache (ou usar integration-bcb cache se existir).

---

### GAP-07: Simulacao de margem com formula diferente

| Item | Legado | Atlas |
|------|--------|-------|
| Input `volume_usd` | Calculado: `faturamento * pct_custo_importado / 100` | Recebe direto do usuario |
| Input `l1, l2` | Usa camadas do motor | Recebe `pct_cobertura` flat |
| Range de cambio | 4.50 a 7.50, step **0.10** (30 cenarios) | 4.50 a 7.50, step **0.25** (13 cenarios) |
| `pct_aberto` | `(100 - L1 - L2) / 100` (layer-aware) | `1 - pct_cobertura/100` (flat) |
| Endpoint | `POST /api/motor/simular` | `POST /api/v1/hedge/simulacao/margem` |

**Arquivo legado**: `services/motor.service.js:127-143`  
**Arquivo Atlas**: `services/simulacao.service.ts:22-65`  

**Impacto**: Resultados de simulacao nao sao compativeis com o legado. Menos granularidade (13 vs 30 cenarios). Pct_aberto nao reflete as camadas do motor.

**Correcao**: Aceitar opcionalmente `faturamento_brl + pct_custo_importado` em vez de `volume_usd`. Usar step 0.10 (30 cenarios). Aceitar opcionalmente `l1, l2` para calcular `pct_aberto` layer-aware.

---

### GAP-08: NDF sem validacao de duplicatas e sem campo banco

| Item | Legado | Atlas |
|------|--------|-------|
| Check duplicata | `SELECT WHERE bucket_mes=$1 AND vencimento=$2 AND banco=$3` | Nenhum |
| Campo `banco` | Presente (Itau, Bradesco, etc) | Nao existe |
| Campo `instrumento` no POST | `NDF, Trava, ACC` | `tipo` (ndf/trava/acc) |
| Validacao middleware | `notional > 0`, `taxa > 0`, `vencimento futuro` | So verifica campos presentes |
| Audit record em sync_log | JSON com acao/quem/quando/estado | Nao existe |
| Status inicial | `ativo` (pre-aprovado) | `pendente` (requer ativacao) |

**Arquivo legado**: `routes/ndf.js:33-67`  
**Arquivo Atlas**: `services/ndf.service.ts:37-89`  

**Impacto**: Possivel double-booking de NDFs. Sem rastreabilidade de banco contraparte. Sem audit trail.

**Correcao**: Adicionar campo `banco` ao schema ndfRegistro. Implementar check de duplicata antes de insert. Adicionar validacao Zod (notional > 0, taxa > 0, vencimento > hoje). Registrar audit em sync_log.

---

### GAP-09: Calculo de % estoque nao pago diferente

| Item | Legado | Atlas |
|------|--------|-------|
| Formula | `min(totalPagarBRL / estImportadoBRL * 100, 100)` | Vem da `vw_hedge_resumo` (view SQL) |
| Usado no motor | Passado como `pctEstNaoPago` | Passado como `pct_estoque_nao_pago` |
| Distribui nos buckets | `estNaoPagoUSD / num_buckets` | Nao distribui |

**Arquivo legado**: `routes/posicao.js:53-60`  
**Arquivo Atlas**: `services/posicao.service.ts:71` (delega pra view)  

**Impacto**: Se a view SQL calcula diferente da formula legada, o valor de `pct_nao_pago` pode divergir. Precisa validar a view.

**Acao**: Verificar query da `vw_hedge_resumo` no BD VPS e confirmar que usa a mesma formula (`titulos_abertos_BRL / estoque_importado_BRL * 100`, capped at 100).

---

### GAP-10: Redis cache totalmente ausente

| Item | Legado | Atlas |
|------|--------|-------|
| `posicao:v2` | 5 min TTL | Sem cache |
| `bcb:ptax:atual` | 15 min TTL | Sem cache |
| `bcb:ptax:hist:N` | 1h TTL | Sem cache |
| `estoque:localidades` | 1h TTL | Sem cache |
| `sync:last_triggered` | 60s debounce | Sem cache |
| Servicos internos (CRM, etc) | 30 min TTL cada | N/A (nao implementados) |

**Impacto**: Cada acesso ao dashboard faz queries pesadas ao BD VPS + chamada BCB API. Sem debounce de sync.

**Correcao**: Integrar Redis (ja disponivel na infra Docker). Implementar wrapper de cache nos services criticos.

---

## GAPS MODERADOS — Backend

### GAP-11: Integracao com servicos internos ausente

| Servico | Legado | Atlas | Prioridade |
|---------|--------|-------|-----------|
| CRM Q2P (recebiveis) | getCRMRecebiveis() | N/A | Baixa* |
| CRM Q2P (pedidos) | getCRMPedidosVenda() | N/A | Baixa* |
| Forecast (pedidos planejados) | getForecastPedidos() | N/A | Baixa* |
| Forecast (lead times) | getForecastLeadTimes() | N/A | Baixa* |
| Forecast (sazonalidade) | getForecastSazonalidade() | N/A | Baixa* |
| Comex (transito) | getComexTransito() | N/A | Media |
| Comex (DIs abertas) | getComexDIsAbertas() | N/A | Baixa |
| Breaking Point (credito) | getBreakingLinhasCredito() | N/A | Baixa |
| Breaking Point (margem) | getBreakingMargemAtual() | N/A | Baixa |

*Estes servicos sao outros modulos vibecode ainda nao migrados. O legado tem fallbacks para todos eles. O Atlas deveria ter pelo menos o **pattern de fallback** pronto para quando os modulos migrarem.

**Correcao**: No minimo, criar stubs com fallback gracioso para `getComexTransito()` (usado no estoque) e `getCRMRecebiveis()` (usado na posicao). Os demais podem esperar.

---

### GAP-12: Estoque retorna dados agregados, nao individuais

| Item | Legado | Atlas |
|------|--------|-------|
| Array `itens` | Cada produto individual | Nao retorna |
| `transito_maritimo` | Array de carregamentos | Nao existe |
| `total_transito_usd` | Soma de USD em transito | Nao existe |
| Filtro por localidades_ativas | No query de itens | No query agregado |

**Arquivo legado**: `routes/estoque.js:79-120`  
**Arquivo Atlas**: `services/estoque.service.ts:21-57`  

**Impacto**: Frontend nao pode mostrar itens individuais nem dados de transito maritimo. Funcionalidade parcial.

**Correcao**: Adicionar endpoint ou parametro para retornar itens individuais. Integrar dados de transito via vw_hedge_importacoes.

---

### GAP-13: Alertas nao sao gerados automaticamente

| Item | Legado | Atlas |
|------|--------|-------|
| Gerados no sync | Sim, para falhas | Nao (sem sync) |
| Gerados no motor | Sim, para sub-hedged | Nao (funcao existe mas nao chamada) |
| Gerados para PTAX | Sim, se fora do range | Nao |
| Tipos usados | critico, atencao, info, ndf | gap_cobertura (unico tipo) |

**Arquivo legado**: `services/bcb.service.js:51-53`, `services/omie.service.js:74-78`, `jobs/sync.job.js:45-50`  
**Arquivo Atlas**: `services/alerta.service.ts:8-36` (funcao `gerarAlertas` existe mas nunca e chamada)  

**Impacto**: Pagina de alertas sempre vazia. Nenhum alerta e gerado em nenhum fluxo.

**Correcao**: Chamar `gerarAlertas(buckets)` apos recalcularBuckets. Adicionar geracao de alertas no PTAX service. Quando sync existir, gerar alertas para falhas.

---

### GAP-14: Parametros operacionais incompletos

| Parametro | Legado (default) | Atlas |
|-----------|-----------------|-------|
| `camada1_ajuste_ep` | 8 (pp) | Nao configuravel (hardcoded) |
| `desvio_padrao_brl` | 3.76 (pp/mes) | Nao existe |
| `custo_financiamento_pct` | 5.5 (% a.a.) | Nao existe |
| `prazo_recebimento` | 38 (dias) | Listado no frontend mas sem uso backend |
| `transit_medio_dias` | 80 (dias) | Listado no frontend mas sem uso backend |
| `giro_estoque_dias` | 30 (dias) | Listado no frontend mas sem uso backend |

**Correcao**: Garantir que todos os parametros da Config Page tenham seed values no configMotor. Usar `camada1_ajuste_ep` no motor em vez de hardcoded 68. Os demais (desvio_padrao, custo_financiamento) sao usados em calculos acessorios do legado — avaliar necessidade.

---

### GAP-15: NDF liquidacao calcula resultado diferente

| Item | Legado | Atlas |
|------|--------|-------|
| Input | `resultado_brl` (valor direto) | `ptax_liquidacao` (calcula internamente) |
| Formula | Nao calcula — recebe o valor final | `notional * (taxa_ndf - ptax_liquidacao)` |

**Arquivo legado**: `routes/ndf.js:94-96`  
**Arquivo Atlas**: `services/ndf.service.ts:112-117`  

**Impacto**: No legado, o usuario informa o resultado real (do banco). No Atlas, o sistema calcula. A abordagem Atlas e mais correta mas diferente. **Este nao e um bug — e uma melhoria.** Manter a abordagem Atlas.

**Status**: OK — nao precisa corrigir. Documentar a diferenca.

---

## GAPS FRONTEND

### GAP-F1: Localidade Selector ausente no dashboard

O legado tem checkboxes para selecionar quais localidades de estoque contribuem para o calculo de exposicao. O Atlas tem a API (`GET /PUT localidades`) mas o frontend nao renderiza o seletor.

**Correcao**: Adicionar grid de checkboxes no InventoryPage ou ConfigPage.

---

### GAP-F2: Motor nao mostra custo da acao

A tabela de recomendacoes no MotorMVPage mostra `Posicao USD`, `NDF a contratar`, `Instrumento`, `Cobertura Alvo`. Falta: `Taxa NDF`, `Custo BRL`, `Prioridade`, `Acao Recomendada`.

**Correcao**: Depende de GAP-02 (backend retornar esses campos). Apos correcao backend, adicionar colunas.

---

### GAP-F3: Dashboard sem variacao PTAX 30d

O legado mostra variacao percentual da PTAX nos ultimos 30 dias. O Atlas nao mostra.

**Correcao**: Calcular `variacao_30d_pct` no PTAX service e retornar na posicao.

---

### GAP-F4: Config sem status de sync

O legado mostra status de conexao BD VPS e BCB. O Atlas nao mostra.

**Correcao**: Depende de GAP-05 (sync pipeline). Apos implementar, adicionar cards de status na Config Page.

---

### GAP-F5: Simulacao com menos cenarios

Frontend espera 13 cenarios (step 0.25). Legado gerava 30 (step 0.10). Menos granularidade no grafico.

**Correcao**: Mudar step para 0.10 no backend (GAP-07) e atualizar frontend para `interval` adequado.

---

### GAP-F6: Grafico Motor MV usa valores locais

Os graficos "Custo vs Protecao" e "Simulacao Margem" no MotorMVPage usam calculos no **frontend** com `spotRate` e `ndf90Rate` dos sliders. O legado fazia esse calculo no **backend** com dados reais.

**Correcao**: Idealmente, esses graficos deveriam usar dados da API (simulacao backend), nao calculos locais. Enquanto nao migrar, documentar que os valores sao aproximativos.

---

### GAP-F7: NDF sem campo banco no formulario

O formulario de criacao de NDF no NDFListPage nao tem campo para `banco` (contraparte). O legado tem.

**Correcao**: Depende de GAP-08 (schema). Apos adicionar campo, incluir select no formulario.

---

## PLANO DE FECHAMENTO DE GAPS

### Fase 1 — Critico (bloqueia fidelidade de calculo)

| # | Gap | Esforco | Arquivos |
|---|-----|---------|----------|
| 1 | GAP-01 | 2h | posicao.service.ts, schema hedge.ts (add estNaoPagoUsd a bucketMensal) |
| 2 | GAP-04 | 1h | motor.service.ts (ler params do configMotor) |
| 3 | GAP-02 | 2h | motor.service.ts (lookup taxa, calcular custo, retornar campos extras) |
| 4 | GAP-03 | 1h | motor.service.ts + hedge.routes.ts (retornar alertas, persistir) |
| 5 | GAP-09 | 1h | Validar view SQL vw_hedge_resumo no BD VPS (pode precisar de mim) |
| 6 | GAP-13 | 1h | hedge.routes.ts (chamar gerarAlertas apos recalcularBuckets) |

**Subtotal Fase 1**: ~8h

### Fase 2 — Importante (infraestrutura de dados)

| # | Gap | Esforco | Arquivos |
|---|-----|---------|----------|
| 7 | GAP-05 | 4h | Novo sync.service.ts + sync.job.ts + rotas sync |
| 8 | GAP-06 | 2h | ptax.service.ts (validacao, variacao, cache) |
| 9 | GAP-10 | 2h | Wrapper Redis em services criticos |
| 10 | GAP-08 | 2h | ndf.service.ts + schema (banco, duplicata, validacao, audit) |

**Subtotal Fase 2**: ~10h

### Fase 3 — Funcionalidade completa (paridade UI)

| # | Gap | Esforco | Arquivos |
|---|-----|---------|----------|
| 11 | GAP-07 | 1h | simulacao.service.ts (step 0.10, aceitar l1/l2) |
| 12 | GAP-14 | 1h | Seed configMotor + motor ler todos params |
| 13 | GAP-12 | 2h | estoque.service.ts (itens individuais, transito) |
| 14 | GAP-F1 | 1h | InventoryPage.tsx (checkbox grid) |
| 15 | GAP-F2 | 1h | MotorMVPage.tsx (colunas extras na tabela) |
| 16 | GAP-F7 | 0.5h | NDFListPage.tsx (campo banco) |

**Subtotal Fase 3**: ~6.5h

### Fase 4 — Nice-to-have (paridade total)

| # | Gap | Esforco | Arquivos |
|---|-----|---------|----------|
| 17 | GAP-11 | 3h | Stubs + fallbacks para servicos internos |
| 18 | GAP-F3 | 0.5h | ptax.service.ts + dashboard |
| 19 | GAP-F4 | 1h | ConfigPage.tsx (sync status cards) |
| 20 | GAP-F5 | 0.5h | Frontend interval adjustment |
| 21 | GAP-F6 | 2h | Migrar calculos do frontend pro backend |

**Subtotal Fase 4**: ~7h

---

## TOTAL ESTIMADO: ~31.5h de trabalho

### Prioridade de execucao sugerida

```
Fase 1 (Calculos corretos)     → GAP-01, GAP-04, GAP-02, GAP-03, GAP-09, GAP-13
Fase 2 (Infraestrutura)        → GAP-05, GAP-06, GAP-10, GAP-08
Fase 3 (Paridade funcional)    → GAP-07, GAP-14, GAP-12, GAP-F1, GAP-F2, GAP-F7
Fase 4 (Polimento)             → GAP-11, GAP-F3, GAP-F4, GAP-F5, GAP-F6
```

---

## ITENS QUE NAO SAO GAPS (ja OK no Atlas)

- **Motor 3 camadas (L1/L2/L3)**: Formula identica ao legado
- **Selecao de instrumento por prazo**: Identica (Trava/NDF 30-180d)
- **NDF state machine**: Mesmas transicoes (pendente/ativo/liquidado/cancelado)
- **NDF custo na criacao**: `notional * (taxa - ptax)` — identico
- **NDF liquidacao**: Atlas calcula internamente (melhoria vs legado)
- **Bucket aggregation from OMIE view**: Correto
- **Estoque via vw_hedge_estoque**: Correto
- **Localidades selection + persistencia**: API correta
- **Alertas CRUD (listar/lido/resolver)**: Correto
- **Config CRUD (get/update)**: Correto
- **Taxas NDF insert/list**: Correto
- **PTAX fetch BCB + persist**: Correto (falta validacao)
- **Posicao historico (snapshots)**: Correto
- **Decimal.js para aritmetica financeira**: Correto e melhor que legado
- **Frontend: Dashboard KPIs, Donut, Bar, Line charts**: Correto
- **Frontend: NDF CRUD completo com modais**: Correto
- **Frontend: Motor slider + debounce + keepPreviousData**: Correto

---

## VALIDACAO DE VIEWS SQL (2026-04-13)

### vw_hedge_resumo — VALIDADA OK

Formula de `pct_nao_pago`:
```sql
LEAST(round(total_pagar_brl / NULLIF(est_importado_brl, 0) * 100), 100)
```
Identica ao legado: `Math.min(Math.round(totalPagarBRL / estImportadoBRL * 100), 100)`.

Valores atuais: total_pagar_brl=55M / est_importado_brl=9.2M = 597% → capped at 100%. OK.

`exposicao_usd_total` = `total_pagar_usd + est_nao_pago_usd` = 10.95M + 1.83M = 12.78M. OK.

### vw_hedge_pagar_usd — VALIDADA OK (com ressalvas)

- Filtra `exterior='S'` + status IN ('A VENCER','ATRASADO','VENCE HOJE'). OK.
- Categorias: `2.01.%` (mercadoria) e `2.10.%` (despesas importacao). OK.
- Match com pedidos_comex via parcelas (ate 9 parcelas). OK.
- **Ressalva**: `valor_usd = valor_documento / ptax_atual` — usa PTAX corrente, nao PTAX da NF. Consistente com legado.

### vw_hedge_receber_usd — VALIDADA OK

- Filtra status IN ('A VENCER','ATRASADO','VENCE HOJE') + data_vencimento >= CURRENT_DATE - 90d. OK.

### vw_hedge_importacoes — VALIDADA OK

- Fonte: `tbl_dadosPlanilhaFUPComex` (planilha FUP digitalizada).
- Status: nacionalizado/em_porto/em_transito/aguardando_embarque. OK.
- Filtra `recebido_na_acxe <> 'true'` (exclui mercadoria ja recebida). OK.

### vw_hedge_estoque — VALIDADA OK

A view usa **codigos de local hardcoded** em CTEs. Investigacao inicial sugeriu bug
nos locais Q2P, mas Flavio esclareceu: **estoques importados do Q2P sao replicas
dos da ACXE via sistema integrador**. Incluir ambos causaria dupla contagem.

**Regra de negocio**: ACXE e Q2P usam um integrador que espelha estoques importados.
O estoque fisico importado pertence a ACXE. O Q2P apenas ve uma replica.
Somente os locais **nacionais** do Q2P sao estoque proprio.

**Mapeamento de espelhamento ACXE → Q2P (replica):**
| ACXE (incluso) | Q2P (excluido — replica) | Descricao |
|----------------|--------------------------|-----------|
| 4498926061 | 8115873724 | SANTO ANDRE (IMPORTADO) |
| 4498926337 | 8115873874 | SANTO ANDRE (IMPORTADO) |
| 4776458297 | 8042180936 | ARMAZEM EXTERNO |
| 4004166399 | 7960459966 | EXTREMA |
| 4503767789 | 8429029971 | TRANSITO |

**ACXE locais incluidos na view (correto):**
| Codigo | Descricao | Origem | Valor BRL |
|--------|-----------|--------|-----------|
| 4498926061 | SANTO ANDRE (IMPORTADO) | importado_no_chao | R$ 2,655K |
| 4498926337 | SANTO ANDRE (IMPORTADO) | importado_no_chao | R$ 4,799K |
| 4776458297 | ARMAZEM EXTERNO | importado_no_chao | R$ 66K |
| 4004166399 | EXTREMA | importado_no_chao | R$ 1,689K |
| 4503767789 | TRANSITO | em_transito | R$ 9,749K |

**Q2P locais incluidos na view (correto — somente nacionais):**
| Codigo | Descricao | Origem | Valor BRL |
|--------|-----------|--------|-----------|
| 8123584710 | SANTO ANDRE (NACIONAL) | nacional | R$ 4,510K |
| 8123584481 | SANTO ANDRE (NACIONAL) | nacional | R$ 0 |

**ACXE locais excluidos (intencional):**
PROCESSO (R$ 46M), PRODUCAO (R$ 19M), CONSUMO (R$ 643K) — estoques internos/WIP, nao relevantes para hedge.

**Atencao futura**: Se um novo local de estoque for criado no OMIE, a view precisa ser
atualizada manualmente (hardcoded codes). Considerar futuramente migrar para logica
baseada em flag/categoria em vez de codigos fixos.

---

## BANCOS PARCEIROS (consultados em 2026-04-13)

Fonte: `tbl_contasCorrentes_ACXE` e `tbl_contasCorrentes_Q2P` (contas ativas).

**Bancos para NDF (campo `banco`):**

| Banco | ACXE | Q2P |
|-------|------|-----|
| Banco do Brasil | X | X |
| Bradesco | X | X |
| Itau Unibanco | X | X |
| Santander | X | X |
| Safra | | X |
| Banco Daycoval | | X |
| BMP Money Plus | | X |

*Excluidos: contas DESCONTO, Caixinha, MasterCard, Omie.CASH, PDV — nao sao contrapartes de NDF.*

---

## DECISOES DO FLAVIO (registradas 2026-04-13)

### 1. GAP-05 (Sync) — DECIDIDO: n8n

- Usar n8n da infraestrutura existente (webhook trigger).
- **UX obrigatoria**: Botao "Atualizar" no frontend dispara webhook n8n.
  - Ao clicar: botao fica desabilitado + indicador visual de progresso.
  - Quando n8n termina: callback reativa o botao.
  - Importante: sync de contas a pagar/receber demora minutos.
- Implementacao: API expoe endpoint que dispara webhook n8n + polling/SSE para status.

### 2. GAP-09 (% nao pago) — VALIDADO OK

- View `vw_hedge_resumo` usa formula identica ao legado. Numeros conferem.
- Porem: depende de `vw_hedge_estoque` que tem bug (Q2P importado excluido).
- Apos corrigir a view de estoque, os numeros do resumo serao mais precisos.
- **Anotar todas as mudancas de view para migrations de producao.**

### 3. GAP-08 (NDF banco) — DECIDIDO: usar tabela de contas correntes

- Campo `banco` sera preenchido com select baseado nos bancos ativos.
- Fonte: `tbl_contasCorrentes_Q2P` + `tbl_contasCorrentes_ACXE` (coluna `descricao`).
- Filtrar: `inativo = 'N'`, excluir contas de desconto/caixinha/cartao.
- Lista final: BB, Bradesco, Itau, Santander, Safra, Daycoval, BMP.

### 4. GAP-11 (Servicos internos) — ESCLARECIDO

O legado tinha `internal.service.js` com chamadas HTTP para 4 modulos (todos localhost):
- **CRM Q2P** (`:3001`) → recebiveis, pedidos venda
- **Forecast Planner** (`:3002`) → pedidos planejados, lead times, sazonalidade
- **Comex Insight** (`:3003`) → transito, DIs abertas, custo por DI
- **Breaking Point** (`:3004`) → linhas de credito, margem

No Atlas monolito, esses modulos serao **funcoes internas** (nao HTTP entre containers).
Dados ja disponíveis no BD (views OMIE) substituem parte dessas chamadas:
- `vw_hedge_importacoes` ja fornece dados de transito (substitui ComexInsight parcialmente).
- `vw_hedge_receber_usd` ja fornece recebiveis (substitui CRM parcialmente).
- Forecast vem da planilha `Planejador de Compras - Rev Latest.xlsm` (legacy/vibecodes/forecast/).
- Comex vem da planilha `FUP - ACXE Rev 1.10.1` (legacy/vibecodes/comexflow/).
- Breaking Point sera criado do zero no Atlas.
- CRM em desenvolvimento — conectar via OMIE ou BD quando pronto.

**Decisao**: Nao implementar HTTP clients. Usar dados do BD diretamente onde possivel.

### 5. GAP-15 (NDF liquidacao) — DECIDIDO: manter input manual

Flavio esclareceu: o banco pode aplicar taxas diferentes do PTAX na liquidacao.
O resultado real pode divergir do calculo `notional * (taxa_ndf - ptax)`.

**Correcao**: Mudar a liquidacao para aceitar `resultado_brl` direto (como o legado faz),
OU aceitar ambos: `ptax_liquidacao` (calcula automaticamente) + `resultado_brl` (override manual).
A segunda opcao e mais flexivel — o usuario pode usar o calculo automatico como sugestao
e ajustar se o banco cobrou diferente.
