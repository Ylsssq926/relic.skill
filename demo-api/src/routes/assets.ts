import { Router } from 'express';
import { z } from 'zod';

import type { CoverService } from '../services/coverService';
import type { RelicService } from '../services/relicService';
import { ValidationError, asyncHandler, successResponse } from '../utils/errors';

const createCoverSchema = z.object({
  relicId: z.string().trim().min(1).optional(),
  relicType: z.string().trim().min(1).max(50).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(2_000).optional(),
  seed: z.coerce.number().int().optional(),
}).superRefine((value, context) => {
  if (value.relicId || (value.relicType && value.displayName && value.description)) {
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: '请提供 relicId，或同时提供 relicType、displayName、description',
  });
});

const getAssetQuerySchema = z.object({
  variant: z.enum(['original', 'card', 'thumb']).optional(),
  download: z.union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')]).optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('请求参数校验失败', parsed.error.flatten());
  }

  return parsed.data;
}

export function createAssetsRouter(coverService: CoverService, relicService: RelicService): Router {
  const router = Router();

  router.post('/cover', asyncHandler(async (request, response) => {
    const body = parseOrThrow(createCoverSchema, request.body);
    const relic = body.relicId ? relicService.getRelicOrThrow(body.relicId) : null;
    const result = await coverService.generateCover({
      relicId: relic?.id,
      relicType: relic?.type || body.relicType || 'memory',
      displayName: relic?.displayName || body.displayName || '未命名 Relic',
      description: relic?.description || body.description || 'Relic 封面',
      seed: body.seed,
    });

    response.status(201).json(successResponse(result));
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const query = parseOrThrow(getAssetQuerySchema, request.query);
    const assetId = String(request.params.id ?? '');
    const resolved = coverService.resolveAsset(assetId, query.variant ?? 'original');
    response.setHeader('Content-Type', resolved.mimeType);

    const shouldDownload = query.download === '1' || query.download === 'true';
    response.setHeader(
      'Content-Disposition',
      `${shouldDownload ? 'attachment' : 'inline'}; filename="${resolved.fileName}"`,
    );
    response.sendFile(resolved.absolutePath);
  }));

  return router;
}
