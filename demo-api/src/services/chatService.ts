import fs from 'node:fs/promises';

import type Database from 'better-sqlite3';
import OpenAI, { toFile } from 'openai';
import type { Response } from 'express';

import { getDatabase, withTransaction } from '../db/database';
import { ConfigurationError, ExternalServiceError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { RelicRecord, RelicService } from './relicService';

interface ChatMessageRow {
  id: string;
  relic_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface InteractionExample {
  title: string;
  trigger: string;
  exampleResponse: string;
}

interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  chatModel: string;
  transcriptionModel: string;
  ttsModel: string;
  ttsVoice: string;
}

export interface ChatMessageRecord {
  id: string;
  relicId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SendChatMessageInput {
  relicId: string;
  message: string;
  historyLimit?: number;
}

export interface SendChatMessageResult {
  relicId: string;
  assistantMessage: ChatMessageRecord;
  userMessage: ChatMessageRecord;
  model: string;
}

export interface VoiceMessageInput {
  relicId: string;
  file: Express.Multer.File;
  historyLimit?: number;
}

export interface VoiceMessageResult {
  transcription: string;
  assistantMessage: ChatMessageRecord;
  userMessage: ChatMessageRecord;
  model: string;
}

export interface SynthesizeSpeechInput {
  text: string;
  voice?: string;
  format?: 'mp3' | 'wav' | 'opus' | 'aac' | 'flac';
}

export interface SynthesizeSpeechResult {
  buffer: Buffer;
  contentType: string;
  fileExtension: string;
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const englishTokens = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  const chineseTokens = Array.from(normalized).filter((character) => /[\u4e00-\u9fa5]/u.test(character));
  return [...englishTokens, ...chineseTokens];
}

function computeRelevanceScore(source: string, query: string): number {
  if (!source.trim() || !query.trim()) {
    return 0;
  }

  const sourceText = source.toLowerCase();
  return tokenize(query).reduce((score, token) => score + (sourceText.includes(token) ? 1 : 0), 0);
}

function stripMarkdownFence(text: string): string {
  return text
    .replace(/^```json\s*/iu, '')
    .replace(/^```\s*/u, '')
    .replace(/```$/u, '')
    .trim();
}

function extractSections(markdown: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  const regex = /##\s+(.+?)\n([\s\S]*?)(?=\n##\s+|$)/gu;

  for (const match of markdown.matchAll(regex)) {
    const title = match[1];
    const body = match[2];
    if (!title || !body) {
      continue;
    }

    sections.push({
      title: title.trim(),
      body: body.trim(),
    });
  }

  return sections;
}

function parseInteractionExamples(markdown: string): InteractionExample[] {
  return extractSections(markdown)
    .map((section) => {
      const triggerMatch = section.body.match(/\*\*适用触发\*\*：([^\n]+)/u);
      const responseMatch = section.body.match(/\*\*示例响应\*\*：\s*\n\s*\n([\s\S]+)/u);
      if (!triggerMatch || !responseMatch) {
        return null;
      }

      const trigger = triggerMatch[1];
      const exampleResponse = responseMatch[1];
      if (!trigger || !exampleResponse) {
        return null;
      }

      return {
        title: section.title,
        trigger: trigger.trim(),
        exampleResponse: stripMarkdownFence(exampleResponse.trim()),
      };
    })
    .filter((example): example is InteractionExample => example !== null);
}

function mapChatMessageRow(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    relicId: row.relic_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
  };
}

function extractTextFromCompletionContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object' && 'text' in part) {
          const text = Reflect.get(part, 'text');
          return typeof text === 'string' ? text : '';
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function resolveOpenAIConfig(): OpenAIConfig {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || (baseURL ? 'demo-api-key' : '');

  if (!apiKey) {
    throw new ConfigurationError('缺少 OPENAI_API_KEY，无法调用对话模型');
  }

  return {
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    chatModel: process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini',
    transcriptionModel: process.env.OPENAI_AUDIO_TRANSCRIPTION_MODEL?.trim() || 'whisper-1',
    ttsModel: process.env.OPENAI_TTS_MODEL?.trim() || 'tts-1',
    ttsVoice: process.env.OPENAI_TTS_VOICE?.trim() || 'alloy',
  };
}

/**
 * 对话与音频服务。
 */
export class ChatService {
  private readonly database: Database.Database;

  private readonly config: OpenAIConfig;

  private client?: OpenAI;

  public constructor(
    private readonly relicService: RelicService,
    database: Database.Database = getDatabase(),
  ) {
    this.database = database;
    this.config = resolveOpenAIConfig();
  }

  public getHistory(relicId: string, limit = 50): ChatMessageRecord[] {
    const relic = this.relicService.getRelicOrThrow(relicId);
    const rows = this.database
      .prepare(`
        SELECT id, relic_id, role, content, timestamp
        FROM (
          SELECT id, relic_id, role, content, timestamp
          FROM chat_messages
          WHERE relic_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        )
        ORDER BY timestamp ASC
      `)
      .all(relic.id, Math.min(Math.max(limit, 1), 200)) as ChatMessageRow[];

    return rows.map(mapChatMessageRow);
  }

  public async sendMessage(input: SendChatMessageInput): Promise<SendChatMessageResult> {
    const relic = this.relicService.getRelicOrThrow(input.relicId);
    const userMessage = input.message.trim();
    if (!userMessage) {
      throw new ValidationError('消息内容不能为空');
    }

    const history = this.getHistory(relic.id, Math.min(input.historyLimit ?? 12, 20));
    const userRecord = this.storeMessage(relic.id, 'user', userMessage);
    const messages = this.buildPromptMessages(relic, history, userMessage);
    const completion = await this.getClient().chat.completions.create({
      model: this.config.chatModel,
      temperature: 0.85,
      messages,
    });

    const assistantContent = extractTextFromCompletionContent(completion.choices[0]?.message?.content);
    if (!assistantContent) {
      throw new ExternalServiceError('对话模型未返回有效内容');
    }

    const assistantRecord = this.storeMessage(relic.id, 'assistant', assistantContent);

    return {
      relicId: relic.id,
      assistantMessage: assistantRecord,
      userMessage: userRecord,
      model: completion.model || this.config.chatModel,
    };
  }

  public async streamMessage(input: SendChatMessageInput, response: Response): Promise<void> {
    const relic = this.relicService.getRelicOrThrow(input.relicId);
    const userMessage = input.message.trim();
    if (!userMessage) {
      throw new ValidationError('消息内容不能为空');
    }

    const history = this.getHistory(relic.id, Math.min(input.historyLimit ?? 12, 20));
    const userRecord = this.storeMessage(relic.id, 'user', userMessage);
    const messages = this.buildPromptMessages(relic, history, userMessage);

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    this.writeSseEvent(response, 'meta', {
      relicId: relic.id,
      userMessageId: userRecord.id,
      model: this.config.chatModel,
    });

    try {
      const stream = await this.getClient().chat.completions.create({
        model: this.config.chatModel,
        temperature: 0.85,
        stream: true,
        messages,
      });

      let aggregatedContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          aggregatedContent += delta;
          this.writeSseEvent(response, 'delta', { content: delta });
        }
      }

      const finalContent = aggregatedContent.trim();
      if (!finalContent) {
        throw new ExternalServiceError('流式对话未返回有效内容');
      }

      const assistantRecord = this.storeMessage(relic.id, 'assistant', finalContent);
      this.writeSseEvent(response, 'done', {
        assistantMessage: assistantRecord,
      });
    } catch (error) {
      logger.error('流式对话失败', {
        relicId: relic.id,
        error: error instanceof Error ? error : undefined,
      });
      this.writeSseEvent(response, 'error', {
        message: error instanceof Error ? error.message : '流式对话失败',
      });
    } finally {
      response.end();
    }
  }

  public async handleVoiceMessage(input: VoiceMessageInput): Promise<VoiceMessageResult> {
    const transcription = await this.transcribeAudio(input.file);
    const chatResult = await this.sendMessage({
      relicId: input.relicId,
      message: transcription,
      historyLimit: input.historyLimit,
    });

    return {
      transcription,
      assistantMessage: chatResult.assistantMessage,
      userMessage: chatResult.userMessage,
      model: chatResult.model,
    };
  }

  public async synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechResult> {
    const text = input.text.trim();
    if (!text) {
      throw new ValidationError('语音合成文本不能为空');
    }

    const format = input.format ?? 'mp3';
    const voice = input.voice?.trim() || this.config.ttsVoice;
    const audioResponse = await this.getClient().audio.speech.create({
      model: this.config.ttsModel,
      voice,
      input: text,
      response_format: format,
    });
    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    return {
      buffer,
      contentType: this.resolveAudioContentType(format),
      fileExtension: format,
    };
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        ...(this.config.baseURL ? { baseURL: this.config.baseURL } : {}),
      });
    }

    return this.client;
  }

  private buildPromptMessages(
    relic: RelicRecord,
    history: ChatMessageRecord[],
    userMessage: string,
  ): Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> {
    const interactionExamples = this.selectRelevantExamples(relic.interaction, userMessage);
    const memoryContext = this.selectRelevantMemorySections(relic.memory, userMessage);
    const baseInstruction = [
      `你是 relic.skill 演示站中的 Relic：${relic.displayName}。`,
      `Relic 类型：${relic.type}`,
      `简介：${relic.description}`,
      '请严格遵守以下身份协议、表达方式与边界，保持内容真实、温暖、克制，不要把自己包装成现实中仍然在线的真人或真实生命。',
      relic.personality,
      '额外要求：\n- 默认使用中文回复。\n- 输出以具体动作、场景和语气为主，不要写空泛说教。\n- 可以参考示例风格，但禁止逐句照抄。',
    ].join('\n\n');

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      {
        role: 'system',
        content: baseInstruction,
      },
    ];

    if (memoryContext.length > 0) {
      messages.push({
        role: 'system',
        content: ['以下是与当前话题最相关的记忆锚点，请优先利用这些细节回应：', ...memoryContext].join('\n\n'),
      });
    }

    if (interactionExamples.length > 0) {
      messages.push({
        role: 'system',
        content: '以下是风格示例，用于学习表达方式与边界，不要逐字复述：',
      });

      for (const example of interactionExamples) {
        messages.push({
          role: 'user',
          content: `[风格示例触发] ${example.title}｜${example.trigger}`,
        });
        messages.push({
          role: 'assistant',
          content: example.exampleResponse,
        });
      }
    }

    for (const message of history.slice(-12)) {
      messages.push({
        role: message.role,
        content: message.content,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  private selectRelevantExamples(interactionMarkdown: string, userMessage: string): InteractionExample[] {
    return parseInteractionExamples(interactionMarkdown)
      .map((example) => ({
        example,
        score: computeRelevanceScore(`${example.title} ${example.trigger}`, userMessage),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 4)
      .map((item) => item.example);
  }

  private selectRelevantMemorySections(memoryMarkdown: string, userMessage: string): string[] {
    return extractSections(memoryMarkdown)
      .map((section) => ({
        content: `## ${section.title}\n${section.body}`,
        score: computeRelevanceScore(`${section.title} ${section.body}`, userMessage),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((item) => item.content);
  }

  private storeMessage(relicId: string, role: ChatMessageRecord['role'], content: string): ChatMessageRecord {
    return withTransaction((database) => {
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      database.prepare(`
        INSERT INTO chat_messages (id, relic_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, relicId, role, content, timestamp);

      return {
        id,
        relicId,
        role,
        content,
        timestamp,
      };
    });
  }

  private async transcribeAudio(file: Express.Multer.File): Promise<string> {
    const buffer = file.buffer && file.buffer.byteLength > 0
      ? file.buffer
      : file.path
        ? await fs.readFile(file.path)
        : null;

    if (!buffer) {
      throw new ValidationError('未收到有效的音频文件');
    }

    const uploadFile = await toFile(buffer, file.originalname || 'voice-input', {
      type: file.mimetype || 'audio/mpeg',
    });
    const result = await this.getClient().audio.transcriptions.create({
      file: uploadFile,
      model: this.config.transcriptionModel,
      prompt: '请准确转写中文语音，保留停顿与称呼。',
    });

    const text = typeof result.text === 'string' ? result.text.trim() : '';
    if (!text) {
      throw new ExternalServiceError('语音转写结果为空');
    }

    return text;
  }

  private resolveAudioContentType(format: NonNullable<SynthesizeSpeechInput['format']>): string {
    switch (format) {
      case 'wav':
        return 'audio/wav';
      case 'opus':
        return 'audio/opus';
      case 'aac':
        return 'audio/aac';
      case 'flac':
        return 'audio/flac';
      case 'mp3':
      default:
        return 'audio/mpeg';
    }
  }

  private writeSseEvent(response: Response, event: string, payload: Record<string, unknown>): void {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}
