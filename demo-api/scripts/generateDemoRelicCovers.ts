import fs from 'node:fs/promises';
import path from 'node:path';

import {
  executeDemoImageProvider,
  exportGeneratedImage,
  verifyGeneratedImage,
} from '../src/services/demoImage/providers';
import { buildDemoImagePlanManifest } from '../src/services/demoImage/planBuilder';
import type {
  DemoImageExecutionRecord,
  DemoImagePlanManifest,
  DemoImageProviderId,
  DemoRelicId,
  RunDemoImagePlanResult,
} from '../src/services/demoImage/types';

const DEFAULT_PROVIDER_IDS: readonly DemoImageProviderId[] = ['pollinations'];
const DEFAULT_RELIC_IDS: readonly DemoRelicId[] = ['grandma', 'cat', 'team', 'feishu-cli'];
const DEFAULT_IMAGE_OUTPUT_DIRECTORY = path.resolve(__dirname, '../../demo-site/public/images/relics');
const DEFAULT_PLAN_OUTPUT_DIRECTORY = path.resolve(__dirname, '../generated/demo-image-plans');

interface CliOptions {
  readonly providerIds: readonly DemoImageProviderId[];
  readonly relicIds: readonly DemoRelicId[];
  readonly dryRun: boolean;
  readonly imageOutputDirectory: string;
  readonly planOutputDirectory: string;
}

interface RunDemoImagePlanOptions extends CliOptions {
  readonly env?: NodeJS.ProcessEnv;
}

function normalizeProviderId(raw: string): DemoImageProviderId {
  switch (raw.trim().toLowerCase()) {
    case 'pollinations':
    case 'openai':
    case 'google':
    case 'openrouter':
    case 'replicate':
      return raw.trim().toLowerCase() as DemoImageProviderId;
    default:
      throw new Error(`未知 provider: ${raw}`);
  }
}

function normalizeRelicId(raw: string): DemoRelicId {
  switch (raw.trim().toLowerCase()) {
    case 'grandma':
    case 'cat':
    case 'team':
    case 'feishu-cli':
      return raw.trim().toLowerCase() as DemoRelicId;
    default:
      throw new Error(`未知 relic: ${raw}`);
  }
}

function parseListArgument<T>(
  value: string,
  mapper: (item: string) => T,
): readonly T[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(mapper);
}

function parseCliArgs(argv: readonly string[]): CliOptions {
  const providerIds: DemoImageProviderId[] = [];
  const relicIds: DemoRelicId[] = [];
  let dryRun = false;
  let seedOffset = 0;
  let imageOutputDirectory = DEFAULT_IMAGE_OUTPUT_DIRECTORY;
  let planOutputDirectory = DEFAULT_PLAN_OUTPUT_DIRECTORY;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--plan' || arg === '--provider') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error(`${arg} 需要一个值`);
      }
      providerIds.push(...parseListArgument(nextValue, normalizeProviderId));
      index += 1;
      continue;
    }

    if (arg.startsWith('--plan=')) {
      providerIds.push(...parseListArgument(arg.slice('--plan='.length), normalizeProviderId));
      continue;
    }

    if (arg === '--seed-offset') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--seed-offset 需要一个值');
      }
      seedOffset = Number.parseInt(nextValue, 10);
      if (!Number.isFinite(seedOffset)) {
        throw new Error('--seed-offset 必须是整数');
      }
      index += 1;
      continue;
    }

    if (arg.startsWith('--seed-offset=')) {
      seedOffset = Number.parseInt(arg.slice('--seed-offset='.length), 10);
      if (!Number.isFinite(seedOffset)) {
        throw new Error('--seed-offset 必须是整数');
      }
      continue;
    }

    if (arg === '--relic') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--relic 需要一个值');
      }
      relicIds.push(...parseListArgument(nextValue, normalizeRelicId));
      index += 1;
      continue;
    }

    if (arg.startsWith('--relic=')) {
      relicIds.push(...parseListArgument(arg.slice('--relic='.length), normalizeRelicId));
      continue;
    }

    if (arg === '--output-dir') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--output-dir 需要一个值');
      }
      imageOutputDirectory = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      imageOutputDirectory = path.resolve(arg.slice('--output-dir='.length));
      continue;
    }

    if (arg === '--plan-dir') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('--plan-dir 需要一个值');
      }
      planOutputDirectory = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg.startsWith('--plan-dir=')) {
      planOutputDirectory = path.resolve(arg.slice('--plan-dir='.length));
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  return {
    providerIds: providerIds.length > 0 ? Array.from(new Set(providerIds)) : DEFAULT_PROVIDER_IDS,
    relicIds: relicIds.length > 0 ? Array.from(new Set(relicIds)) : DEFAULT_RELIC_IDS,
    dryRun,
    imageOutputDirectory,
    planOutputDirectory,
  };
}

async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printManifestSummary(manifest: DemoImagePlanManifest): void {
  console.log(`\n=== 图片生成计划 ${manifest.planId} ===`);
  console.log(`dry-run: ${manifest.dryRun ? 'yes' : 'no'}`);
  console.log(`请求 provider 顺序: ${manifest.requestedProviderIds.join(' -> ')}`);
  console.log(`图片输出目录: ${manifest.imageOutputDirectory}`);
  console.log(`计划输出目录: ${manifest.planOutputDirectory}`);

  for (const relicPlan of manifest.relicPlans) {
    console.log(`\n[${relicPlan.relicId}] ${relicPlan.displayName}`);

    for (const output of relicPlan.outputs) {
      console.log(`- ${output.variant}: ${output.output.filename}`);
      console.log(`  brief: ${output.brief.narrativeHook}`);
      console.log(`  prompt: ${output.prompt.positive}`);
      console.log(`  negative: ${output.prompt.negative}`);
      console.log(`  selected provider: ${output.selectedProviderPlan.providerId} (${output.selectedProviderPlan.availability})`);
      console.log(`  providers: ${output.providerPlans.map((plan) => `${plan.providerId}:${plan.availability}`).join(', ')}`);
      console.log(`  output file: ${output.outputFilePath}`);
    }
  }
}

async function writeSnapshots(runDirectory: string, manifest: DemoImagePlanManifest): Promise<string> {
  const snapshotsDirectory = path.join(runDirectory, 'snapshots');
  await ensureDirectory(snapshotsDirectory);

  for (const relicPlan of manifest.relicPlans) {
    const relicDirectory = path.join(snapshotsDirectory, relicPlan.relicId);
    await ensureDirectory(relicDirectory);

    for (const output of relicPlan.outputs) {
      const snapshotPath = path.join(relicDirectory, `${output.variant}.json`);
      await writeJsonFile(snapshotPath, {
        relicId: relicPlan.relicId,
        siteRelicId: relicPlan.siteRelicId,
        displayName: relicPlan.displayName,
        variant: output.variant,
        filename: output.output.filename,
        outputFilePath: output.outputFilePath,
        brief: output.brief,
        prompt: output.prompt,
        providerPlans: output.providerPlans,
        selectedProviderId: output.selectedProviderId,
      });
    }
  }

  return snapshotsDirectory;
}

async function executeManifest(manifest: DemoImagePlanManifest, env: NodeJS.ProcessEnv): Promise<readonly DemoImageExecutionRecord[]> {
  const records: DemoImageExecutionRecord[] = [];
  await ensureDirectory(manifest.imageOutputDirectory);

  for (const relicPlan of manifest.relicPlans) {
    for (const output of relicPlan.outputs) {
      const selectedPlan = output.selectedProviderPlan;

      if (manifest.dryRun) {
        records.push({
          relicId: relicPlan.relicId,
          variant: output.variant,
          filename: output.output.filename,
          outputFilePath: output.outputFilePath,
          status: 'skipped',
          reason: 'dry-run',
        });
        continue;
      }

      if (selectedPlan.implementationMode !== 'live' || selectedPlan.availability !== 'ready') {
        records.push({
          relicId: relicPlan.relicId,
          variant: output.variant,
          filename: output.output.filename,
          outputFilePath: output.outputFilePath,
          status: 'skipped',
          reason: `${selectedPlan.providerId}:${selectedPlan.availability}`,
        });
        continue;
      }

      const executed = await executeDemoImageProvider({
        plan: selectedPlan,
        prompt: output.prompt,
        brief: output.brief,
        env,
      });
      await exportGeneratedImage(executed.buffer, output.brief, output.outputFilePath);
      await verifyGeneratedImage(output.outputFilePath, output.brief);

      records.push({
        relicId: relicPlan.relicId,
        variant: output.variant,
        filename: output.output.filename,
        outputFilePath: output.outputFilePath,
        status: 'generated',
      });
    }
  }

  return records;
}

export async function runDemoRelicCoverGeneration(options: RunDemoImagePlanOptions): Promise<RunDemoImagePlanResult> {
  await ensureDirectory(options.planOutputDirectory);
  const planId = `demo-image-plan-${Date.now()}`;
  const runDirectory = path.join(options.planOutputDirectory, planId);
  await ensureDirectory(runDirectory);

  const manifest = buildDemoImagePlanManifest({
    relicIds: options.relicIds,
    providerIds: options.providerIds,
    dryRun: options.dryRun,
    imageOutputDirectory: options.imageOutputDirectory,
    planOutputDirectory: runDirectory,
    planId,
    env: options.env,
  });

  const manifestPath = path.join(runDirectory, 'manifest.json');
  await writeJsonFile(manifestPath, manifest);
  const snapshotsDirectory = await writeSnapshots(runDirectory, manifest);
  const records = await executeManifest(manifest, options.env ?? process.env);
  await writeJsonFile(path.join(runDirectory, 'records.json'), records);

  return {
    manifest,
    manifestPath,
    runDirectory,
    snapshotsDirectory,
    records,
  };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const result = await runDemoRelicCoverGeneration(options);
  printManifestSummary(result.manifest);

  console.log('\n=== 执行结果 ===');
  for (const record of result.records) {
    console.log(`${record.relicId}/${record.variant}: ${record.status}${record.reason ? ` (${record.reason})` : ''} -> ${record.outputFilePath}`);
  }
  console.log(`\nmanifest: ${result.manifestPath}`);
  console.log(`snapshots: ${result.snapshotsDirectory}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { parseCliArgs };
