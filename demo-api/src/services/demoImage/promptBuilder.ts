import type { DemoImageBrief, DemoImagePromptSnapshot } from './types';

function compact(items: readonly string[]): readonly string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function buildDemoImagePrompt(brief: DemoImageBrief): DemoImagePromptSnapshot {
  const intro = compact([
    'premium emotional relic illustration',
    brief.variant === 'cover' ? 'hero cover artwork' : 'avatar portrait artwork',
    'no text, no logo, no watermark',
  ]);

  const subject = compact([
    brief.displayName,
    brief.subjectName,
    brief.description,
    ...brief.subjectProfile,
    brief.traits.length > 0 ? `key traits: ${brief.traits.join(', ')}` : '',
  ]);

  const scene = compact([
    brief.narrativeHook,
    brief.detail,
    ...brief.environment,
    brief.emotionalTone.length > 0 ? `emotional tone: ${brief.emotionalTone.join(', ')}` : '',
  ]);

  const style = compact([
    ...brief.styleConstraints,
    brief.palette.length > 0 ? `palette emphasis: ${brief.palette.join(', ')}` : '',
  ]);

  const variant = compact([
    ...brief.variantFocus,
    brief.variant === 'cover'
      ? `requested landscape composition ${brief.requestWidth}x${brief.requestHeight}`
      : `requested avatar composition ${brief.requestWidth}x${brief.requestHeight}`,
  ]);

  const additions = compact(brief.promptAdditions);

  return {
    positive: [
      ...intro,
      ...subject,
      ...scene,
      ...style,
      ...variant,
      ...additions,
    ].join(', '),
    negative: brief.avoid.join(', '),
    sections: {
      intro,
      subject,
      scene,
      style,
      variant,
      additions,
    },
  };
}
