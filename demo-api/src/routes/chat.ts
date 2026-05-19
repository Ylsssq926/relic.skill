import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import type { ChatService } from '../services/chatService';
import { ValidationError, asyncHandler, successResponse } from '../utils/errors';

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype.startsWith('audio/')) {
      callback(null, true);
      return;
    }

    callback(new ValidationError('仅支持音频文件上传到语音接口'));
  },
});

const chatMessageSchema = z.object({
  relicId: z.string().trim().min(1),
  message: z.string().trim().min(1).max(8_000),
  stream: z.boolean().optional(),
  historyLimit: z.coerce.number().int().min(1).max(50).optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const voiceBodySchema = z.object({
  relicId: z.string().trim().min(1),
  historyLimit: z.coerce.number().int().min(1).max(50).optional(),
});

const ttsQuerySchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  voice: z.string().trim().min(1).max(50).optional(),
  format: z.enum(['mp3', 'wav', 'opus', 'aac', 'flac']).optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('请求参数校验失败', parsed.error.flatten());
  }

  return parsed.data;
}

export function createChatRouter(chatService: ChatService): Router {
  const router = Router();

  router.post('/', async (request, response, next) => {
    try {
      const body = parseOrThrow(chatMessageSchema, request.body);
      if (body.stream) {
        await chatService.streamMessage(body, response);
        return;
      }

      const result = await chatService.sendMessage(body);
      response.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  });

  router.post('/voice', voiceUpload.single('audio'), asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new ValidationError('请通过 audio 字段上传语音文件');
    }

    const body = parseOrThrow(voiceBodySchema, request.body);
    const result = await chatService.handleVoiceMessage({
      relicId: body.relicId,
      file: request.file,
      historyLimit: body.historyLimit,
    });
    response.json(successResponse(result));
  }));

  router.get('/tts', asyncHandler(async (request, response) => {
    const query = parseOrThrow(ttsQuerySchema, request.query);
    const result = await chatService.synthesizeSpeech(query);

    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Disposition', `inline; filename="relic-tts.${result.fileExtension}"`);
    response.send(result.buffer);
  }));

  router.get('/:relicId', asyncHandler(async (request, response) => {
    const query = parseOrThrow(historyQuerySchema, request.query);
    const relicId = String(request.params.relicId ?? '');
    const messages = chatService.getHistory(relicId, query.limit ?? 50);
    response.json(successResponse({
      relicId,
      messages,
    }));
  }));

  return router;
}
