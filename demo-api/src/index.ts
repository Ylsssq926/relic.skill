import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import express, { type NextFunction, type Request, type Response } from 'express';
import morgan from 'morgan';

import { initializeDatabase, databaseProvider } from './db/database';
import { createAssetsRouter } from './routes/assets';
import { createChatRouter } from './routes/chat';
import { createForgeRouter } from './routes/forge';
import { createRelicRouter } from './routes/relic';
import { ChatService } from './services/chatService';
import { CoverService } from './services/coverService';
import { ForgeService } from './services/forgeService';
import { RelicService } from './services/relicService';
import { errorHandler, notFoundHandler, successResponse } from './utils/errors';
import { logger, requestLoggerStream } from './utils/logger';

const PORT = Number(process.env.PORT ?? 3010);
const DATA_DIRECTORIES = [
  path.resolve(__dirname, '../data/relics'),
  path.resolve(__dirname, '../data/uploads'),
  path.resolve(__dirname, '../data/relics/assets/covers'),
];

async function ensureRuntimeDirectories(): Promise<void> {
  await Promise.all(DATA_DIRECTORIES.map(async (directory) => fs.mkdir(directory, { recursive: true })));
}

function attachRequestContext(request: Request, response: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}

function monitorPerformance(request: Request, response: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (durationMs >= 1_500) {
      logger.warn('检测到慢请求', {
        requestId: response.locals.requestId as string | undefined,
        method: request.method,
        path: request.originalUrl,
        durationMs: Number(durationMs.toFixed(2)),
        statusCode: response.statusCode,
      });
    }
  });

  next();
}

async function bootstrap(): Promise<void> {
  await ensureRuntimeDirectories();
  initializeDatabase();

  const relicService = new RelicService();
  await relicService.syncExampleRelics();

  const coverService = new CoverService(relicService);
  const chatService = new ChatService(relicService);
  const forgeService = new ForgeService(relicService, coverService);

  const app = express();
  app.disable('x-powered-by');

  app.use(attachRequestContext);
  app.use(monitorPerformance);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(morgan((tokens, request, response) => JSON.stringify({
    requestId: response.getHeader('X-Request-Id'),
    method: tokens.method?.(request, response) ?? request.method,
    url: tokens.url?.(request, response) ?? request.originalUrl,
    status: Number(tokens.status?.(request, response) ?? response.statusCode),
    responseTimeMs: Number(tokens['response-time']?.(request, response) ?? 0),
    contentLength: tokens.res?.(request, response, 'content-length') || '0',
  }), {
    stream: requestLoggerStream,
  }));

  app.get('/healthz', (_request, response) => {
    response.json(successResponse({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }));
  });

  app.use('/api/relics', createRelicRouter(relicService));
  app.use('/api/chat', createChatRouter(chatService));
  app.use('/api/forge', createForgeRouter(forgeService));
  app.use('/api/assets', createAssetsRouter(coverService, relicService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    logger.info('demo-api 已启动', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('收到退出信号，准备关闭服务', { signal });
    server.close(() => {
      databaseProvider.close();
      logger.info('HTTP 服务已关闭');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (error) => {
    logger.error('未处理的 Promise 拒绝', {
      error: error instanceof Error ? error : undefined,
    });
  });
  process.on('uncaughtException', (error) => {
    logger.error('未捕获异常', { error });
  });
}

void bootstrap().catch((error) => {
  logger.error('demo-api 启动失败', {
    error: error instanceof Error ? error : undefined,
  });
  process.exit(1);
});
