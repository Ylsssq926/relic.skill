import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type Database from 'better-sqlite3';
import sharp from 'sharp';

import { getDatabase, withTransaction } from '../db/database';
import { ExternalServiceError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { RelicService } from './relicService';

const DATA_DIRECTORY = path.resolve(__dirname, '../../data');
const GENERATED_COVER_DIRECTORY = path.join(DATA_DIRECTORY, 'relics', 'assets', 'covers');
const POLLINATIONS_BASE_URL = 'https://image.pollinations.ai/prompt';
const DEFAULT_COVER_WIDTH = 832;
const DEFAULT_COVER_HEIGHT = 1216;

interface AssetRow {
  id: string;
  kind: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  relative_path: string;
  width: number | null;
  height: number | null;
  metadata: string | null;
  created_at: number;
}

interface ImageDimension {
  width?: number;
  height?: number;
}

interface AssetVariantMap {
  original: string;
  card: string;
  thumb: string;
}

interface CoverVariantSpec {
  name: keyof AssetVariantMap;
  width: number;
  height: number;
  quality: number;
}

export interface AssetRecord {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface GenerateCoverInput {
  relicId?: string;
  relicType: string;
  displayName: string;
  description: string;
  seed?: number;
}

export interface GeneratedCoverResult {
  asset: AssetRecord;
  prompt: string;
  sourceUrl: string;
  variants: AssetVariantMap;
}

export interface ResolvedAsset {
  asset: AssetRecord;
  absolutePath: string;
  mimeType: string;
  fileName: string;
}

export type RelicCoverVariant = 'cover' | 'avatar' | 'thumb';

export interface GenerateRelicCoverOptions {
  relicType: string;
  displayName: string;
  description: string;
  traits?: string[];
  style?: string;
  mood?: string;
  width?: number;
  height?: number;
  seed?: number;
  variant?: RelicCoverVariant;
  promptAdditions?: string[];
}

export interface GeneratedRelicCoverImage {
  prompt: string;
  sourceUrl: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'asset';
}

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    logger.warn('解析资源元数据失败', {
      metadata,
      error: error instanceof Error ? error : undefined,
    });
  }

  return null;
}

function mapAssetRow(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    kind: row.kind,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    relativePath: row.relative_path,
    width: row.width,
    height: row.height,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

function toRelativeDataPath(absolutePath: string): string {
  return path.relative(DATA_DIRECTORY, absolutePath).replace(/\\/g, '/');
}

export function buildPollinationsUrl(prompt: string, width: number = DEFAULT_COVER_WIDTH, height: number = DEFAULT_COVER_HEIGHT, seed?: number): string {
  const url = new URL(`${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('width', String(width));
  url.searchParams.set('height', String(height));
  url.searchParams.set('model', 'flux');
  url.searchParams.set('enhance', 'true');
  url.searchParams.set('nologo', 'true');
  if (seed !== undefined) {
    url.searchParams.set('seed', String(seed));
  }

  return url.toString();
}

export function buildPollinationsFallbackUrl(prompt: string, width: number = DEFAULT_COVER_WIDTH, height: number = DEFAULT_COVER_HEIGHT, seed?: number): string {
  const url = new URL(`${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('width', String(width));
  url.searchParams.set('height', String(height));
  url.searchParams.set('nologo', 'true');
  if (seed !== undefined) {
    url.searchParams.set('seed', String(seed));
  }

  return url.toString();
}

function buildTypeHints(relicType: string): string[] {
  const normalizedType = relicType.trim().toLowerCase();

  switch (normalizedType) {
    case 'human':
      return ['warm portrait poster', 'gentle eye contact', 'human memory relic', 'warm orange palette', 'soft nostalgic light'];
    case 'pet':
      return ['companion animal portrait', 'cozy light', 'soft fur details', 'lively orange-yellow palette', 'playful expressive energy'];
    case 'team':
      return ['ensemble poster', 'collaborative energy', 'startup atmosphere', 'energetic blue-green palette', 'modern clean workspace'];
    case 'relationship':
      return ['relationship memory poster', 'two-person composition', 'emotional tension', 'soft pink-purple palette'];
    case 'place':
      return ['nostalgic place poster', 'environment-focused composition', 'cinematic scenery', 'nostalgic brown-yellow palette'];
    case 'moment':
      return ['snapshot memory poster', 'film still mood', 'captured fleeting moment', 'cinematic blue-gray palette'];
    case 'memory':
      return ['memory collage poster', 'dreamlike lighting', 'nostalgic atmosphere'];
    default:
      return ['premium key art', 'emotional storytelling', 'cinematic illustration'];
  }
}

function buildMoodHints(mood?: string): string[] {
  const normalizedMood = mood?.trim().toLowerCase();

  switch (normalizedMood) {
    case 'nostalgic':
      return ['nostalgic atmosphere', 'memory glow', 'gentle emotional warmth', 'subtle film-like softness'];
    case 'joyful':
      return ['joyful mood', 'bright cheerful light', 'playful motion', 'inviting warmth'];
    case 'energetic':
      return ['energetic mood', 'dynamic composition', 'optimistic momentum', 'crisp modern lighting'];
    case 'calm':
      return ['calm atmosphere', 'quiet light', 'gentle pacing'];
    case 'tender':
      return ['tender emotion', 'soft intimacy', 'warm affectionate light'];
    default:
      return [];
  }
}

function buildStyleHints(style?: string): string[] {
  const normalizedStyle = style?.trim().toLowerCase();

  switch (normalizedStyle) {
    case 'warm-portrait':
      return ['intimate warm portrait', 'soft natural light', 'gentle facial expression', 'shallow depth of field'];
    case 'realistic-photo':
      return ['realistic photo', 'editorial photography', 'natural texture', 'polished cinematic realism'];
    default:
      return [];
  }
}

function buildVariantHints(variant: RelicCoverVariant = 'cover'): string[] {
  switch (variant) {
    case 'avatar':
      return ['centered composition', 'close-up subject', 'clear silhouette', 'square crop safe framing'];
    case 'thumb':
      return ['readable small-size composition', 'single strong focal point', 'medium shot framing'];
    case 'cover':
    default:
      return ['wide cinematic composition', 'environmental storytelling', 'premium cover image'];
  }
}

export function buildRelicCoverPrompt(input: GenerateRelicCoverOptions): string {
  const description = input.description.trim().replace(/\s+/g, ' ').slice(0, 280);
  const traits = (input.traits ?? [])
    .map((trait) => trait.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
  const promptAdditions = (input.promptAdditions ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  return [
    'premium emotional relic cover image',
    'cinematic storytelling composition',
    'high detail, polished lighting, expressive mood',
    'no text, no logo, no watermark',
    input.displayName.trim(),
    description,
    traits ? `key traits: ${traits}` : '',
    ...buildTypeHints(input.relicType),
    ...buildMoodHints(input.mood),
    ...buildStyleHints(input.style),
    ...buildVariantHints(input.variant),
    ...promptAdditions,
  ].filter(Boolean).join(', ');
}

function buildCoverPrompt(input: GenerateCoverInput): string {
  return buildRelicCoverPrompt({
    relicType: input.relicType,
    displayName: input.displayName,
    description: input.description,
    seed: input.seed,
    variant: 'cover',
  });
}

function extractImageDimensions(metadata: ImageDimension): { width: number | null; height: number | null } {
  return {
    width: typeof metadata.width === 'number' ? metadata.width : null,
    height: typeof metadata.height === 'number' ? metadata.height : null,
  };
}

function extractVariantMap(metadata: Record<string, unknown> | null, asset: AssetRecord): AssetVariantMap {
  const variants = metadata?.variants;

  if (variants && typeof variants === 'object' && !Array.isArray(variants)) {
    const variantRecord = variants as Record<string, unknown>;
    const original = typeof variantRecord.original === 'string' ? variantRecord.original : asset.relativePath;
    const card = typeof variantRecord.card === 'string' ? variantRecord.card : original;
    const thumb = typeof variantRecord.thumb === 'string' ? variantRecord.thumb : original;

    return {
      original,
      card,
      thumb,
    };
  }

  return {
    original: asset.relativePath,
    card: asset.relativePath,
    thumb: asset.relativePath,
  };
}

export async function generateRelicCover(input: GenerateRelicCoverOptions): Promise<GeneratedRelicCoverImage> {
  const relicType = input.relicType.trim();
  const displayName = input.displayName.trim();
  const description = input.description.trim();
  const width = Math.max(64, Math.floor(input.width ?? DEFAULT_COVER_WIDTH));
  const height = Math.max(64, Math.floor(input.height ?? DEFAULT_COVER_HEIGHT));

  if (!relicType || !displayName || !description) {
    throw new ValidationError('生成封面需要 relicType、displayName 和 description');
  }

  const prompt = buildRelicCoverPrompt({
    ...input,
    relicType,
    displayName,
    description,
    width,
    height,
  });
  const candidateUrls = [
    buildPollinationsUrl(prompt, width, height, input.seed),
    buildPollinationsFallbackUrl(prompt, width, height, input.seed),
  ];

  let lastError: unknown;

  for (const sourceUrl of candidateUrls) {
    try {
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new ExternalServiceError(`Pollinations 请求失败: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        throw new ExternalServiceError('Pollinations 未返回有效图片');
      }

      return {
        prompt,
        sourceUrl,
        buffer: rawBuffer,
        contentType,
        width,
        height,
      };
    } catch (error) {
      lastError = error;
      logger.warn('Relic 封面生成请求失败，尝试下一个 provider 配置', {
        sourceUrl,
        error: error instanceof Error ? error : undefined,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ExternalServiceError('Pollinations 图片生成失败');
}

/**
 * 资源与封面服务。
 */
export class CoverService {
  private readonly database: Database.Database;

  public constructor(
    private readonly relicService: RelicService,
    database: Database.Database = getDatabase(),
  ) {
    this.database = database;
  }

  public async registerUpload(file: Express.Multer.File): Promise<AssetRecord> {
    const assetId = crypto.randomUUID();
    const imageMetadata = file.mimetype.startsWith('image/')
      ? await sharp(file.path).metadata()
      : null;
    const dimensions = extractImageDimensions(imageMetadata ?? {});
    const metadata = JSON.stringify({
      source: 'upload',
      originalName: file.originalname,
    });
    const relativePath = toRelativeDataPath(file.path);
    const createdAt = Date.now();

    withTransaction((database) => {
      database.prepare(`
        INSERT INTO assets (id, kind, filename, mime_type, size_bytes, relative_path, width, height, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        assetId,
        'upload',
        file.filename,
        file.mimetype,
        file.size,
        relativePath,
        dimensions.width,
        dimensions.height,
        metadata,
        createdAt,
      );
    });

    return this.getAssetOrThrow(assetId);
  }

  public getAssetById(assetId: string): AssetRecord | null {
    const row = this.database
      .prepare(`
        SELECT id, kind, filename, mime_type, size_bytes, relative_path, width, height, metadata, created_at
        FROM assets
        WHERE id = ?
        LIMIT 1
      `)
      .get(assetId) as AssetRow | undefined;

    return row ? mapAssetRow(row) : null;
  }

  public getAssetOrThrow(assetId: string): AssetRecord {
    const asset = this.getAssetById(assetId);
    if (!asset) {
      throw new NotFoundError(`未找到资源: ${assetId}`);
    }

    return asset;
  }

  public async generateCover(input: GenerateCoverInput): Promise<GeneratedCoverResult> {
    const relicType = input.relicType.trim();
    const displayName = input.displayName.trim();
    const description = input.description.trim();

    if (!relicType || !displayName || !description) {
      throw new ValidationError('生成封面需要 relicType、displayName 和 description');
    }

    const prompt = buildCoverPrompt({
      relicId: input.relicId,
      relicType,
      displayName,
      description,
      seed: input.seed,
    });
    const sourceUrl = buildPollinationsUrl(prompt, DEFAULT_COVER_WIDTH, DEFAULT_COVER_HEIGHT, input.seed);
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new ExternalServiceError(`Pollinations 请求失败: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      throw new ExternalServiceError('Pollinations 未返回有效图片');
    }

    const assetId = crypto.randomUUID();
    const assetDirectory = path.join(GENERATED_COVER_DIRECTORY, assetId);
    const safeBaseName = slugify(displayName);
    const variantSpecs: CoverVariantSpec[] = [
      { name: 'original', width: DEFAULT_COVER_WIDTH, height: DEFAULT_COVER_HEIGHT, quality: 92 },
      { name: 'card', width: 512, height: 748, quality: 88 },
      { name: 'thumb', width: 256, height: 374, quality: 82 },
    ];

    await fs.mkdir(assetDirectory, { recursive: true });

    try {
      const imageMetadata = await sharp(rawBuffer).metadata();
      const dimensions = extractImageDimensions(imageMetadata);
      const variantPaths = {} as AssetVariantMap;
      let primarySizeBytes = 0;

      for (const variant of variantSpecs) {
        const filePath = path.join(assetDirectory, `${variant.name}.webp`);
        const outputBuffer = await sharp(rawBuffer)
          .rotate()
          .resize(variant.width, variant.height, {
            fit: 'cover',
            position: 'attention',
          })
          .webp({ quality: variant.quality })
          .toBuffer();

        await fs.writeFile(filePath, outputBuffer);
        variantPaths[variant.name] = toRelativeDataPath(filePath);
        if (variant.name === 'original') {
          primarySizeBytes = outputBuffer.byteLength;
        }
      }

      const createdAt = Date.now();
      const metadata = JSON.stringify({
        prompt,
        sourceUrl,
        relicType,
        displayName,
        variants: variantPaths,
      });

      withTransaction((database) => {
        database.prepare(`
          INSERT INTO assets (id, kind, filename, mime_type, size_bytes, relative_path, width, height, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          assetId,
          'cover',
          `${safeBaseName}.webp`,
          'image/webp',
          primarySizeBytes,
          variantPaths.original,
          dimensions.width,
          dimensions.height,
          metadata,
          createdAt,
        );
      });

      const asset = this.getAssetOrThrow(assetId);
      if (input.relicId) {
        this.relicService.updateRelicAssets(input.relicId, {
          coverUrl: `/api/assets/${asset.id}?variant=card`,
        });
      }

      return {
        asset,
        prompt,
        sourceUrl,
        variants: variantPaths,
      };
    } catch (error) {
      await fs.rm(assetDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  public resolveAsset(assetId: string, variant: string = 'original'): ResolvedAsset {
    const asset = this.getAssetOrThrow(assetId);
    const variantMap = extractVariantMap(asset.metadata, asset);
    const requestedVariant = variant.trim().toLowerCase();
    const relativePath = requestedVariant === 'thumb'
      ? variantMap.thumb
      : requestedVariant === 'card'
        ? variantMap.card
        : variantMap.original;
    const absolutePath = path.resolve(DATA_DIRECTORY, relativePath);

    return {
      asset,
      absolutePath,
      mimeType: asset.mimeType,
      fileName: requestedVariant === 'original'
        ? asset.filename
        : `${path.parse(asset.filename).name}-${requestedVariant}${path.extname(asset.filename) || '.webp'}`,
    };
  }
}
