const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const GENERATED_ASSET_BASE_DIR = process.env.GENERATED_ASSET_DIR
  || path.join(__dirname, '..', '..', 'data', 'generated-assets');
const GENERATED_ASSET_BASE_PATH = '/api/assets/generated';
const DEFAULT_WORLD_COVER_WIDTH = 832;
const DEFAULT_WORLD_COVER_HEIGHT = 1216;
const PROVIDER_ATTEMPTS = 2;

const GENRE_STYLE_HINTS = {
  wuxia: ['武侠气质', '电影海报', '江湖氛围'],
  xianxia: ['修仙奇观', '电影海报', '云海氛围'],
  apocalypse: ['末世废墟', '电影海报', '压迫感'],
  campus: ['青春感', '日剧海报', '校园氛围'],
  cyberpunk: ['霓虹都市', '电影海报', '赛博光影'],
  isekai: ['异世界奇遇', '幻想海报', '明亮奇观'],
  mystery: ['悬疑氛围', '电影海报', '冷色光影'],
  fantasy: ['史诗奇幻', '电影海报', '奇观场景'],
  romance: ['关系张力', '恋爱海报', '情绪氛围'],
  slice_of_life: ['生活感', '轻电影海报', '温柔氛围'],
  otome: ['乙女感', '角色海报', '心动氛围'],
  career: ['都市感', '职场海报', '现代光影'],
  love_sim: ['恋爱养成', '角色海报', '甜感氛围'],
  daily_companion: ['陪伴感', '轻海报', '温暖氛围'],
  historical: ['历史质感', '史诗海报', '年代氛围'],
  anime_fanfic: ['动漫感', '高质量插画', '角色张力'],
  horror: ['惊悚氛围', '电影海报', '压暗光影'],
};

const PLAY_TYPE_HINTS = {
  world: ['世界观封面', '场景主导'],
  dungeon: ['短篇冒险封面', '冲突瞬间'],
  romance: ['人物关系封面', '情绪主导'],
  companion: ['人物关系封面', '陪伴感'],
  role_play: ['角色代入封面', '人物与场景并重'],
};

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeSlug(value, fallback = 'item') {
  const normalized = trimString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function clampText(value, maxLength) {
  const normalized = trimString(value).replace(/\s+/g, ' ');
  if (!normalized) return '';
  return Array.from(normalized).slice(0, maxLength).join('');
}

function deriveSceneHook(world) {
  const opening = clampText(world.opening, 72);
  const description = clampText(world.description, 72);
  const greeting = clampText(world.primary_character_greeting || world.primaryCharacterGreeting, 48);
  return opening || description || greeting || trimString(world.title) || '故事开场';
}

function uniqueHints(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function deriveWorldVisualAnchors(world = {}) {
  const text = [
    trimString(world.title),
    trimString(world.description),
    trimString(world.opening),
    trimString(world.primary_character_name || world.primaryCharacterName),
  ].join(' ');

  const styleHints = [];
  const promptHints = [];

  if (/属性|面板|数值|升级|系统/.test(text)) {
    styleHints.push('系统成长', '属性面板', '数值提升');
    promptHints.push('system progression', 'attribute pickup', 'floating stat shards');
  }

  if (/异能|超能力|觉醒/.test(text)) {
    if (/校园|高中|学生|教室|校服/.test(text)) {
      styleHints.push('校园异能冲突', '觉醒瞬间');
      promptHints.push('school uniform power awakening', 'superpower clash in campus corridor');
    } else {
      styleHints.push('异能觉醒', '能力爆发');
      promptHints.push('superpower awakening', 'energy surge');
    }
  }

  if (/大圣|悟空|金箍棒|齐天/.test(text)) {
    styleHints.push('神话英雄', '金箍棒', '齐天神话');
    promptHints.push('mythic hero', 'monkey king', 'golden staff silhouette');
  }

  if (/剑来|剑修|飞剑|古剑|剑客/.test(text)) {
    styleHints.push('古剑主视觉', '剑修压迫感');
    promptHints.push('ancient sword focal point', 'sword cultivator aura');
  }

  return {
    styleHints: uniqueHints(styleHints),
    promptHints: uniqueHints(promptHints),
  };
}

function buildCharacterAvatarBrief(character = {}) {
  const name = trimString(character.name) || '未命名角色';
  const role = trimString(character.role) || 'npc';
  const worldTitle = trimString(character.world_title || character.worldTitle);
  const worldGenre = trimString(character.world_genre || character.worldGenre) || 'romance';
  const worldPlayType = trimString(character.world_play_type || character.worldPlayType) || 'companion';
  const isViewerInsertLead = role === 'protagonist_template' && name === '你';
  const keyTrait = [
    trimString(character.appearance),
    trimString(character.personality),
    trimString(character.background),
    trimString(character.greeting),
    trimString(character.speech_style || character.speechStyle),
  ].find(Boolean) || name;
  const roleHints = role === 'protagonist_template'
    ? ['主角海报', '角色立绘', '代入感']
    : ['角色海报', '半身人物', '关系张力'];
  const perspectiveHints = isViewerInsertLead
    ? ['留白主角', '弱化正脸', '背影构图']
    : [];

  return {
    entityType: 'character',
    entityId: character.id,
    name,
    role,
    isViewerInsertLead,
    worldTitle,
    worldGenre,
    worldPlayType,
    keyTrait,
    styleHints: uniqueHints([
      ...roleHints,
      ...perspectiveHints,
      ...(GENRE_STYLE_HINTS[worldGenre] || ['高质量插画', '人物氛围']),
      ...(PLAY_TYPE_HINTS[worldPlayType] || ['人物主导']),
    ]),
    appearance: trimString(character.appearance),
    personality: trimString(character.personality),
    background: trimString(character.background),
    speechStyle: trimString(character.speech_style || character.speechStyle),
    greeting: trimString(character.greeting),
    width: 832,
    height: 1216,
  };
}

function buildWorldCoverBrief(world = {}) {
  const title = trimString(world.title) || '未命名世界';
  const genre = trimString(world.genre) || 'fantasy';
  const playType = trimString(world.play_type || world.playType) || 'world';
  const primaryCharacterName = trimString(world.primary_character_name || world.primaryCharacterName);
  const sceneHook = deriveSceneHook(world);
  const visualAnchors = deriveWorldVisualAnchors(world);
  const styleHints = uniqueHints([
    ...(GENRE_STYLE_HINTS[genre] || ['高质量插画', '电影海报', '氛围感']),
    ...(PLAY_TYPE_HINTS[playType] || ['剧情封面']),
    ...visualAnchors.styleHints,
  ]);

  return {
    entityType: 'world',
    entityId: world.id,
    title,
    genre,
    playType,
    primaryCharacterName,
    sceneHook,
    styleHints,
    promptHints: visualAnchors.promptHints,
    description: trimString(world.description),
    opening: trimString(world.opening),
    width: DEFAULT_WORLD_COVER_WIDTH,
    height: DEFAULT_WORLD_COVER_HEIGHT,
  };
}

function buildWorldCoverPrompt(brief) {
  const subjectBits = [brief.title, brief.sceneHook, brief.primaryCharacterName].filter(Boolean).join('，');
  const styleBits = brief.styleHints.join('，');
  const promptHintBits = Array.isArray(brief.promptHints) ? brief.promptHints.join(', ') : '';
  return [
    'cinematic novel cover poster, premium key art, no text, no logo, no watermark',
    subjectBits,
    styleBits,
    promptHintBits,
    'Chinese fiction cover mood, strong focal subject, rich lighting, polished composition',
  ].filter(Boolean).join(', ');
}

function buildCharacterAvatarPrompt(brief) {
  const subjectBits = [
    brief.name,
    brief.appearance,
    brief.background,
    brief.greeting,
    brief.speechStyle,
  ].filter(Boolean).join('，');
  const styleBits = brief.styleHints.join('，');
  return [
    brief.isViewerInsertLead
      ? 'player-insert protagonist poster, over-the-shoulder composition, back view, face partially obscured, premium anime-inspired illustration, no text, no logo, no watermark'
      : brief.role === 'protagonist_template'
        ? 'main protagonist portrait poster, hero key art, half-body portrait, premium anime-inspired illustration, no text, no logo, no watermark'
        : 'character portrait poster, half-body portrait, premium anime-inspired illustration, no text, no logo, no watermark',
    subjectBits,
    styleBits,
    brief.worldTitle ? `from the story world ${brief.worldTitle}` : '',
    brief.isViewerInsertLead
      ? 'viewer-insertable lead character, over-the-shoulder framing, face partially obscured, emotionally immersive composition'
      : brief.role === 'protagonist_template'
        ? 'viewer-insertable lead character, strong presence, emotionally immersive composition'
        : 'strong eye contact, expressive lighting, emotionally charged composition',
  ].filter(Boolean).join(', ');
}

function buildWorldCoverNegativePrompt() {
  return 'text, logo, watermark, letters, signature, blurry, low quality, extra fingers, deformed face, cropped head';
}

function buildWorldCoverNegativePromptCompat() {
  return buildWorldCoverNegativePrompt();
}

async function generateWithProviders({ request, providers }) {
  const errors = [];

  for (const provider of providers || []) {
    try {
      const result = await provider.generate(request);
      return {
        provider: provider.name,
        ...result,
      };
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  throw new Error(errors.length > 0 ? errors.join(' | ') : '没有可用的图像生成 provider');
}

function detectFileExtension(contentType, sourceUrl) {
  const normalizedType = trimString(contentType).toLowerCase();
  if (normalizedType.includes('png')) return 'png';
  if (normalizedType.includes('webp')) return 'webp';
  if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) return 'jpg';
  if (normalizedType.includes('gif')) return 'gif';

  const pathname = typeof sourceUrl === 'string' ? new URL(sourceUrl).pathname : '';
  const ext = path.extname(pathname).replace('.', '').toLowerCase();
  return ext || 'jpg';
}

async function saveGeneratedAsset({
  entityType,
  entityId,
  title,
  sourceUrl,
  assetBaseDir = GENERATED_ASSET_BASE_DIR,
  publicBasePath = GENERATED_ASSET_BASE_PATH,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(`下载生成图片失败: ${response.status || 'unknown'}`);
  }

  const contentType = typeof response.headers?.get === 'function'
    ? response.headers.get('content-type')
    : response.headers?.get?.('content-type') || response.headers?.['content-type'];
  const extension = detectFileExtension(contentType, sourceUrl);
  const folderName = entityType === 'character' ? 'characters' : 'worlds';
  const safeSlug = sanitizeSlug(title, entityType);
  const hash = crypto.createHash('sha1').update(`${entityType}:${entityId}:${title}:${Date.now()}`).digest('hex').slice(0, 10);
  const fileName = `${entityType}-${entityId}-${safeSlug}-${hash}.${extension}`;
  const relativePath = path.posix.join(folderName, fileName);
  const absoluteDir = path.join(assetBaseDir, folderName);
  const absolutePath = path.join(absoluteDir, fileName);

  await fs.mkdir(absoluteDir, { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    absolutePath,
    relativePath,
    publicUrl: `${publicBasePath}/${relativePath.replace(/\\/g, '/')}`,
    bytes: buffer.byteLength,
    extension,
  };
}

function buildPollinationsImageUrl({ prompt, width, height, seed }) {
  const encodedPrompt = encodeURIComponent(prompt);
  const url = new URL(`https://image.pollinations.ai/prompt/${encodedPrompt}`);
  url.searchParams.set('width', String(width || DEFAULT_WORLD_COVER_WIDTH));
  url.searchParams.set('height', String(height || DEFAULT_WORLD_COVER_HEIGHT));
  url.searchParams.set('model', 'flux');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('enhance', 'true');
  if (seed !== undefined && seed !== null) {
    url.searchParams.set('seed', String(seed));
  }
  return url.toString();
}

function createPollinationsProvider() {
  return {
    name: 'pollinations',
    async generate(request) {
      return {
        imageUrl: buildPollinationsImageUrl(request),
        revisedPrompt: request.prompt,
      };
    },
  };
}

function createCloudflareProvider({ accountId, apiToken, model = '@cf/stabilityai/stable-diffusion-xl-base-1.0', fetchImpl = fetch }) {
  if (!trimString(accountId) || !trimString(apiToken)) {
    throw new Error('Cloudflare provider 缺少 accountId 或 apiToken');
  }

  return {
    name: 'cloudflare',
    async generate(request) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          width: request.width,
          height: request.height,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare 请求失败: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/png';
      return {
        imageUrl: `data:${contentType};base64,${base64}`,
        revisedPrompt: request.prompt,
      };
    },
  };
}

function createDefaultCoverProviders(env = process.env, { fetchImpl = fetch } = {}) {
  const providers = [createPollinationsProvider()];

  if (trimString(env.CLOUDFLARE_ACCOUNT_ID) && trimString(env.CLOUDFLARE_API_TOKEN)) {
    providers.push(createCloudflareProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      model: trimString(env.CLOUDFLARE_IMAGE_MODEL) || '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      fetchImpl,
    }));
  }

  return providers;
}

async function generateAndStoreAsset({
  brief,
  request,
  title,
  entityType,
  providers,
  assetBaseDir = GENERATED_ASSET_BASE_DIR,
  publicBasePath = GENERATED_ASSET_BASE_PATH,
  fetchImpl = fetch,
}) {
  const errors = [];

  for (const provider of providers || []) {
    for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS; attempt += 1) {
      try {
        const generated = await provider.generate(request);
        const stored = await saveGeneratedAsset({
          entityType,
          entityId: brief.entityId,
          title,
          sourceUrl: generated.imageUrl,
          assetBaseDir,
          publicBasePath,
          fetchImpl,
        });

        return {
          brief,
          generation: {
            provider: provider.name,
            ...generated,
          },
          stored,
        };
      } catch (error) {
        if (attempt === PROVIDER_ATTEMPTS) {
          errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }
  }

  throw new Error(errors.length > 0 ? errors.join(' | ') : '没有可用的图像生成 provider');
}

async function generateAndStoreWorldCover({
  world,
  providers,
  assetBaseDir = GENERATED_ASSET_BASE_DIR,
  publicBasePath = GENERATED_ASSET_BASE_PATH,
  fetchImpl = fetch,
}) {
  const brief = buildWorldCoverBrief(world);
  return generateAndStoreAsset({
    brief,
    request: {
      prompt: buildWorldCoverPrompt(brief),
      negativePrompt: buildWorldCoverNegativePrompt(brief),
      width: brief.width,
      height: brief.height,
    },
    title: brief.title,
    entityType: 'world',
    providers,
    assetBaseDir,
    publicBasePath,
    fetchImpl,
  });
}

async function generateAndStoreCharacterAvatar({
  character,
  providers,
  assetBaseDir = GENERATED_ASSET_BASE_DIR,
  publicBasePath = GENERATED_ASSET_BASE_PATH,
  fetchImpl = fetch,
}) {
  const brief = buildCharacterAvatarBrief(character);
  return generateAndStoreAsset({
    brief,
    request: {
      prompt: buildCharacterAvatarPrompt(brief),
      negativePrompt: buildWorldCoverNegativePrompt(brief),
      width: brief.width,
      height: brief.height,
    },
    title: brief.name,
    entityType: 'character',
    providers,
    assetBaseDir,
    publicBasePath,
    fetchImpl,
  });
}

module.exports = {
  GENERATED_ASSET_BASE_DIR,
  GENERATED_ASSET_BASE_PATH,
  buildCharacterAvatarBrief,
  buildCharacterAvatarPrompt,
  buildWorldCoverBrief,
  buildWorldCoverPrompt,
  buildWorldCoverNegativePrompt: buildWorldCoverNegativePromptCompat,
  createCloudflareProvider,
  createDefaultCoverProviders,
  createPollinationsProvider,
  generateAndStoreCharacterAvatar,
  generateAndStoreWorldCover,
  generateWithProviders,
  saveGeneratedAsset,
  sanitizeSlug,
};
