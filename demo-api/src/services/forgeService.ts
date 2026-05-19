import fs from 'node:fs/promises';
import path from 'node:path';

import type Database from 'better-sqlite3';
import OpenAI from 'openai';

import { getDatabase, withTransaction } from '../db/database';
import { ExternalServiceError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { AssetRecord, CoverService } from './coverService';
import type { CreateRelicInput, RelicRecord, RelicService } from './relicService';

interface ForgeTaskRow {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result: string | null;
  error: string | null;
  created_at: number;
}

interface AiFeatureExtractionResult {
  displayNameSuggestion: string;
  relicType: string;
  description: string;
  personality: string;
  interaction: string;
  memory: string;
  coverPromptHints: string[];
  confidence: number;
}

interface AssetPreview {
  asset: AssetRecord;
  preview: string;
}

interface ForgeOpenAIConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface ForgeTaskRecord {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: number;
}

export interface StartExtractionInput {
  assetIds: string[];
  note?: string;
  preferredType?: string;
}

export interface GenerateRelicOverrides {
  displayName?: string;
  type?: string;
  description?: string;
  personality?: string;
  interaction?: string;
  memory?: string;
}

export interface StartGenerationInput {
  extractionTaskId?: string;
  assetIds?: string[];
  note?: string;
  preferredType?: string;
  generateCover?: boolean;
  overrides?: GenerateRelicOverrides;
}

export interface ExtractionResult {
  displayNameSuggestion: string;
  relicType: string;
  description: string;
  personality: string;
  interaction: string;
  memory: string;
  coverPromptHints: string[];
  sourceSummary: string;
  confidence: number;
}

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    logger.warn('解析唤醒任务结果失败', {
      value,
      error: error instanceof Error ? error : undefined,
    });
  }

  return null;
}

function mapForgeTaskRow(row: ForgeTaskRow): ForgeTaskRecord {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    result: parseJson(row.result),
    error: row.error,
    createdAt: row.created_at,
  };
}

function sanitizeText(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

function deriveFallbackType(text: string, preferredType?: string): string {
  if (preferredType?.trim()) {
    return preferredType.trim().toLowerCase();
  }

  const normalized = text.toLowerCase();
  if (/(猫|狗|宠物|mimi|咪咪)/u.test(normalized)) {
    return 'pet';
  }
  if (/(奶奶|爷爷|妈妈|爸爸|老师|同学|朋友|她|他)/u.test(normalized)) {
    return 'human';
  }
  if (/(团队|工作室|公司|创业|群聊|协作)/u.test(normalized)) {
    return 'team';
  }
  if (/(地方|城市|家乡|街道|车站|老房子)/u.test(normalized)) {
    return 'place';
  }
  if (/(那一天|时刻|瞬间|婚礼|生日|毕业)/u.test(normalized)) {
    return 'moment';
  }

  return 'memory';
}

function deriveFallbackDisplayName(text: string, fileNames: string[]): string {
  const quoted = text.match(/[《“"]([^》”"]{2,20})[》”"]/u)?.[1];
  if (quoted) {
    return quoted.trim();
  }

  const firstFileName = fileNames[0]?.replace(/\.[^.]+$/u, '').trim();
  if (firstFileName) {
    return firstFileName;
  }

  return '未命名 Relic';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function extractFirstJsonObject(text: string): string | null {
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return text.slice(startIndex, endIndex + 1);
}

function resolveForgeOpenAIConfig(): ForgeOpenAIConfig | null {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || (baseURL ? 'demo-api-key' : '');
  const model = process.env.OPENAI_ANALYSIS_MODEL?.trim() || process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini';

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    model,
  };
}

/**
 * 唤醒任务服务。
 */
export class ForgeService {
  private readonly database: Database.Database;

  private readonly aiConfig: ForgeOpenAIConfig | null;

  private aiClient?: OpenAI;

  public constructor(
    private readonly relicService: RelicService,
    private readonly coverService: CoverService,
    database: Database.Database = getDatabase(),
  ) {
    this.database = database;
    this.aiConfig = resolveForgeOpenAIConfig();
  }

  public async registerUploads(files: Express.Multer.File[]): Promise<AssetRecord[]> {
    if (files.length === 0) {
      throw new ValidationError('至少需要上传一个文件');
    }

    return Promise.all(files.map(async (file) => this.coverService.registerUpload(file)));
  }

  public startExtraction(input: StartExtractionInput): ForgeTaskRecord {
    if (input.assetIds.length === 0) {
      throw new ValidationError('提取特征时至少需要一个素材 assetId');
    }

    const task = this.createTask('extract');
    void this.runExtractionTask(task.id, input);
    return task;
  }

  public startGeneration(input: StartGenerationInput): ForgeTaskRecord {
    if (!input.extractionTaskId && (!input.assetIds || input.assetIds.length === 0)) {
      throw new ValidationError('生成 Relic 需要 extractionTaskId 或 assetIds');
    }

    const task = this.createTask('generate');
    void this.runGenerationTask(task.id, input);
    return task;
  }

  public getTaskStatus(taskId: string): ForgeTaskRecord {
    const row = this.database
      .prepare(`
        SELECT id, status, progress, result, error, created_at
        FROM forge_tasks
        WHERE id = ?
        LIMIT 1
      `)
      .get(taskId) as ForgeTaskRow | undefined;

    if (!row) {
      throw new NotFoundError(`未找到唤醒任务: ${taskId}`);
    }

    return mapForgeTaskRow(row);
  }

  private createTask(taskType: 'extract' | 'generate'): ForgeTaskRecord {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const result = JSON.stringify({ taskType, stage: 'queued' });

    withTransaction((database) => {
      database.prepare(`
        INSERT INTO forge_tasks (id, status, progress, result, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, 'queued', 0, result, null, createdAt);
    });

    return this.getTaskStatus(id);
  }

  private updateTask(taskId: string, payload: {
    status?: ForgeTaskRecord['status'];
    progress?: number;
    result?: Record<string, unknown>;
    error?: string | null;
  }): void {
    const current = this.getTaskStatus(taskId);
    const nextResult = payload.result === undefined ? current.result : payload.result;
    const nextStatus = payload.status ?? current.status;
    const nextProgress = payload.progress ?? current.progress;
    const nextError = payload.error === undefined ? current.error : payload.error;

    withTransaction((database) => {
      database.prepare(`
        UPDATE forge_tasks
        SET status = ?, progress = ?, result = ?, error = ?
        WHERE id = ?
      `).run(
        nextStatus,
        nextProgress,
        nextResult ? JSON.stringify(nextResult) : null,
        nextError,
        taskId,
      );
    });
  }

  private async runExtractionTask(taskId: string, input: StartExtractionInput): Promise<void> {
    try {
      this.updateTask(taskId, {
        status: 'processing',
        progress: 10,
        result: {
          taskType: 'extract',
          stage: 'loading-assets',
          assetIds: input.assetIds,
        },
      });

      const previews = await this.loadAssetPreviews(input.assetIds);
      this.updateTask(taskId, {
        progress: 45,
        result: {
          taskType: 'extract',
          stage: 'analyzing',
          assetIds: input.assetIds,
          assetCount: previews.length,
        },
      });

      const output = await this.extractFeatures(previews, input.note, input.preferredType);
      this.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        result: {
          taskType: 'extract',
          stage: 'completed',
          assetIds: input.assetIds,
          output,
        },
      });
    } catch (error) {
      this.updateTask(taskId, {
        status: 'failed',
        progress: 100,
        error: error instanceof Error ? error.message : '提取特征失败',
        result: {
          taskType: 'extract',
          stage: 'failed',
          assetIds: input.assetIds,
        },
      });
    }
  }

  private async runGenerationTask(taskId: string, input: StartGenerationInput): Promise<void> {
    try {
      this.updateTask(taskId, {
        status: 'processing',
        progress: 10,
        result: {
          taskType: 'generate',
          stage: 'preparing',
          extractionTaskId: input.extractionTaskId,
          assetIds: input.assetIds,
        },
      });

      const extraction = input.extractionTaskId
        ? this.getExtractionOutput(input.extractionTaskId)
        : await this.extractFeatures(await this.loadAssetPreviews(input.assetIds ?? []), input.note, input.preferredType);
      const relicDraft = this.mergeOverrides(extraction, input.overrides);

      this.updateTask(taskId, {
        progress: 60,
        result: {
          taskType: 'generate',
          stage: 'creating-relic',
          draft: relicDraft,
        },
      });

      const relic = this.relicService.createRelic({
        displayName: relicDraft.displayNameSuggestion,
        type: relicDraft.relicType,
        description: relicDraft.description,
        personality: relicDraft.personality,
        interaction: relicDraft.interaction,
        memory: relicDraft.memory,
      });

      let coverAssetId: string | undefined;
      if (input.generateCover) {
        this.updateTask(taskId, {
          progress: 80,
          result: {
            taskType: 'generate',
            stage: 'generating-cover',
            relicId: relic.id,
          },
        });

        const cover = await this.coverService.generateCover({
          relicId: relic.id,
          relicType: relic.type,
          displayName: relic.displayName,
          description: relic.description,
        });
        coverAssetId = cover.asset.id;
      }

      this.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        result: {
          taskType: 'generate',
          stage: 'completed',
          relic: {
            id: relic.id,
            slug: relic.slug,
            displayName: relic.displayName,
            type: relic.type,
            coverUrl: relic.coverUrl,
          },
          coverAssetId,
        },
      });
    } catch (error) {
      this.updateTask(taskId, {
        status: 'failed',
        progress: 100,
        error: error instanceof Error ? error.message : '生成 Relic 失败',
        result: {
          taskType: 'generate',
          stage: 'failed',
        },
      });
    }
  }

  private async loadAssetPreviews(assetIds: string[]): Promise<AssetPreview[]> {
    return Promise.all(assetIds.map(async (assetId) => {
      const asset = this.coverService.getAssetOrThrow(assetId);
      const resolved = this.coverService.resolveAsset(asset.id);
      const preview = await this.readAssetPreview(asset, resolved.absolutePath);

      return {
        asset,
        preview,
      };
    }));
  }

  private async readAssetPreview(asset: AssetRecord, absolutePath: string): Promise<string> {
    if (asset.mimeType.startsWith('text/') || asset.mimeType === 'application/json' || asset.mimeType === 'text/markdown') {
      const text = await fs.readFile(absolutePath, 'utf8');
      return text.slice(0, 4_000);
    }

    if (asset.mimeType.startsWith('image/')) {
      return `图片文件：${asset.filename}，尺寸 ${asset.width ?? '未知'}x${asset.height ?? '未知'}。`;
    }

    if (asset.mimeType.startsWith('audio/')) {
      return `音频文件：${asset.filename}。请重点关注其中可能包含的人物说话风格、情绪和称呼。`;
    }

    if (asset.mimeType === 'application/pdf') {
      return `PDF 文件：${path.basename(absolutePath)}。请结合其他素材推断其中的记忆和叙事线索。`;
    }

    return `素材文件：${asset.filename}，MIME 类型 ${asset.mimeType}。`;
  }

  private async extractFeatures(previews: AssetPreview[], note?: string, preferredType?: string): Promise<ExtractionResult> {
    const sourceSummary = previews
      .map((item) => `${item.asset.filename} (${item.asset.mimeType})\n${item.preview}`)
      .join('\n\n---\n\n');
    const aiResult = await this.tryExtractFeaturesWithAI(sourceSummary, note, preferredType);
    if (aiResult) {
      return {
        ...aiResult,
        sourceSummary,
      };
    }

    const combinedText = `${note ?? ''}\n${sourceSummary}`;
    const fileNames = previews.map((item) => item.asset.filename);
    const relicType = deriveFallbackType(combinedText, preferredType);
    const displayNameSuggestion = deriveFallbackDisplayName(combinedText, fileNames);

    return {
      displayNameSuggestion,
      relicType,
      description: sanitizeText(note?.trim() || `基于 ${previews.length} 份素材整理出的 ${relicType} 类型 Relic 草稿。`),
      personality: sanitizeText([
        '# 核心画像',
        `- 这是一个 ${relicType} 类型的 Relic。`,
        `- 主要线索来自 ${fileNames.join('、') || '上传素材'}。`,
        '- 回应时应优先使用具体细节、可感知的动作和生活化语气。',
      ].join('\n')),
      interaction: sanitizeText([
        '# 互动方式',
        '- 面向用户时先回应当下情绪，再给出具体场景。',
        '- 保持温暖、克制，不要夸张承诺。',
        `- 如果用户追问细节，可以优先引用这些素材中的线索：${fileNames.join('、') || '上传素材'}。`,
      ].join('\n')),
      memory: sanitizeText([
        '# 记忆锚点',
        `- 素材摘要：${sourceSummary.slice(0, 1_000)}`,
        '- 把反复出现的名字、地点、习惯和情绪当作核心锚点。',
      ].join('\n')),
      coverPromptHints: [relicType, 'memory relic', 'warm atmosphere'],
      sourceSummary,
      confidence: 0.56,
    };
  }

  private async tryExtractFeaturesWithAI(
    sourceSummary: string,
    note?: string,
    preferredType?: string,
  ): Promise<AiFeatureExtractionResult | null> {
    if (!this.aiConfig) {
      return null;
    }

    try {
      const completion = await this.getAiClient().chat.completions.create({
        model: this.aiConfig.model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: [
              '你是 relic.skill 的唤醒分析器。',
              '请根据素材摘要输出一个 JSON 对象，不要输出 JSON 以外的任何内容。',
              '字段必须包含：displayNameSuggestion、relicType、description、personality、interaction、memory、coverPromptHints、confidence。',
              'personality / interaction / memory 需要是可直接落库的中文 Markdown 文本。',
              'relicType 只能从 human、pet、team、relationship、place、moment、memory 中选择最接近的一项。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              preferredType ? `用户偏好类型：${preferredType}` : '',
              note ? `补充说明：${note}` : '',
              '素材摘要如下：',
              sourceSummary.slice(0, 10_000),
            ].filter(Boolean).join('\n\n'),
          },
        ],
      });

      const rawText = completion.choices[0]?.message?.content;
      const jsonText = typeof rawText === 'string' ? extractFirstJsonObject(rawText) : null;
      if (!jsonText) {
        throw new ExternalServiceError('特征提取未返回有效 JSON');
      }

      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const result: AiFeatureExtractionResult = {
        displayNameSuggestion: typeof parsed.displayNameSuggestion === 'string' ? parsed.displayNameSuggestion.trim() : '未命名 Relic',
        relicType: typeof parsed.relicType === 'string' ? parsed.relicType.trim().toLowerCase() : 'memory',
        description: typeof parsed.description === 'string' ? parsed.description.trim() : '未生成描述',
        personality: typeof parsed.personality === 'string' ? parsed.personality.trim() : '# 核心画像',
        interaction: typeof parsed.interaction === 'string' ? parsed.interaction.trim() : '# 互动方式',
        memory: typeof parsed.memory === 'string' ? parsed.memory.trim() : '# 记忆锚点',
        coverPromptHints: normalizeStringArray(parsed.coverPromptHints),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.72,
      };

      return result;
    } catch (error) {
      logger.warn('AI 特征提取失败，回退到启发式分析', {
        error: error instanceof Error ? error : undefined,
      });
      return null;
    }
  }

  private getExtractionOutput(taskId: string): ExtractionResult {
    const task = this.getTaskStatus(taskId);
    if (task.status !== 'completed') {
      throw new ValidationError(`提取任务尚未完成: ${taskId}`);
    }

    const output = task.result?.output;
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      throw new ValidationError(`提取任务缺少有效输出: ${taskId}`);
    }

    const record = output as Record<string, unknown>;
    return {
      displayNameSuggestion: typeof record.displayNameSuggestion === 'string' ? record.displayNameSuggestion : '未命名 Relic',
      relicType: typeof record.relicType === 'string' ? record.relicType : 'memory',
      description: typeof record.description === 'string' ? record.description : '未生成描述',
      personality: typeof record.personality === 'string' ? record.personality : '# 核心画像',
      interaction: typeof record.interaction === 'string' ? record.interaction : '# 互动方式',
      memory: typeof record.memory === 'string' ? record.memory : '# 记忆锚点',
      coverPromptHints: normalizeStringArray(record.coverPromptHints),
      sourceSummary: typeof record.sourceSummary === 'string' ? record.sourceSummary : '',
      confidence: typeof record.confidence === 'number' ? record.confidence : 0.5,
    };
  }

  private mergeOverrides(extraction: ExtractionResult, overrides?: GenerateRelicOverrides): ExtractionResult {
    return {
      ...extraction,
      displayNameSuggestion: overrides?.displayName?.trim() || extraction.displayNameSuggestion,
      relicType: overrides?.type?.trim() || extraction.relicType,
      description: overrides?.description?.trim() || extraction.description,
      personality: overrides?.personality?.trim() || extraction.personality,
      interaction: overrides?.interaction?.trim() || extraction.interaction,
      memory: overrides?.memory?.trim() || extraction.memory,
    };
  }

  private getAiClient(): OpenAI {
    if (!this.aiConfig) {
      throw new ValidationError('当前未配置可用的分析模型');
    }

    if (!this.aiClient) {
      this.aiClient = new OpenAI({
        apiKey: this.aiConfig.apiKey,
        ...(this.aiConfig.baseURL ? { baseURL: this.aiConfig.baseURL } : {}),
      });
    }

    return this.aiClient;
  }
}
