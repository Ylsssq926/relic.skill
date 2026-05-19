import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import type { ForgeService } from '../services/forgeService';
import { ValidationError, asyncHandler, successResponse } from '../utils/errors';

const UPLOAD_DIRECTORY = path.resolve(__dirname, '../../data/uploads');
const MAX_UPLOAD_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/json',
  'application/pdf',
  'text/csv',
  'text/markdown',
  'text/plain',
]);

function isAllowedMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
    || mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
    || ALLOWED_UPLOAD_MIME_TYPES.has(mimeType);
}

function sanitizeFilename(filename: string): string {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'upload';
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
      callback(null, UPLOAD_DIRECTORY);
    },
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname);
      const basename = sanitizeFilename(path.basename(file.originalname, extension));
      callback(null, `${Date.now()}-${crypto.randomUUID()}-${basename}${extension}`);
    },
  }),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE,
    files: 10,
  },
  fileFilter: (_request, file, callback) => {
    if (isAllowedMimeType(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new ValidationError(`不支持的文件类型: ${file.mimetype}`));
  },
});

const extractSchema = z.object({
  assetIds: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().max(2_000).optional(),
  preferredType: z.string().trim().max(50).optional(),
});

const generateSchema = z.object({
  extractionTaskId: z.string().trim().min(1).optional(),
  assetIds: z.array(z.string().trim().min(1)).optional(),
  note: z.string().trim().max(2_000).optional(),
  preferredType: z.string().trim().max(50).optional(),
  generateCover: z.boolean().optional(),
  overrides: z.object({
    displayName: z.string().trim().min(1).max(120).optional(),
    type: z.string().trim().min(1).max(50).optional(),
    description: z.string().trim().min(1).max(2_000).optional(),
    personality: z.string().trim().min(1).optional(),
    interaction: z.string().trim().min(1).optional(),
    memory: z.string().trim().min(1).optional(),
  }).optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('请求参数校验失败', parsed.error.flatten());
  }

  return parsed.data;
}

export function createForgeRouter(forgeService: ForgeService): Router {
  const router = Router();

  router.post('/upload', upload.array('files', 10), asyncHandler(async (request, response) => {
    const files = Array.isArray(request.files) ? request.files : [];
    if (files.length === 0) {
      throw new ValidationError('请至少上传一个素材文件');
    }

    const assets = await forgeService.registerUploads(files);
    response.status(201).json(successResponse({ assets }));
  }));

  router.post('/extract', asyncHandler(async (request, response) => {
    const body = parseOrThrow(extractSchema, request.body);
    const task = forgeService.startExtraction(body);
    response.status(202).json(successResponse(task));
  }));

  router.post('/generate', asyncHandler(async (request, response) => {
    const body = parseOrThrow(generateSchema, request.body);
    const task = forgeService.startGeneration(body);
    response.status(202).json(successResponse(task));
  }));

  router.get('/status/:id', asyncHandler(async (request, response) => {
    const taskId = String(request.params.id ?? '');
    const task = forgeService.getTaskStatus(taskId);
    response.json(successResponse(task));
  }));

  return router;
}
