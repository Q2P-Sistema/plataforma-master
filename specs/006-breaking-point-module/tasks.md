---
description: "Task list for Breaking Point — Projeção de Liquidez"
---

# Tasks: Breaking Point — Projeção de Liquidez

**Input**: Design documents from `/specs/006-breaking-point-module/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Testes do `motor.service.ts` (cálculo financeiro puro) são obrigatórios por Princípio III da Constituição. Testes de rotas e UI são opcionais neste ciclo.

**Organization**: Tarefas agrupadas por user story para permitir MVP incremental. US1 (dashboard) entrega valor isolado mesmo sem as demais.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência incompleta)
- **[Story]**: User story associada (US1..US4)

## Path Conventions (deste projeto)

- Backend: `modules/breakingpoint/src/`
- Migrations/schema: `packages/db/`
- API registration: `apps/api/src/`
- Frontend: `apps/web/src/pages/breakingpoint/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o pacote do módulo e tooling mínimo.

- [X] T001 Atualizar `modules/breakingpoint/package.json` adicionando dependências (`@atlas/core`, `@atlas/auth`, `@atlas/db`, `express`, `zod`) e scripts (`build`, `dev`, `test`)
- [X] T002 [P] Criar `modules/breakingpoint/tsconfig.json` seguindo o padrão do módulo hedge
- [X] T003 [P] Criar `modules/breakingpoint/vitest.config.ts` seguindo o padrão do módulo hedge
- [X] T004 Rodar `pnpm install` na raiz para registrar o workspace

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra de banco, schema e registro de rotas. Bloqueia todas as user stories.

**⚠️ CRITICAL**: Nenhuma user story começa até estas tarefas concluírem.

- [X] T005 Criar migration `packages/db/migrations/0007_breaking_point.sql` com schema `breakingpoint`, 3 tabelas (`bp_params` incluindo `alerta_gap_limiar NUMERIC(15,2) NOT NULL DEFAULT 300000`, `bp_banco_limites`, `bp_contas_config`), índices, triggers de audit em `bp_params`/`bp_banco_limites`, seed de ACXE com 5 bancos default
- [X] T006 Criar Drizzle schema em `packages/db/src/schemas/breakingpoint.ts` (mapear as 3 tabelas com tipos, incluindo campo `alertaGapLimiar` em `bpParams`)
- [X] T007 Re-exportar tipos e schema em `packages/db/src/index.ts` (adicionar bloco `export { breakingpointSchema, bpParams, bpBancoLimites, bpContasConfig, ... } from './schemas/breakingpoint.js';`)
- [X] T008 Aplicar migration no BD de dev (`psql $DATABASE_URL -f packages/db/migrations/0007_breaking_point.sql`) e verificar triggers + seed
- [X] T009 Criar arquivo `modules/breakingpoint/src/index.ts` exportando `bpRouter` (esqueleto inicial)
- [X] T010 Criar arquivo esqueleto `modules/breakingpoint/src/routes/breakingpoint.routes.ts` com Router e middleware `requireAuth`
- [X] T011 Registrar carga dinâmica do `bpRouter` em `apps/api/src/modules.ts` dentro de `registerModuleRoutes` atrás de `config.MODULE_BREAKINGPOINT_ENABLED`
- [X] T012 [P] Adicionar rota placeholder `/breakingpoint` em `apps/web/src/App.tsx` (protegida pelo mesmo padrão do hedge, mas ainda sem layout)

**Checkpoint**: Backend enxerga o módulo, frontend tem rota reservada, BD tem o schema. User stories podem começar.

---

## Phase 3: User Story 1 — Ver projeção de liquidez e alertas (Priority: P1) 🎯 MVP

**Goal**: Gestor abre `/breakingpoint`, vê 4 countdowns (colapso, saldo CC negativo, antecipação esgotada, trava FINIMP), 6 KPIs e o gráfico de 26 semanas — tudo com dados reais do BD.

**Independent Test**: Acessar `/breakingpoint` como `gestor` com dados OMIE presentes. Painel deve exibir countdowns e gráfico sem qualquer configuração prévia (usa seed de defaults).

### Implementação — Backend

- [X] T013 [US1] Implementar `modules/breakingpoint/src/services/dados.service.ts` com funções: `getSaldoCC(empresa)`, `getDupTotal(empresa)`, `getPagamentosSemanais(empresa, catFinimpCod, 26)` (retorna tipo Fornecedor/FINIMP/Op.Corrente conforme FR-011), `getRecebimentosSemanais(empresa, 26)`, `getFinimpSaldo(empresa, catFinimpCod)`, `getFinimpAmortMensal(empresa, catFinimpCod)`, `getEstoqueValor(empresa, markupEstoque)` (retorna valor de venda = custo × (1 + markup) conforme FR-020) — todas raw SQL via `getPool()` em tabelas `public.*`
- [X] T014 [US1] Implementar `modules/breakingpoint/src/services/motor.service.ts` com tipos `MotorInput`/`MotorOutput` e função pura `calcular(input)` executando a lógica de 26 semanas do research.md — sem I/O. `MotorInput` recebe `alertaGapLimiar` (BRL) e classifica status por semana conforme FR-018.
- [X] T015 [P] [US1] Criar testes `modules/breakingpoint/src/__tests__/motor.test.ts` cobrindo: (a) cenário sem breaking point; (b) breaking point em S12; (c) saldo CC negativo desde hoje; (d) trava FINIMP; (e) estoque D+15 com liquidação a 18%/semana; (f) config incompleta (limites zerados + `cat_finimp_cod` nulo) — motor retorna projeção sem quebrar, flag `config_incompleta = true`, e classificação dos pagamentos cai em "Op. Corrente"
- [X] T016 [US1] Implementar endpoint `GET /api/v1/bp/projecao` em `modules/breakingpoint/src/routes/breakingpoint.routes.ts` — integra `dados.service` + `motor.service`, retorna envelope `{ data: { kpis, breaking_points, semanas, sync_at }, error: null }` conforme contracts/api.md
- [X] T017 [P] [US1] Adicionar cache de 5 min ao endpoint usando o mesmo padrão do hedge (`cache.service.ts`) com chave `atlas:bp:projecao:{empresa}`

### Implementação — Frontend

- [X] T018 [US1] Adicionar `BP_SUB_ITEMS` e rotas `/breakingpoint` em `apps/web/src/App.tsx` (remove o placeholder de T012); sub-items: Dashboard, Tabela, Estrutura, Limites, Configurar
- [X] T019 [US1] Criar `apps/web/src/pages/breakingpoint/BPLayout.tsx` — wrapper com `<Outlet />` (sem lógica adicional, apenas navegação compartilhada se necessário)
- [X] T020 [US1] Criar `apps/web/src/pages/breakingpoint/BPDashboardPage.tsx` — TanStack Query lendo `/api/v1/bp/projecao`, renderiza: header com status geral, 4 countdowns animados, 6 KPIs, gráfico `ComposedChart` (Recharts) de 26 semanas com liquidez total + saldo CC + cap. antecip + cap. compras + barras de pagamento, gráfico FINIMP↔Duplicatas Bloqueadas, tooltip customizado por semana
- [X] T021 [P] [US1] Criar componente reutilizável `apps/web/src/pages/breakingpoint/components/Countdown.tsx` (port do `Countdown` do JSX legado) usado no dashboard

**Checkpoint**: MVP funcional. Gestor tem visão completa de risco de caixa com dados reais. Parada natural para validação.

---

## Phase 4: User Story 2 — Configurar parâmetros manuais e toggle de contas (Priority: P2)

**Goal**: Gestor edita limites bancários, taxas, % de garantia FINIMP, markup de estoque, código de categoria FINIMP e seleciona quais contas correntes entram no cálculo.

**Independent Test**: Editar limite de antecipação de um banco. Voltar ao dashboard (US1) e verificar que a projeção recalculou com o novo valor.

### Implementação — Backend

- [X] T022 [US2] Implementar `modules/breakingpoint/src/services/config.service.ts` com funções: `getParams(empresa)`, `updateParams(empresa, data)`, `listBancos(empresa)`, `createBanco(data)`, `updateBanco(id, data)`, `deleteBanco(id)`, `listContas(empresa)` (JOIN com `tbl_contasCorrentes_ACXE` + LEFT JOIN com `bp_contas_config`), `setContaIncluir(nCodCC, empresa, incluir)`
- [X] T023 [US2] Adicionar schemas Zod de validação em `modules/breakingpoint/src/routes/breakingpoint.routes.ts` para: params (markup entre 0-10, dup_antecip_usado ≥ 0, `alerta_gap_limiar` ≥ 0), bancos (taxa/garantia entre 0-1, todos valores ≥ 0), contas (incluir boolean)
- [X] T024 [US2] Implementar endpoints `GET /api/v1/bp/params` e `PUT /api/v1/bp/params` com validação Zod (inclui `alerta_gap_limiar`) e invalidação de cache `atlas:bp:projecao:*` após PUT
- [X] T025 [P] [US2] Implementar endpoints `GET /api/v1/bp/bancos`, `POST /api/v1/bp/bancos`, `PUT /api/v1/bp/bancos/:id`, `DELETE /api/v1/bp/bancos/:id` (calcular campos `*_disp` no response) + invalidação de cache
- [X] T026 [P] [US2] Implementar endpoints `GET /api/v1/bp/contas` e `PUT /api/v1/bp/contas/:nCodCC` + invalidação de cache
- [X] T027 [US2] Atualizar `dados.service.getSaldoCC` para aplicar toggle de `bp_contas_config` (filtrar `nCodCC` com `incluir = false`)
- [X] T028 [US2] Atualizar `dados.service`/`motor.service` para agregar limites bancários (soma `antecip_limite`, média ponderada `antecip_taxa`, soma `finimp_limite`, média ponderada `finimp_garantia_pct`) a partir de `bp_banco_limites WHERE ativo = true`

### Implementação — Frontend

- [X] T029 [US2] Criar `apps/web/src/pages/breakingpoint/BPConfigPage.tsx` com 3 seções: (a) parâmetros globais (form com markup, dup_antecip_usado, alerta_gap_limiar, cat_finimp_cod); (b) lista de bancos editável inline (CRUD completo); (c) lista de contas correntes com checkbox incluir
- [X] T030 [P] [US2] Adicionar toast/feedback de sucesso após salvar e invalidar queries TanStack para forçar refetch do dashboard

**Checkpoint**: Gestor consegue configurar tudo. US1 + US2 = produto completo para uso real.

---

## Phase 5: User Story 3 — Analisar estrutura bancária e limites (Priority: P3)

**Goal**: Gestor visualiza a situação dos limites banco a banco em formato de consulta (sem edição).

**Independent Test**: Acessar aba Estrutura. Valores devem bater 1:1 com a aba Configurar.

- [X] T031 [US3] Criar `apps/web/src/pages/breakingpoint/BPEstruturaBancosPage.tsx` — consome `GET /api/v1/bp/bancos`, exibe card por banco com: logo/cor, nome, 3 barras de progresso (antecip/FINIMP/cheque) com limite/usado/disponível, destaque vermelho quando utilização ≥ 90%
- [X] T032 [P] [US3] Criar `apps/web/src/pages/breakingpoint/BPLimitesPage.tsx` — consome o mesmo endpoint mas agrega: total antecipação (limite/usado/disponível), total FINIMP, total cheque especial; apresentação tipo "dashboard de crédito"

**Checkpoint**: Visão bancária completa em modo leitura.

---

## Phase 6: User Story 4 — Tabela semanal detalhada (Priority: P3)

**Goal**: Gestor vê as 26 semanas em tabela com filtro alerta/crise.

**Independent Test**: Abrir aba Tabela. Valores de cada linha devem bater com o tooltip do gráfico do dashboard para a mesma semana.

- [X] T033 [US4] Criar `apps/web/src/pages/breakingpoint/BPTabelaPage.tsx` — consome `GET /api/v1/bp/projecao` (mesma query que o dashboard), renderiza tabela com: Sem., Data, Tipo, Pagamento, Saldo CC, Cap. Antecip, Cap. Compras, FINIMP, Dup. Bloq, Gap, Status (badge CRISE/ALERTA/OK); toggle "Ver todas" filtra para status != 'ok'

**Checkpoint**: Todas as 4 abas de usuário concluídas.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Amarrar pontas soltas e validar spec end-to-end.

- [X] T034 Adicionar feature flag `MODULE_BREAKINGPOINT_ENABLED` ao `packages/core/src/config.ts` e documentar no `.env.example`
- [X] T035 [P] Adicionar `aria-label` e `role` apropriados nos countdowns, tabelas e formulários (acessibilidade básica)
- [X] T036 [P] Garantir que `BPDashboardPage` mostre aviso visual quando `kpis.config_incompleta === true` (limites zerados)
- [X] T037 [P] Validação manual contra quickstart.md (rodar todos os fluxos descritos)
- [X] T038 Rodar `pnpm test` na raiz e garantir que testes do motor.service passam
- [X] T039 Rodar `pnpm lint` e corrigir violações de `eslint-plugin-boundaries` (se houver)
- [X] T040 Criar commit na branch `006-breaking-point-module` com mensagem `feat(breakingpoint): módulo de projeção de liquidez 26 semanas`
- [X] T041 Validar SC-004 manualmente: comparar valores da tabela (US4) com tooltip do gráfico (US1) para 3 semanas aleatórias; registrar em `specs/006-breaking-point-module/validation_notes.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências.
- **Foundational (Phase 2)**: Depende de Setup. Bloqueia todas as user stories.
- **User Story 1 (Phase 3)**: Depende de Foundational. MVP — pode parar aqui.
- **User Story 2 (Phase 4)**: Depende de Foundational. Independente da US1 funcionalmente, mas em UX se beneficia do dashboard pronto.
- **User Story 3 (Phase 5)**: Depende de US2 (consome os endpoints de `/bp/bancos`). Não depende de US1.
- **User Story 4 (Phase 6)**: Depende de US1 (consome o mesmo endpoint `/projecao`).
- **Polish (Phase 7)**: Depende das user stories entregues.

### Parallel Opportunities

- Dentro do Setup: T002, T003 paralelos.
- Dentro do Foundational: T012 paralelo ao resto (frontend ↔ backend independentes).
- Dentro da US1: T015 (testes) paralelo a T013/T014; T021 paralelo a T020 no frontend.
- Dentro da US2: T025, T026, T030 paralelos (arquivos diferentes).
- Dentro da US3: T031, T032 paralelos.
- Dentro da Phase 7: T035, T036, T037 paralelos.

---

## Parallel Example: User Story 1 (MVP)

```bash
# Após T013 (dados.service) + T014 (motor.service):
Task: "Criar testes motor.test.ts cobrindo 5 cenários" (T015)
Task: "Integrar cache service no endpoint /projecao" (T017)

# Frontend depois do endpoint pronto:
Task: "BPDashboardPage com countdowns+KPIs+gráfico" (T020)
Task: "Componente Countdown reutilizável" (T021)
```

---

## Implementation Strategy

### MVP First (US1)

1. Phases 1–2 (Setup + Foundational)
2. Phase 3 (US1 — Dashboard)
3. **STOP e validar**: gestor abre `/breakingpoint`, vê projeção real com defaults seeded
4. Demo

### Incremental

1. Setup + Foundational
2. US1 → demo (MVP)
3. US2 → demo (ciclo fechado: agora o gestor configura e vê refletir)
4. US3 → demo (estrutura bancária)
5. US4 → demo (tabela detalhada)
6. Polish

### Resumo

- **Total de tarefas**: 41
- **US1 (MVP)**: 9 tarefas (T013–T021)
- **US2**: 9 tarefas (T022–T030)
- **US3**: 2 tarefas (T031–T032)
- **US4**: 1 tarefa (T033)
- **Setup + Foundational**: 12 tarefas (T001–T012)
- **Polish**: 8 tarefas (T034–T041)

---

## Notes

- Toda mutação em `bp_params`/`bp_banco_limites` é capturada por trigger de audit log automaticamente (Princípio IV da Constituição).
- `motor.service.ts` DEVE permanecer puro (sem I/O) para permitir cobertura 90%+ de testes — exigência Princípio III.
- Invalidação de cache é crítica: qualquer PUT/POST/DELETE em config deve invalidar `atlas:bp:projecao:{empresa}`.
- US3 e US4 dependem dos endpoints criados em US1 e US2, mas não dependem da UI dessas stories — podem ser desenvolvidas em paralelo por devs diferentes após US1+US2.
