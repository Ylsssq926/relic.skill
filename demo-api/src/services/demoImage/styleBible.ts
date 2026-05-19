import type {
  DemoImageStyleBible,
  DemoImageVariant,
  DemoRelicMood,
  DemoRelicType,
} from './types';

export const demoImageStyleBible: DemoImageStyleBible = {
  projectName: 'relic.skill demo images',
  sharedStyleHints: [
    'premium emotional editorial illustration',
    'same product-universe visual language across all relics',
    'natural realism with gentle stylization',
    'soft cinematic lighting, clean focal composition',
    'high detail, polished textures, believable proportions',
    'no text, no logo, no watermark, no readable UI',
  ],
  sharedNegativeHints: [
    'text',
    'logo',
    'watermark',
    'signature',
    'blurry',
    'low quality',
    'extra limbs',
    'deformed anatomy',
    'duplicate subject',
    'cropped face',
    'readable text on screens',
    'poster typography',
  ],
  variantStyleHints: {
    cover: [
      'wide horizontal hero composition',
      'scene-led storytelling with clear environment cues',
      'single memorable focal subject or group',
      'desktop-web cover friendly framing',
    ],
    avatar: [
      'close-up identity portrait',
      'centered composition for square and circle crop safety',
      'clear silhouette, readable facial or subject features',
      'minimal background distraction',
    ],
  },
  relicTypeStyleHints: {
    human: [
      'human warmth, intergenerational affection',
      'domestic realism, comforting family memory',
      'subtle skin texture and expressive eyes',
    ],
    pet: [
      'companion animal charm',
      'tactile fur detail, playful motion cues',
      'cute but not cartoonish',
    ],
    team: [
      'ensemble collaboration energy',
      'modern startup documentary mood',
      'authentic teamwork rather than stock-photo posing',
    ],
    'feishu-cli': [
      'digital collaboration workspace',
      'Feishu/Lark blue-themed UI aesthetic',
      'clean tech design with chat and document elements',
    ],
  },
  moodStyleHints: {
    nostalgic: [
      'nostalgic glow',
      'warm amber highlights',
      'gentle sentimental calm',
    ],
    joyful: [
      'bright cheerful light',
      'playful energy',
      'inviting warmth',
    ],
    energetic: [
      'blue-green night glow',
      'focused momentum',
      'collaborative urgency',
    ],
  },
};

export function getVariantStyleHints(variant: DemoImageVariant): readonly string[] {
  return demoImageStyleBible.variantStyleHints[variant];
}

export function getRelicTypeStyleHints(relicType: DemoRelicType): readonly string[] {
  return demoImageStyleBible.relicTypeStyleHints[relicType];
}

export function getMoodStyleHints(mood: DemoRelicMood): readonly string[] {
  return demoImageStyleBible.moodStyleHints[mood];
}
