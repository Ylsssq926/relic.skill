import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildDemoImagePlanManifest } from '../src/services/demoImage/planBuilder';
import { buildDemoImagePrompt } from '../src/services/demoImage/promptBuilder';
import { executeDemoImageProvider, resolveRetryDelayMilliseconds, shouldRetryImageRequest } from '../src/services/demoImage/providers';
import { buildDemoRelicBrief } from '../src/services/demoImage/relicBriefs';
import { runDemoRelicCoverGeneration } from '../scripts/generateDemoRelicCovers';

test('prompt builder 会根据 relic 类型和 variant 生成不同 prompt', () => {
  const grandmaCover = buildDemoImagePrompt(buildDemoRelicBrief('grandma', 'cover'));
  const grandmaAvatar = buildDemoImagePrompt(buildDemoRelicBrief('grandma', 'avatar'));
  const catCover = buildDemoImagePrompt(buildDemoRelicBrief('cat', 'cover'));
  const teamAvatar = buildDemoImagePrompt(buildDemoRelicBrief('team', 'avatar'));

  assert.notEqual(grandmaCover.positive, grandmaAvatar.positive);
  assert.match(grandmaCover.positive, /hero cover artwork/i);
  assert.match(grandmaAvatar.positive, /avatar portrait artwork/i);
  assert.match(catCover.positive, /orange tabby cat/i);
  assert.match(teamAvatar.positive, /five-person startup team/i);
});

test('plan builder 能生成多 provider 的方案对象', () => {
  const manifest = buildDemoImagePlanManifest({
    relicIds: ['grandma'],
    providerIds: ['openai', 'pollinations', 'replicate'],
    dryRun: true,
    planOutputDirectory: '/tmp/demo-image-plans',
    imageOutputDirectory: '/tmp/demo-image-outputs',
    env: {},
  });

  const outputPlan = manifest.relicPlans[0]?.outputs[0];
  assert.ok(outputPlan);
  assert.deepEqual(manifest.requestedProviderIds, ['openai', 'pollinations', 'replicate']);
  assert.equal(outputPlan.selectedProviderPlan.providerId, 'pollinations');
  assert.equal(outputPlan.providerPlans.find((plan) => plan.providerId === 'openai')?.availability, 'missing-env');
  assert.equal(outputPlan.providerPlans.find((plan) => plan.providerId === 'replicate')?.implementationMode, 'manifest-only');
  assert.equal(outputPlan.providerPlans.find((plan) => plan.providerId === 'pollinations')?.availability, 'ready');
});

test('dry-run 会输出完整计划而不发真实请求', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-image-dry-run-'));
  const planDir = path.join(tempRoot, 'plans');
  const outputDir = path.join(tempRoot, 'images');

  const result = await runDemoRelicCoverGeneration({
    providerIds: ['pollinations'],
    relicIds: ['grandma'],
    dryRun: true,
    planOutputDirectory: planDir,
    imageOutputDirectory: outputDir,
    env: {},
  });

  const manifestRaw = await fs.readFile(result.manifestPath, 'utf8');
  const snapshotRaw = await fs.readFile(path.join(result.snapshotsDirectory, 'grandma', 'cover.json'), 'utf8');

  assert.ok(manifestRaw.includes('"dryRun": true'));
  assert.ok(manifestRaw.includes('grandma-cover.jpg'));
  assert.ok(snapshotRaw.includes('Pollinations'));
  assert.ok(result.records.every((record) => record.status === 'skipped' && record.reason === 'dry-run'));
});

test('奶奶、猫、团队三组示例都能完成计划构建', () => {
  const manifest = buildDemoImagePlanManifest({
    relicIds: ['grandma', 'cat', 'team'],
    providerIds: ['google'],
    dryRun: true,
    planOutputDirectory: '/tmp/demo-image-plans',
    imageOutputDirectory: '/tmp/demo-image-outputs',
    env: {},
  });

  assert.equal(manifest.relicPlans.length, 3);
  assert.deepEqual(manifest.relicPlans.map((plan) => plan.relicId), ['grandma', 'cat', 'team']);
  for (const relicPlan of manifest.relicPlans) {
    assert.equal(relicPlan.outputs.length, 2);
    for (const output of relicPlan.outputs) {
      assert.ok(output.brief.displayName.length > 0);
      assert.ok(output.prompt.positive.length > 0);
      assert.ok(output.providerPlans.some((plan) => plan.providerId === 'google'));
    }
  }
});

test('429 限流时会按重试策略继续请求直到成功', async () => {
  const manifest = buildDemoImagePlanManifest({
    relicIds: ['grandma'],
    providerIds: ['pollinations'],
    dryRun: false,
    planOutputDirectory: '/tmp/demo-image-plans',
    imageOutputDirectory: '/tmp/demo-image-outputs',
    env: {},
  });
  const output = manifest.relicPlans[0]?.outputs[0];
  assert.ok(output);

  const calls: number[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls.push(Date.now());
    if (calls.length === 1) {
      return new Response('rate limit', {
        status: 429,
        headers: { 'retry-after': '0' },
      });
    }

    return new Response(Buffer.from('fake-image-data'), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  }) as typeof fetch;

  try {
    const result = await executeDemoImageProvider({
      plan: output.selectedProviderPlan,
      prompt: output.prompt,
      brief: output.brief,
      env: {},
    });

    assert.equal(result.providerId, 'pollinations');
    assert.equal(calls.length, 2);
    assert.equal(result.contentType, 'image/png');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('重试延迟会识别 retry-after 和 429 状态', () => {
  assert.equal(shouldRetryImageRequest(429), true);
  assert.equal(shouldRetryImageRequest(503), true);
  assert.equal(shouldRetryImageRequest(404), false);
  assert.equal(resolveRetryDelayMilliseconds(1, '0'), 0);
  assert.equal(resolveRetryDelayMilliseconds(2, null), 3000);
});

test('seed offset 会进入 manifest 并影响 brief seed', () => {
  const manifest = buildDemoImagePlanManifest({
    relicIds: ['grandma'],
    providerIds: ['pollinations'],
    dryRun: true,
    planOutputDirectory: '/tmp/demo-image-plans',
    imageOutputDirectory: '/tmp/demo-image-outputs',
    seedOffset: 17,
    env: {},
  });

  const cover = manifest.relicPlans[0]?.outputs.find((item) => item.variant === 'cover');
  const avatar = manifest.relicPlans[0]?.outputs.find((item) => item.variant === 'avatar');

  assert.ok(cover);
  assert.ok(avatar);
  assert.equal(manifest.seedOffset, 17);
  assert.equal(cover.brief.seed, 1211 + 17);
  assert.equal(avatar.brief.seed, 1212 + 17);
});
