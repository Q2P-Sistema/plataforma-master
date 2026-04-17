import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createLogger } from '@atlas/core';
import { requireOperador, requireGestor } from '../middleware/role.js';
import {
  listarPorEstagio,
  avancarEstagio,
  LoteNaoEncontradoError,
  TransicaoInvalidaError,
  DadosEstagioFaltandoError,
} from '../services/transito.service.js';
import type { Perfil } from '../types.js';

const logger = createLogger('stockbridge:transito');
const router: Router = Router();

// GET /transito — todos os perfis (filtro de visibilidade e aplicado no service)
router.get('/api/v1/stockbridge/transito', requireOperador, async (req: Request, res: Response) => {
  try {
    const perfil = (req.user?.role ?? 'operador') as Perfil;
    const data = await listarPorEstagio(perfil);
    res.json({ data, error: null });
  } catch (err) {
    logger.error({ err }, 'Erro ao listar transito');
    res.status(500).json({ data: null, error: { code: 'TRANSITO_FAIL', message: (err as Error).message } });
  }
});

const AvancarSchema = z.object({
  proximo_estagio: z.enum(['transito_intl', 'porto_dta', 'transito_interno', 'reservado']),
  di: z.string().min(1).optional(),
  dta: z.string().min(1).optional(),
  nota_fiscal: z.string().min(1).optional(),
  localidade_id: z.string().uuid().optional(),
  dt_prev_chegada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.patch('/api/v1/stockbridge/transito/:lote_id/avancar', requireGestor, async (req: Request, res: Response) => {
  const loteId = req.params.lote_id as string | undefined;
  if (!loteId) {
    res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'lote_id obrigatorio' } });
    return;
  }

  const parsed = AvancarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { code: 'INVALID_INPUT', message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
    });
    return;
  }

  try {
    const result = await avancarEstagio({
      loteId,
      proximoEstagio: parsed.data.proximo_estagio,
      di: parsed.data.di,
      dta: parsed.data.dta,
      notaFiscal: parsed.data.nota_fiscal,
      localidadeId: parsed.data.localidade_id,
      dtPrevChegada: parsed.data.dt_prev_chegada,
    });
    res.json({ data: result, error: null });
  } catch (err) {
    if (err instanceof LoteNaoEncontradoError) {
      res.status(404).json({ data: null, error: { code: 'LOTE_NAO_ENCONTRADO', message: err.message } });
      return;
    }
    if (err instanceof TransicaoInvalidaError) {
      res.status(409).json({ data: null, error: { code: 'TRANSICAO_INVALIDA', message: err.message } });
      return;
    }
    if (err instanceof DadosEstagioFaltandoError) {
      res.status(400).json({ data: null, error: { code: 'DADOS_FALTANDO', message: err.message } });
      return;
    }
    logger.error({ err }, 'Erro ao avancar estagio');
    res.status(500).json({ data: null, error: { code: 'AVANCAR_FAIL', message: (err as Error).message } });
  }
});

export default router;
