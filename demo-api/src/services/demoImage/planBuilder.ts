import { buildDemoImagePrompt } from './promptBuilder';
import { buildDemoImageProviderPlan, supportedDemoImageProviders } from './providers';
import { buildDemoRelicBrief, getDemoRelicBlueprint } from './relicBriefs';
import type {
  DemoImagePlanManifest,
  DemoImageProviderId,
  DemoImageProviderPlan,
  DemoImageVariant,
  DemoRelicId,
  DemoRelicPlan,
} from './types';

function normalizeSelectedProviders(input?: readonly DemoImageProviderId[]): readonly DemoImageProviderId[] {
  if (!input || input.length === 0) {
    return ['pollinations'];
  }

  return Array.from(new Set(input));
}

function selectReadyProvider(
  providerPlans: readonly DemoImageProviderPlan[],
  selectedProviders: readonly DemoImageProviderId[],
): DemoImageProviderPlan {
  for (const providerId of selectedProviders) {
    const matched = providerPlans.find((plan) => plan.providerId === providerId);
    if (matched && matched.availability === 'ready') {
      return matched;
    }
  }

  const firstSelected = providerPlans.find((plan) => selectedProviders.includes(plan.providerId));
  if (firstSelected) {
    return firstSelected;
  }

  return providerPlans[0]!;
}

export interface BuildDemoImagePlanManifestOptions {
  readonly relicIds?: readonly DemoRelicId[];
  readonly providerIds?: readonly DemoImageProviderId[];
  readonly dryRun?: boolean;
  readonly seedOffset?: number;
  readonly planOutputDirectory: string;
  readonly imageOutputDirectory: string;
  readonly planId?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export function buildDemoImagePlanManifest(
  options: BuildDemoImagePlanManifestOptions,
): DemoImagePlanManifest {
  const env = options.env ?? process.env;
  const relicIds = options.relicIds ?? ['grandma', 'cat', 'team', 'feishu-cli'];
  const providerIds = normalizeSelectedProviders(options.providerIds);
  const seedOffset = options.seedOffset ?? 0;

  const relicPlans: DemoRelicPlan[] = relicIds.map((relicId) => {
    const blueprint = getDemoRelicBlueprint(relicId);
    const variants: readonly DemoImageVariant[] = ['cover', 'avatar'];

    return {
      relicId,
      siteRelicId: blueprint.siteRelicId,
      slug: blueprint.slug,
      displayName: blueprint.displayName,
      outputs: variants.map((variant) => {
        const brief = buildDemoRelicBrief(relicId, variant, seedOffset);
        const prompt = buildDemoImagePrompt(brief);
        const providerPlans = supportedDemoImageProviders.map((providerId) => buildDemoImageProviderPlan(providerId, brief, prompt, env));
        const selectedProviderPlan = selectReadyProvider(providerPlans, providerIds);

        return {
          variant,
          output: blueprint.outputs.find((item) => item.variant === variant)!,
          brief,
          prompt,
          outputFilePath: `${options.imageOutputDirectory.replace(/\\/g, '/')}/${brief.filename}`,
          providerPlans,
          selectedProviderId: selectedProviderPlan.providerId,
          selectedProviderPlan,
        };
      }),
    };
  });

  return {
    planId: options.planId ?? `demo-image-plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun ?? false,
    seedOffset,
    requestedProviderIds: providerIds,
    selectedProviderId: providerIds[0] ?? 'pollinations',
    planOutputDirectory: options.planOutputDirectory.replace(/\\/g, '/'),
    imageOutputDirectory: options.imageOutputDirectory.replace(/\\/g, '/'),
    availableProviders: supportedDemoImageProviders,
    relicPlans,
  };
}
