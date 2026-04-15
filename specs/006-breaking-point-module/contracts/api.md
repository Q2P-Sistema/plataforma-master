# API Contract: Breaking Point

**Base path**: `/api/v1/bp`  
**Auth**: `requireAuth` em todos os endpoints  
**Roles**: `gestor`, `diretor` — `operador` não tem acesso  
**Envelope**: `{ data: T, error: null }` | `{ data: null, error: { code, message } }`

---

## GET /api/v1/bp/projecao

Retorna a projeção completa de 26 semanas com breaking points e KPIs.

**Query params**:
- `empresa` (optional): `'acxe'` | `'q2p'` — default: `'acxe'`

**Response 200**:
```json
{
  "data": {
    "kpis": {
      "saldo_cc": 2140000,
      "dup_total": 4200000,
      "estoque_valor_venda": 1000000,
      "antecip_disp": 560000,
      "finimp_usado": 850000,
      "dup_bloq": 340000,
      "cap_compra_atual": 1250000,
      "cap_compra_med8": 980000,
      "config_incompleta": false
    },
    "breaking_points": {
      "break_caixa": { "semana": 12, "data": "12 jun", "val": -45000 },
      "break_antecip": { "semana": 8, "data": "15 mai", "val": 120000 },
      "break_total": { "semana": 10, "data": "29 mai", "val": -30000 },
      "trava_finimp": { "semana": 6, "data": "01 mai" }
    },
    "semanas": [
      {
        "semana": 0,
        "label": "Hoje",
        "data_fmt": "14 abr",
        "pagamento": 310000,
        "tipo": "Fornecedor",
        "is_finimp": false,
        "rec_dup": 357000,
        "rec_estoque": 0,
        "saldo_cc": 2187000,
        "antecip_disp": 560000,
        "finimp_disp": 1150000,
        "finimp_saldo": 850000,
        "dup_bloq": 340000,
        "dup_livre": 3860000,
        "liquidez_total": 3104000,
        "gap": 2794000,
        "cap_compra": 1250000,
        "estoque_rest": 1000000,
        "status_gap": "ok"
      }
    ],
    "sync_at": "2026-04-14T10:30:00Z"
  },
  "error": null
}
```

**Notas**:
- `kpis.config_incompleta = true` se todos os limites bancários estiverem zerados
- Valores em BRL (reais inteiros, sem centavos na resposta — arredondado)
- `breaking_points.*` = null se evento não detectado nas 26 semanas
- Cache de 5 minutos; invalida ao salvar parâmetros

---

## GET /api/v1/bp/params

Retorna os parâmetros manuais globais da empresa.

**Query params**:
- `empresa` (optional): default `'acxe'`

**Response 200**:
```json
{
  "data": {
    "empresa": "acxe",
    "dup_antecip_usado": 1800000,
    "markup_estoque": 0.22,
    "alerta_gap_limiar": 300000,
    "cat_finimp_cod": "2.01.01",
    "updated_at": "2026-04-13T14:00:00Z"
  },
  "error": null
}
```

---

## PUT /api/v1/bp/params

Atualiza parâmetros globais da empresa.

**Body**:
```json
{
  "empresa": "acxe",
  "dup_antecip_usado": 1800000,
  "markup_estoque": 0.22,
  "alerta_gap_limiar": 300000,
  "cat_finimp_cod": "2.01.01"
}
```

**Validações**:
- `dup_antecip_usado` ≥ 0
- `markup_estoque` entre 0 e 10 (0% a 1000%)
- `alerta_gap_limiar` ≥ 0
- `cat_finimp_cod` string sem espaços ou null

**Response 200**: `{ "data": { "ok": true }, "error": null }`

---

## GET /api/v1/bp/bancos

Lista todos os bancos configurados para a empresa.

**Query params**:
- `empresa` (optional): default `'acxe'`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid-...",
      "banco_id": "bradesco",
      "banco_nome": "Bradesco",
      "cor_hex": "#CC2929",
      "antecip_limite": 2000000,
      "antecip_usado": 1800000,
      "antecip_taxa": 0.85,
      "antecip_disp": 200000,
      "finimp_limite": 1200000,
      "finimp_usado": 850000,
      "finimp_garantia_pct": 0.40,
      "finimp_disp": 350000,
      "cheque_limite": 300000,
      "cheque_usado": 80000,
      "cheque_disp": 220000,
      "ativo": true,
      "updated_at": "2026-04-13T14:00:00Z"
    }
  ],
  "error": null
}
```

**Nota**: campos `*_disp` são calculados no backend (limite - usado), não persistidos.

---

## POST /api/v1/bp/bancos

Adiciona um banco à estrutura da empresa.

**Body**:
```json
{
  "empresa": "acxe",
  "banco_id": "caixa",
  "banco_nome": "Caixa Econômica",
  "cor_hex": "#005CA9",
  "antecip_limite": 500000,
  "antecip_usado": 0,
  "antecip_taxa": 0.82,
  "finimp_limite": 0,
  "finimp_usado": 0,
  "finimp_garantia_pct": 0.40,
  "cheque_limite": 0,
  "cheque_usado": 0
}
```

**Validações**:
- `banco_id` único por empresa (slug lowercase sem espaços)
- `antecip_taxa` entre 0 e 1
- `finimp_garantia_pct` entre 0 e 1
- Todos os valores numéricos ≥ 0

**Response 201**: `{ "data": { "id": "uuid-..." }, "error": null }`

---

## PUT /api/v1/bp/bancos/:id

Atualiza um banco existente.

**Params**: `id` = UUID do registro

**Body**: mesmos campos do POST (exceto `empresa` e `banco_id` imutáveis após criação)

**Response 200**: `{ "data": { "ok": true }, "error": null }`

---

## DELETE /api/v1/bp/bancos/:id

Remove um banco da estrutura.

**Response 200**: `{ "data": { "ok": true }, "error": null }`

---

## GET /api/v1/bp/contas

Lista contas correntes disponíveis com status de inclusão.

**Query params**:
- `empresa` (optional): default `'acxe'`

**Response 200**:
```json
{
  "data": [
    {
      "n_cod_cc": 123456,
      "descricao": "Bradesco CC 12345-6",
      "codigo_banco": "237",
      "saldo_atual": 1500000,
      "incluir": true
    },
    {
      "n_cod_cc": 789012,
      "descricao": "Sicoob PDV",
      "codigo_banco": "756",
      "saldo_atual": 45000,
      "incluir": false
    }
  ],
  "error": null
}
```

**Nota**: Contas sem registro em `bp_contas_config` são retornadas com `incluir: true` (default inclusivo).

---

## PUT /api/v1/bp/contas/:nCodCC

Atualiza o toggle de uma conta corrente.

**Body**:
```json
{
  "empresa": "acxe",
  "incluir": false
}
```

**Response 200**: `{ "data": { "ok": true }, "error": null }`

---

## Códigos de erro

| Code | HTTP | Descrição |
|------|------|-----------|
| `BP_PARAMS_NOT_FOUND` | 404 | Parâmetros não encontrados para empresa |
| `BP_BANCO_NOT_FOUND` | 404 | Banco não encontrado |
| `BP_BANCO_DUPLICATE` | 409 | banco_id já existe para essa empresa |
| `BP_VALIDATION` | 400 | Falha de validação (campo + mensagem no error) |
| `BP_CONTA_NOT_FOUND` | 404 | Conta corrente não encontrada no OMIE |
