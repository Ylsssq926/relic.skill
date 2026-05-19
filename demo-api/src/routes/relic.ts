import { Router } from 'express';
import { z } from 'zod';

import type { RelicService } from '../services/relicService';
import { ValidationError, asyncHandler, successResponse } from '../utils/errors';

const listQuerySchema = z.object({
  type: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const createRelicSchema = z.object({
  slug: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(2_000),
  personality: z.string().trim().min(1),
  interaction: z.string().trim().min(1),
  memory: z.string().trim().min(1),
  coverUrl: z.string().trim().url().optional(),
  avatarUrl: z.string().trim().url().optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('请求参数校验失败', parsed.error.flatten());
  }

  return parsed.data;
}

export function createRelicRouter(relicService: RelicService): Router {
  const router = Router();

  router.get('/', asyncHandler(async (request, response) => {
    const query = parseOrThrow(listQuerySchema, request.query);
    const result = relicService.listRelics(query);
    response.json(successResponse(result));
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const relicId = String(request.params.id ?? '');
    const relic = relicService.getRelicOrThrow(relicId);
    response.json(successResponse(relic));
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const body = parseOrThrow(createRelicSchema, request.body);
    const relic = relicService.createRelic(body);
    response.status(201).json(successResponse(relic));
  }));

  return router;
}
