export type DemoRelicId = 'grandma' | 'cat' | 'team' | 'feishu-cli';
export type DemoRelicType = 'human' | 'pet' | 'team' | 'feishu-cli';
export type DemoRelicMood = 'nostalgic' | 'joyful' | 'energetic';
export type DemoImageVariant = 'cover' | 'avatar';
export type DemoImageProviderId = 'pollinations' | 'openai' | 'google' | 'openrouter' | 'replicate';
export type DemoImageExportFormat = 'jpeg' | 'png' | 'webp';
export type DemoImagePlanAvailability = 'ready' | 'missing-env' | 'manifest-only';
export type DemoImageImplementationMode = 'live' | 'manifest-only';
export type DemoImageRequestTransport = 'url' | 'http' | 'sdk';

export interface DemoImageOutputSpec {
  readonly variant: DemoImageVariant;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly requestWidth: number;
  readonly requestHeight: number;
  readonly exportFormat: DemoImageExportFormat;
  readonly mimeType: string;
}

export interface DemoRelicBlueprint {
  readonly id: DemoRelicId;
  readonly siteRelicId: string;
  readonly slug: string;
  readonly relicType: DemoRelicType;
  readonly displayName: string;
  readonly subjectName: string;
  readonly category: string;
  readonly description: string;
  readonly detail: string;
  readonly narrativeHook: string;
  readonly mood: DemoRelicMood;
  readonly traits: readonly string[];
  readonly subjectProfile: readonly string[];
  readonly environment: readonly string[];
  readonly palette: readonly string[];
  readonly emotionalTone: readonly string[];
  readonly basePromptAdditions: readonly string[];
  readonly variantPromptAdditions: Readonly<Record<DemoImageVariant, readonly string[]>>;
  readonly referenceAssetUrls: Readonly<Record<DemoImageVariant, string>>;
  readonly seedBase: number;
  readonly outputs: readonly DemoImageOutputSpec[];
}

export interface DemoImageStyleBible {
  readonly projectName: string;
  readonly sharedStyleHints: readonly string[];
  readonly sharedNegativeHints: readonly string[];
  readonly variantStyleHints: Readonly<Record<DemoImageVariant, readonly string[]>>;
  readonly relicTypeStyleHints: Readonly<Record<DemoRelicType, readonly string[]>>;
  readonly moodStyleHints: Readonly<Record<DemoRelicMood, readonly string[]>>;
}

export interface DemoImageBrief {
  readonly relicId: DemoRelicId;
  readonly siteRelicId: string;
  readonly slug: string;
  readonly relicType: DemoRelicType;
  readonly variant: DemoImageVariant;
  readonly displayName: string;
  readonly subjectName: string;
  readonly category: string;
  readonly description: string;
  readonly detail: string;
  readonly narrativeHook: string;
  readonly mood: DemoRelicMood;
  readonly traits: readonly string[];
  readonly subjectProfile: readonly string[];
  readonly environment: readonly string[];
  readonly palette: readonly string[];
  readonly emotionalTone: readonly string[];
  readonly styleConstraints: readonly string[];
  readonly variantFocus: readonly string[];
  readonly promptAdditions: readonly string[];
  readonly avoid: readonly string[];
  readonly referenceAssetUrl: string;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly requestWidth: number;
  readonly requestHeight: number;
  readonly exportFormat: DemoImageExportFormat;
  readonly mimeType: string;
  readonly seed: number;
}

export interface DemoImagePromptSnapshot {
  readonly positive: string;
  readonly negative: string;
  readonly sections: {
    readonly intro: readonly string[];
    readonly subject: readonly string[];
    readonly scene: readonly string[];
    readonly style: readonly string[];
    readonly variant: readonly string[];
    readonly additions: readonly string[];
  };
}

export interface DemoImageProviderRequest {
  readonly transport: DemoImageRequestTransport;
  readonly method: 'GET' | 'POST';
  readonly endpoint: string;
  readonly model: string;
  readonly sourceUrl?: string;
  readonly fallbackSourceUrl?: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly notes: readonly string[];
}

export interface DemoImageProviderPlan {
  readonly providerId: DemoImageProviderId;
  readonly displayName: string;
  readonly implementationMode: DemoImageImplementationMode;
  readonly availability: DemoImagePlanAvailability;
  readonly requiredEnv: readonly string[];
  readonly request: DemoImageProviderRequest;
  readonly taskList: readonly string[];
}

export interface DemoImageOutputPlan {
  readonly variant: DemoImageVariant;
  readonly output: DemoImageOutputSpec;
  readonly brief: DemoImageBrief;
  readonly prompt: DemoImagePromptSnapshot;
  readonly outputFilePath: string;
  readonly providerPlans: readonly DemoImageProviderPlan[];
  readonly selectedProviderId: DemoImageProviderId;
  readonly selectedProviderPlan: DemoImageProviderPlan;
}

export interface DemoRelicPlan {
  readonly relicId: DemoRelicId;
  readonly siteRelicId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly outputs: readonly DemoImageOutputPlan[];
}

export interface DemoImagePlanManifest {
  readonly planId: string;
  readonly generatedAt: string;
  readonly dryRun: boolean;
  readonly seedOffset: number;
  readonly requestedProviderIds: readonly DemoImageProviderId[];
  readonly selectedProviderId: DemoImageProviderId;
  readonly planOutputDirectory: string;
  readonly imageOutputDirectory: string;
  readonly availableProviders: readonly DemoImageProviderId[];
  readonly relicPlans: readonly DemoRelicPlan[];
}

export interface ExecuteDemoImageProviderInput {
  readonly plan: DemoImageProviderPlan;
  readonly prompt: DemoImagePromptSnapshot;
  readonly brief: DemoImageBrief;
  readonly env: NodeJS.ProcessEnv;
}

export interface ExecutedDemoImage {
  readonly providerId: DemoImageProviderId;
  readonly source: string;
  readonly contentType: string;
  readonly buffer: Buffer;
  readonly revisedPrompt?: string;
}

export interface DemoImageExecutionRecord {
  readonly relicId: DemoRelicId;
  readonly variant: DemoImageVariant;
  readonly filename: string;
  readonly outputFilePath: string;
  readonly status: 'generated' | 'skipped';
  readonly reason?: string;
}

export interface RunDemoImagePlanResult {
  readonly manifest: DemoImagePlanManifest;
  readonly manifestPath: string;
  readonly runDirectory: string;
  readonly snapshotsDirectory: string;
  readonly records: readonly DemoImageExecutionRecord[];
}
