import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type Database from 'better-sqlite3';

import { getDatabase, withTransaction } from '../db/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const EXAMPLES_DIRECTORY = path.resolve(__dirname, '../../../examples');

interface RelicRow {
  id: string;
  slug: string | null;
  display_name: string;
  type: string;
  description: string;
  personality: string;
  interaction: string;
  memory: string;
  cover_url: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

interface CountRow {
  total: number;
}

interface ExampleManifestSubject {
  name?: string;
  description?: string;
  summary?: string;
  core_summary?: string;
  [key: string]: unknown;
}

interface ExampleManifest {
  slug?: string;
  display_name?: string;
  relic_type?: string;
  subject?: ExampleManifestSubject;
  [key: string]: unknown;
}

interface ExampleRelicSeed {
  id: string;
  slug: string;
  displayName: string;
  type: string;
  description: string;
  personality: string;
  interaction: string;
  memory: string;
}

export interface RelicRecord {
  id: string;
  slug: string | null;
  displayName: string;
  type: string;
  description: string;
  personality: string;
  interaction: string;
  memory: string;
  coverUrl: string | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RelicListItem {
  id: string;
  slug: string | null;
  displayName: string;
  type: string;
  description: string;
  coverUrl: string | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ListRelicsOptions {
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListRelicsResult {
  items: RelicListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateRelicInput {
  slug?: string;
  displayName: string;
  type: string;
  description: string;
  personality: string;
  interaction: string;
  memory: string;
  coverUrl?: string;
  avatarUrl?: string;
}

function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/u, '').trim();
}

function sanitizeText(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || `relic-${Date.now()}`;
}

function extractDescription(manifest: ExampleManifest, skillMarkdown: string): string {
  const subject = manifest.subject;
  const candidates = [
    manifest.display_name,
    typeof subject?.description === 'string' ? subject.description : undefined,
    typeof subject?.summary === 'string' ? subject.summary : undefined,
    typeof subject?.core_summary === 'string' ? subject.core_summary : undefined,
  ].filter((item): item is string => Boolean(item && item.trim()));

  if (candidates.length > 1) {
    return sanitizeText(candidates.slice(1).join(' '));
  }

  const skillBody = stripFrontMatter(skillMarkdown);
  const excerpt = skillBody.split('\n').find((line) => line.trim().startsWith('>'));
  if (excerpt) {
    return excerpt.replace(/^>\s*/, '').trim();
  }

  return candidates[0]?.trim() || '未提供描述';
}

function mapRelicRow(row: RelicRow): RelicRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    type: row.type,
    description: row.description,
    personality: row.personality,
    interaction: row.interaction,
    memory: row.memory,
    coverUrl: row.cover_url,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRelicListItem(row: RelicRow): RelicListItem {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    type: row.type,
    description: row.description,
    coverUrl: row.cover_url,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Relic 数据服务。
 */
export class RelicService {
  private readonly database: Database.Database;

  public constructor(database: Database.Database = getDatabase()) {
    this.database = database;
  }

  public listRelics(options: ListRelicsOptions = {}): ListRelicsResult {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (options.type?.trim()) {
      conditions.push('type = ?');
      parameters.push(options.type.trim());
    }

    if (options.search?.trim()) {
      conditions.push('(display_name LIKE ? OR description LIKE ?)');
      const keyword = `%${options.search.trim()}%`;
      parameters.push(keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.database
      .prepare(`
        SELECT id, slug, display_name, type, description, personality, interaction, memory, cover_url, avatar_url, created_at, updated_at
        FROM relics
        ${whereClause}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...parameters, limit, offset) as RelicRow[];

    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS total FROM relics ${whereClause}`)
      .get(...parameters) as CountRow;

    return {
      items: rows.map(mapRelicListItem),
      total: countRow.total,
      limit,
      offset,
    };
  }

  public getRelicById(idOrSlug: string): RelicRecord | null {
    const row = this.database
      .prepare(`
        SELECT id, slug, display_name, type, description, personality, interaction, memory, cover_url, avatar_url, created_at, updated_at
        FROM relics
        WHERE id = ? OR slug = ?
        LIMIT 1
      `)
      .get(idOrSlug, idOrSlug) as RelicRow | undefined;

    return row ? mapRelicRow(row) : null;
  }

  public getRelicOrThrow(idOrSlug: string): RelicRecord {
    const relic = this.getRelicById(idOrSlug);
    if (!relic) {
      throw new NotFoundError(`未找到 Relic: ${idOrSlug}`);
    }

    return relic;
  }

  public createRelic(input: CreateRelicInput): RelicRecord {
    const displayName = input.displayName.trim();
    const type = input.type.trim();
    const description = input.description.trim();
    const personality = input.personality.trim();
    const interaction = input.interaction.trim();
    const memory = input.memory.trim();

    if (!displayName || !type || !description || !personality || !interaction || !memory) {
      throw new ValidationError('创建 Relic 缺少必要字段');
    }

    return withTransaction((database) => {
      const id = crypto.randomUUID();
      const slug = this.ensureUniqueSlug(input.slug?.trim() || displayName, database);
      const timestamp = Date.now();

      database.prepare(`
        INSERT INTO relics (
          id, slug, display_name, type, description, personality, interaction, memory, cover_url, avatar_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        slug,
        displayName,
        type,
        description,
        personality,
        interaction,
        memory,
        input.coverUrl?.trim() || null,
        input.avatarUrl?.trim() || null,
        timestamp,
        timestamp,
      );

      return this.getRelicOrThrow(id);
    });
  }

  public updateRelicAssets(relicId: string, assets: { coverUrl?: string | null; avatarUrl?: string | null }): RelicRecord {
    return withTransaction((database) => {
      const current = this.getRelicOrThrow(relicId);
      const nextCoverUrl = assets.coverUrl === undefined ? current.coverUrl : assets.coverUrl;
      const nextAvatarUrl = assets.avatarUrl === undefined ? current.avatarUrl : assets.avatarUrl;
      const updatedAt = Date.now();

      database.prepare(`
        UPDATE relics
        SET cover_url = ?, avatar_url = ?, updated_at = ?
        WHERE id = ?
      `).run(nextCoverUrl, nextAvatarUrl, updatedAt, current.id);

      return this.getRelicOrThrow(relicId);
    });
  }

  public async syncExampleRelics(): Promise<number> {
    const entries = await fs.readdir(EXAMPLES_DIRECTORY, { withFileTypes: true });
    const exampleDirectories = entries.filter((entry) => entry.isDirectory());
    const seeds = (await Promise.all(exampleDirectories.map(async (entry) => this.loadExampleSeed(entry.name))))
      .filter((seed): seed is ExampleRelicSeed => seed !== null);

    if (seeds.length === 0) {
      logger.warn('未发现可同步的示例 Relic', { examplesDirectory: EXAMPLES_DIRECTORY });
      return 0;
    }

    withTransaction((database) => {
      const statement = database.prepare(`
        INSERT INTO relics (
          id, slug, display_name, type, description, personality, interaction, memory, cover_url, avatar_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          display_name = excluded.display_name,
          type = excluded.type,
          description = excluded.description,
          personality = excluded.personality,
          interaction = excluded.interaction,
          memory = excluded.memory,
          cover_url = COALESCE(relics.cover_url, excluded.cover_url),
          avatar_url = COALESCE(relics.avatar_url, excluded.avatar_url),
          updated_at = excluded.updated_at
      `);

      for (const seed of seeds) {
        const existing = database.prepare('SELECT created_at FROM relics WHERE id = ? LIMIT 1').get(seed.id) as { created_at: number } | undefined;
        const timestamp = Date.now();

        statement.run(
          seed.id,
          seed.slug,
          seed.displayName,
          seed.type,
          seed.description,
          seed.personality,
          seed.interaction,
          seed.memory,
          null,
          null,
          existing?.created_at ?? timestamp,
          timestamp,
        );
      }
    });

    logger.info('示例 Relic 同步完成', {
      total: seeds.length,
      examplesDirectory: EXAMPLES_DIRECTORY,
    });

    return seeds.length;
  }

  private ensureUniqueSlug(rawValue: string, database: Database.Database): string {
    const baseSlug = slugify(rawValue);
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const row = database.prepare('SELECT id FROM relics WHERE slug = ? LIMIT 1').get(candidate) as { id: string } | undefined;
      if (!row) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  private async loadExampleSeed(exampleDirectoryName: string): Promise<ExampleRelicSeed | null> {
    const directory = path.join(EXAMPLES_DIRECTORY, exampleDirectoryName);

    try {
      const [manifestContent, skillMarkdown, personalityMarkdown, interactionMarkdown, memoryMarkdown] = await Promise.all([
        fs.readFile(path.join(directory, 'manifest.json'), 'utf8'),
        fs.readFile(path.join(directory, 'SKILL.md'), 'utf8'),
        fs.readFile(path.join(directory, 'personality.md'), 'utf8'),
        fs.readFile(path.join(directory, 'interaction.md'), 'utf8'),
        fs.readFile(path.join(directory, 'memory.md'), 'utf8'),
      ]);

      const manifest = JSON.parse(manifestContent) as ExampleManifest;
      const slug = slugify(manifest.slug?.trim() || exampleDirectoryName);
      const displayName = manifest.display_name?.trim() || manifest.subject?.name?.toString().trim() || exampleDirectoryName;
      const type = manifest.relic_type?.trim() || 'memory';
      const description = extractDescription(manifest, skillMarkdown);
      const personality = [
        '# 核心协议',
        stripFrontMatter(skillMarkdown),
        '',
        '# 四维画像',
        stripFrontMatter(personalityMarkdown),
      ].join('\n').trim();

      return {
        id: `example-${slug}`,
        slug,
        displayName,
        type,
        description,
        personality: sanitizeText(personality),
        interaction: sanitizeText(stripFrontMatter(interactionMarkdown)),
        memory: sanitizeText(stripFrontMatter(memoryMarkdown)),
      };
    } catch (error) {
      logger.warn('跳过无效示例 Relic', {
        exampleDirectoryName,
        error: error instanceof Error ? error : undefined,
      });

      return null;
    }
  }
}
