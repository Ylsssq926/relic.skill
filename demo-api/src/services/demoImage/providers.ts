import OpenAI from 'openai';
import sharp from 'sharp';

import { buildPollinationsFallbackUrl, buildPollinationsUrl } from '../coverService';
import type {
  DemoImageBrief,
  DemoImageProviderId,
  DemoImageProviderPlan,
  DemoImagePromptSnapshot,
  ExecuteDemoImageProviderInput,
  ExecutedDemoImage,
} from './types';

const OPENAI_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_IMAGE_FETCH_MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 1_500;

function hasRequiredEnv(env: NodeJS.ProcessEnv, keys: readonly string[]): boolean {
  return keys.every((key) => typeof env[key] === 'string' && env[key]!.trim().length > 0);
}

function normalizeContentType(format: string | undefined): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function getOpenAiSize(brief: DemoImageBrief): '1024x1024' | '1536x1024' {
  return brief.variant === 'cover' ? '1536x1024' : '1024x1024';
}

function getManifestOnlyAvailability(): 'manifest-only' {
  return 'manifest-only';
}

export const supportedDemoImageProviders: readonly DemoImageProviderId[] = [
  'pollinations',
  'openai',
  'google',
  'openrouter',
  'replicate',
] as const;

export function buildDemoImageProviderPlan(
  providerId: DemoImageProviderId,
  brief: DemoImageBrief,
  prompt: DemoImagePromptSnapshot,
  env: NodeJS.ProcessEnv = process.env,
): DemoImageProviderPlan {
  switch (providerId) {
    case 'pollinations': {
      const sourceUrl = buildPollinationsUrl(prompt.positive, brief.requestWidth, brief.requestHeight, brief.seed);
      const fallbackSourceUrl = buildPollinationsFallbackUrl(prompt.positive, brief.requestWidth, brief.requestHeight, brief.seed);
      return {
        providerId,
        displayName: 'Pollinations',
        implementationMode: 'live',
        availability: 'ready',
        requiredEnv: [],
        request: {
          transport: 'url',
          method: 'GET',
          endpoint: 'https://image.pollinations.ai/prompt/{prompt}',
          model: 'flux',
          sourceUrl,
          fallbackSourceUrl,
          query: {
            width: String(brief.requestWidth),
            height: String(brief.requestHeight),
            model: 'flux',
            enhance: 'true',
            nologo: 'true',
            seed: String(brief.seed),
          },
          notes: [
            '无需 API key，可直接请求 URL。',
            '先取主 URL，失败时再尝试 fallback URL。',
          ],
        },
        taskList: [
          '使用 brief 和 prompt 生成 Pollinations 请求 URL',
          '下载原始图片 buffer',
          '按目标尺寸裁切并导出到 demo-site/public/images/relics',
          '把 prompt、plan、输出文件名写入 manifest 快照',
        ],
      };
    }

    case 'openai': {
      const requiredEnv = ['OPENAI_API_KEY'];
      return {
        providerId,
        displayName: 'OpenAI Images',
        implementationMode: 'live',
        availability: hasRequiredEnv(env, requiredEnv) ? 'ready' : 'missing-env',
        requiredEnv,
        request: {
          transport: 'sdk',
          method: 'POST',
          endpoint: 'openai.images.generate',
          model: OPENAI_IMAGE_MODEL,
          body: {
            model: OPENAI_IMAGE_MODEL,
            prompt: prompt.positive,
            size: getOpenAiSize(brief),
            quality: 'high',
            output_format: brief.exportFormat === 'png' ? 'png' : 'jpeg',
            output_compression: 100,
            moderation: 'auto',
            background: 'auto',
          },
          notes: [
            '本轮使用 openai SDK 的 images.generate。',
            'cover 映射到 1536x1024，avatar 映射到 1024x1024。',
          ],
        },
        taskList: [
          '校验 OPENAI_API_KEY',
          '调用 openai.images.generate 生成单张图片',
          '如果返回 b64_json，直接解码为 buffer；如果返回 url，再下载',
          '按目标尺寸裁切并导出最终文件',
        ],
      };
    }

    case 'google': {
      const requiredEnv = ['GOOGLE_API_KEY'];
      return {
        providerId,
        displayName: 'Google Imagen / Gemini',
        implementationMode: 'manifest-only',
        availability: getManifestOnlyAvailability(),
        requiredEnv,
        request: {
          transport: 'http',
          method: 'POST',
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/images:generate',
          model: 'imagen-3.0-generate-002',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': '${GOOGLE_API_KEY}',
          },
          body: {
            prompt: prompt.positive,
            negativePrompt: prompt.negative,
            aspectRatio: brief.variant === 'cover' ? '16:9' : '1:1',
            safetyFilterLevel: 'BLOCK_ONLY_HIGH',
          },
          notes: [
            '本轮先输出 Google 方案 manifest，不执行真实调用。',
            '后续可接参考图与 style customization。',
          ],
        },
        taskList: [
          '准备统一 style reference 和参考图资产',
          '校验 GOOGLE_API_KEY 与模型权限',
          '将 prompt、negative prompt、目标比例写入正式请求',
        ],
      };
    }

    case 'openrouter': {
      const requiredEnv = ['OPENROUTER_API_KEY'];
      return {
        providerId,
        displayName: 'OpenRouter Image Model',
        implementationMode: 'manifest-only',
        availability: getManifestOnlyAvailability(),
        requiredEnv,
        request: {
          transport: 'http',
          method: 'POST',
          endpoint: 'https://openrouter.ai/api/v1/images/generations',
          model: 'openrouter/auto-image',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ${OPENROUTER_API_KEY}',
          },
          body: {
            model: 'openrouter/auto-image',
            prompt: prompt.positive,
            negative_prompt: prompt.negative,
            size: `${brief.requestWidth}x${brief.requestHeight}`,
          },
          notes: [
            '本轮作为可替换 provider 清单输出，不执行真实调用。',
            '后续可根据实际接入的图片模型替换 model 字段。',
          ],
        },
        taskList: [
          '确定 OpenRouter 上实际要用的图片模型',
          '补充账号鉴权和响应解析逻辑',
          '接入后复用同一套 brief 与 prompt 快照',
        ],
      };
    }

    case 'replicate': {
      const requiredEnv = ['REPLICATE_API_TOKEN'];
      return {
        providerId,
        displayName: 'Replicate',
        implementationMode: 'manifest-only',
        availability: getManifestOnlyAvailability(),
        requiredEnv,
        request: {
          transport: 'http',
          method: 'POST',
          endpoint: 'https://api.replicate.com/v1/predictions',
          model: 'black-forest-labs/flux-dev',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Token ${REPLICATE_API_TOKEN}',
          },
          body: {
            version: 'black-forest-labs/flux-dev',
            input: {
              prompt: prompt.positive,
              negative_prompt: prompt.negative,
              width: brief.requestWidth,
              height: brief.requestHeight,
              seed: brief.seed,
            },
          },
          notes: [
            '本轮先输出 Replicate 任务清单和请求骨架。',
            '后续可替换成更适合统一风格的模型或 fine-tune。',
          ],
        },
        taskList: [
          '选择最终模型或自定义 fine-tune 版本',
          '补齐 prediction 轮询与下载逻辑',
          '为风格锁定准备参考图与版本化参数',
        ],
      };
    }

    default: {
      const exhaustiveCheck: never = providerId;
      throw new Error(`未支持的 provider: ${String(exhaustiveCheck)}`);
    }
  }
}

function shouldRetryImageRequest(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function resolveRetryDelayMilliseconds(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const numericSeconds = Number(retryAfterHeader.trim());
    if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
      return Math.floor(numericSeconds * 1_000);
    }

    const retryAt = Date.parse(retryAfterHeader);
    if (Number.isFinite(retryAt)) {
      return Math.max(0, retryAt - Date.now());
    }
  }

  return DEFAULT_RETRY_DELAY_MS * attempt;
}

async function wait(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchImageBuffer(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string; source: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DEFAULT_IMAGE_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const error = new Error(`图片请求失败: HTTP ${response.status}`);
        if (attempt < DEFAULT_IMAGE_FETCH_MAX_ATTEMPTS && shouldRetryImageRequest(response.status)) {
          await wait(resolveRetryDelayMilliseconds(attempt, response.headers.get('retry-after')));
          lastError = error;
          continue;
        }

        throw error;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        throw new Error(`未返回有效图片 content-type: ${contentType}`);
      }

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType,
        source: sourceUrl,
      };
    } catch (error) {
      lastError = error;
      if (attempt < DEFAULT_IMAGE_FETCH_MAX_ATTEMPTS) {
        await wait(resolveRetryDelayMilliseconds(attempt, null));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('图片下载失败');
}

export { resolveRetryDelayMilliseconds, shouldRetryImageRequest };

async function executePollinationsPlan(input: ExecuteDemoImageProviderInput): Promise<ExecutedDemoImage> {
  const sourceUrls = [input.plan.request.sourceUrl, input.plan.request.fallbackSourceUrl].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  let lastError: unknown;

  for (const sourceUrl of sourceUrls) {
    try {
      const result = await fetchImageBuffer(sourceUrl);
      return {
        providerId: 'pollinations',
        source: result.source,
        contentType: result.contentType,
        buffer: result.buffer,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Pollinations 执行失败');
}

async function downloadOpenAiUrl(url: string, format: string | undefined): Promise<ExecutedDemoImage> {
  const downloaded = await fetchImageBuffer(url);
  return {
    providerId: 'openai',
    source: url,
    contentType: downloaded.contentType || normalizeContentType(format),
    buffer: downloaded.buffer,
  };
}

async function executeOpenAiPlan(input: ExecuteDemoImageProviderInput): Promise<ExecutedDemoImage> {
  const apiKey = input.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY');
  }

  const rawRequestBody = input.plan.request.body;
  if (!rawRequestBody) {
    throw new Error('OpenAI 方案缺少请求体');
  }

  const requestBody = rawRequestBody as unknown as OpenAI.Images.ImageGenerateParamsNonStreaming;
  const client = new OpenAI({ apiKey });
  const response = await client.images.generate(requestBody);
  const firstImage = response.data?.[0];

  if (!firstImage) {
    throw new Error('OpenAI 未返回图片数据');
  }

  if (firstImage.b64_json) {
    const outputFormat = typeof response.output_format === 'string'
      ? response.output_format
      : typeof requestBody.output_format === 'string'
        ? requestBody.output_format
        : undefined;

    return {
      providerId: 'openai',
      source: 'openai:b64_json',
      contentType: normalizeContentType(outputFormat),
      buffer: Buffer.from(firstImage.b64_json, 'base64'),
      revisedPrompt: firstImage.revised_prompt,
    };
  }

  if (firstImage.url) {
    const downloaded = await downloadOpenAiUrl(firstImage.url, typeof requestBody.output_format === 'string' ? requestBody.output_format : undefined);
    return {
      ...downloaded,
      revisedPrompt: firstImage.revised_prompt,
    };
  }

  throw new Error('OpenAI 返回中既没有 b64_json，也没有 url');
}

export async function executeDemoImageProvider(input: ExecuteDemoImageProviderInput): Promise<ExecutedDemoImage> {
  if (input.plan.implementationMode !== 'live') {
    throw new Error(`${input.plan.providerId} 目前只支持 manifest / dry-run 方案`);
  }

  if (input.plan.availability !== 'ready') {
    throw new Error(`${input.plan.providerId} 当前不可执行，状态: ${input.plan.availability}`);
  }

  switch (input.plan.providerId) {
    case 'pollinations':
      return executePollinationsPlan(input);
    case 'openai':
      return executeOpenAiPlan(input);
    case 'google':
    case 'openrouter':
    case 'replicate':
      throw new Error(`${input.plan.providerId} 当前仅输出 manifest，尚未接入真实执行`);
    default: {
      const exhaustiveCheck: never = input.plan.providerId;
      throw new Error(`未知 provider: ${String(exhaustiveCheck)}`);
    }
  }
}

export async function exportGeneratedImage(
  buffer: Buffer,
  brief: DemoImageBrief,
  destination: string,
): Promise<void> {
  const image = sharp(buffer)
    .rotate()
    .resize(brief.width, brief.height, {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: false,
    });

  switch (brief.exportFormat) {
    case 'png':
      await image.png({ compressionLevel: 9 }).toFile(destination);
      break;
    case 'webp':
      await image.webp({ quality: 92 }).toFile(destination);
      break;
    case 'jpeg':
    default:
      await image.jpeg({
        quality: 92,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: '4:4:4',
      }).toFile(destination);
      break;
  }
}

export async function verifyGeneratedImage(destination: string, brief: DemoImageBrief): Promise<void> {
  const metadata = await sharp(destination).metadata();
  if (metadata.width !== brief.width || metadata.height !== brief.height) {
    throw new Error(`图片尺寸不正确: ${destination} => ${metadata.width}x${metadata.height}`);
  }
}
