import {
  demoImageStyleBible,
  getMoodStyleHints,
  getRelicTypeStyleHints,
  getVariantStyleHints,
} from './styleBible';
import type {
  DemoImageBrief,
  DemoImageOutputSpec,
  DemoImageVariant,
  DemoRelicBlueprint,
  DemoRelicId,
} from './types';

const DEFAULT_OUTPUTS: readonly DemoImageOutputSpec[] = [
  {
    variant: 'cover',
    filename: 'cover.jpg',
    width: 1920,
    height: 1080,
    requestWidth: 1280,
    requestHeight: 720,
    exportFormat: 'jpeg',
    mimeType: 'image/jpeg',
  },
  {
    variant: 'avatar',
    filename: 'avatar.jpg',
    width: 512,
    height: 512,
    requestWidth: 512,
    requestHeight: 512,
    exportFormat: 'jpeg',
    mimeType: 'image/jpeg',
  },
] as const;

export const demoRelicBlueprints: Readonly<Record<DemoRelicId, DemoRelicBlueprint>> = {
  grandma: {
    id: 'grandma',
    siteRelicId: 'grandma',
    slug: 'grandma-demo',
    relicType: 'human',
    displayName: '奶奶 · 王秀兰',
    subjectName: '王秀兰',
    category: '家人',
    description: '会在过年时主动问你"吃饺子了没"',
    detail: '不是 AI,是那个永远担心你的奶奶。会在你加班到深夜时唠叨"别光顾着干活"。',
    narrativeHook: '那个永远担心你吃饭和睡觉的奶奶，在家里留着一口热饭等你。',
    mood: 'nostalgic',
    traits: ['温暖', '唠叨', '爱做饭', '担心孙辈'],
    subjectProfile: [
      'elderly Chinese grandmother in her seventies',
      'kind smile, gentle wrinkles, soft silver hair',
      'comforting, trustworthy, emotionally grounded presence',
    ],
    environment: [
      'cozy family home',
      'dining table, kitchen window, steam from home-cooked food',
      'lived-in domestic space with subtle nostalgic details',
    ],
    palette: ['warm orange', 'amber', 'soft beige'],
    emotionalTone: ['comforting', 'tender', 'nostalgic'],
    basePromptAdditions: [
      'natural realism, elegant composition, tender humanity',
      'Chinese family memory, authentic domestic atmosphere',
    ],
    variantPromptAdditions: {
      cover: [
        'half-body portrait near dining table and kitchen window',
        'soft evening light, storytelling background, one clear focal subject',
      ],
      avatar: [
        'close-up portrait with direct warm eye contact',
        'face centered and clearly visible for avatar crop',
      ],
    },
    referenceAssetUrls: {
      cover: '/images/relics/grandma-cover.svg',
      avatar: '/images/relics/grandma-avatar.svg',
    },
    seedBase: 1211,
    outputs: DEFAULT_OUTPUTS.map((output) => ({
      ...output,
      filename: `grandma-${output.filename}`,
    })),
  },
  cat: {
    id: 'cat',
    siteRelicId: 'mimi',
    slug: 'cat-demo',
    relicType: 'pet',
    displayName: '猫 · 咪咪 · 橘猫 · 14斤',
    subjectName: '咪咪',
    category: '猫',
    description: '凌晨三点突然开始跑酷',
    detail: '14 斤的重量压在你手腕上,呼噜声、踩奶动作、那个熟悉的温度。',
    narrativeHook: '那只半夜三点开始跑酷、又会踩奶呼噜的 14 斤橘猫。',
    mood: 'joyful',
    traits: ['橘猫', '14斤', '爱跑酷', '爱踩奶', '呼噜声'],
    subjectProfile: [
      'chubby orange tabby cat with clearly visible stripes',
      'round cheeks, bright amber eyes, expressive whiskers',
      'adorable lively expression, realistic fur detail',
    ],
    environment: [
      'cozy apartment interior',
      'sofa, cat tower, blanket, sunlit or warmly lit corner',
      'clean household scene that still feels lived in',
    ],
    palette: ['orange', 'golden yellow', 'warm cream'],
    emotionalTone: ['playful', 'bright', 'affectionate'],
    basePromptAdditions: [
      'cute and vivid household companion',
      'playful house-cat energy with tactile fur texture',
    ],
    variantPromptAdditions: {
      cover: [
        'captured in playful motion on sofa and cat tower',
        'dynamic yet clean composition with obvious cat features',
      ],
      avatar: [
        'close-up cat face portrait looking into camera',
        'centered square crop, expressive eyes, very cute nose and whiskers',
      ],
    },
    referenceAssetUrls: {
      cover: '/images/relics/cat-cover.svg',
      avatar: '/images/relics/cat-avatar.svg',
    },
    seedBase: 2207,
    outputs: DEFAULT_OUTPUTS.map((output) => ({
      ...output,
      filename: `cat-${output.filename}`,
    })),
  },
  team: {
    id: 'team',
    siteRelicId: 'spark-studio',
    slug: 'team-demo',
    relicType: 'team',
    displayName: '团队 · 星火工作室 · 5人创业团队',
    subjectName: '星火工作室',
    category: '创业',
    description: '那个永远在改需求的产品经理',
    detail: '凌晨还在群里讨论 bug 的 CTO。人散了,但那种一起熬夜的感觉还在。',
    narrativeHook: '一个五人创业团队，在深夜办公室里一起熬夜改 bug。',
    mood: 'energetic',
    traits: ['创业团队', '5人', '熬夜改bug', '产品经理爱改需求'],
    subjectProfile: [
      'five-person startup team, East Asian young professionals',
      'authentic collaboration, founder energy, solving problems together',
      'varied but cohesive personalities, no staged corporate posing',
    ],
    environment: [
      'modern minimal workspace',
      'screen glow, laptops, whiteboard, sticky notes, realistic contemporary office',
      'late-night debugging atmosphere without readable text on screens',
    ],
    palette: ['blue', 'teal', 'cool gray'],
    emotionalTone: ['focused', 'driven', 'collaborative'],
    basePromptAdditions: [
      'realistic contemporary office scene',
      'ensemble storytelling with believable teamwork dynamics',
    ],
    variantPromptAdditions: {
      cover: [
        'wide shot of five teammates around a desk, debugging late at night',
        'clear collaboration story, blue and teal monitor glow, one coherent group composition',
      ],
      avatar: [
        'tight group portrait around a laptop, smiling but focused',
        'centered square-safe composition, teamwork and startup vibe',
      ],
    },
    referenceAssetUrls: {
      cover: '/images/relics/team-cover.svg',
      avatar: '/images/relics/team-avatar.svg',
    },
    seedBase: 3301,
    outputs: DEFAULT_OUTPUTS.map((output) => ({
      ...output,
      filename: `team-${output.filename}`,
    })),
  },
  'feishu-cli': {
    id: 'feishu-cli',
    siteRelicId: 'feishu-cli-demo',
    slug: 'feishu-cli-demo',
    relicType: 'feishu-cli',
    displayName: '飞书 CLI · 翔宇科技 · 协作记忆体',
    subjectName: '翔宇科技',
    category: '飞书协作',
    description: '用飞书 CLI 蒸馏团队协作记忆，让那些一起扛过的夜继续发光',
    detail: '不是冷冰冰的聊天记录导出。是那个会在文档评论区写小作文的同事，是凌晨三点群里还在互相打气的默契。',
    narrativeHook: '一个用飞书协作的科技团队，用 CLI 把群聊记忆蒸馏成可对话的数字灵魂——那些深夜的飞书消息，每一条都是真的。',
    mood: 'energetic',
    traits: ['飞书协作', '科技团队', '群聊记忆', '文档评论'],
    subjectProfile: [
      'tech startup team collaborating through Feishu platform',
      'modern digital workspace with chat bubbles and document windows',
      'blue-themed Feishu UI aesthetic, collaborative energy',
    ],
    environment: [
      'digital workspace overlay',
      'Feishu chat interface, document editor, calendar events',
      'clean tech aesthetic with blue accent colors',
    ],
    palette: ['blue', 'indigo', 'cool white'],
    emotionalTone: ['collaborative', 'digital', 'efficient'],
    basePromptAdditions: [
      'modern tech collaboration scene with Feishu/Lark UI elements',
      'digital workspace aesthetic with blue theme',
    ],
    variantPromptAdditions: {
      cover: [
        'wide shot of team collaborating through Feishu on screens',
        'blue-themed digital workspace, chat bubbles, document windows',
      ],
      avatar: [
        'Feishu app icon style with team collaboration symbol',
        'centered square crop, clean tech design, blue gradient',
      ],
    },
    referenceAssetUrls: {
      cover: '/images/relics/feishu-cover.svg',
      avatar: '/images/relics/feishu-avatar.svg',
    },
    seedBase: 4412,
    outputs: DEFAULT_OUTPUTS.map((output) => ({
      ...output,
      filename: `feishu-cli-${output.filename}`,
    })),
  },
};

function uniqueItems(items: readonly string[]): readonly string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function getDemoRelicBlueprint(relicId: DemoRelicId): DemoRelicBlueprint {
  return demoRelicBlueprints[relicId];
}

export function getAllDemoRelicBlueprints(): readonly DemoRelicBlueprint[] {
  return Object.values(demoRelicBlueprints);
}

export function buildDemoRelicBrief(relicId: DemoRelicId, variant: DemoImageVariant, seedOffset: number = 0): DemoImageBrief {
  const blueprint = getDemoRelicBlueprint(relicId);
  const output = blueprint.outputs.find((item) => item.variant === variant);

  if (!output) {
    throw new Error(`未找到 ${relicId} 的 ${variant} 输出定义`);
  }

  const variantFocus = uniqueItems([
    ...getVariantStyleHints(variant),
    ...(blueprint.variantPromptAdditions[variant] ?? []),
  ]);
  const styleConstraints = uniqueItems([
    ...demoImageStyleBible.sharedStyleHints,
    ...getRelicTypeStyleHints(blueprint.relicType),
    ...getMoodStyleHints(blueprint.mood),
    ...blueprint.palette.map((value) => `${value} palette`),
  ]);
  const promptAdditions = uniqueItems([
    blueprint.narrativeHook,
    ...blueprint.basePromptAdditions,
    ...(blueprint.variantPromptAdditions[variant] ?? []),
  ]);

  return {
    relicId: blueprint.id,
    siteRelicId: blueprint.siteRelicId,
    slug: blueprint.slug,
    relicType: blueprint.relicType,
    variant,
    displayName: blueprint.displayName,
    subjectName: blueprint.subjectName,
    category: blueprint.category,
    description: blueprint.description,
    detail: blueprint.detail,
    narrativeHook: blueprint.narrativeHook,
    mood: blueprint.mood,
    traits: blueprint.traits,
    subjectProfile: blueprint.subjectProfile,
    environment: blueprint.environment,
    palette: blueprint.palette,
    emotionalTone: blueprint.emotionalTone,
    styleConstraints,
    variantFocus,
    promptAdditions,
    avoid: demoImageStyleBible.sharedNegativeHints,
    referenceAssetUrl: blueprint.referenceAssetUrls[variant],
    filename: output.filename,
    width: output.width,
    height: output.height,
    requestWidth: output.requestWidth,
    requestHeight: output.requestHeight,
    exportFormat: output.exportFormat,
    mimeType: output.mimeType,
    seed: blueprint.seedBase + (variant === 'avatar' ? 1 : 0) + seedOffset,
  };
}
