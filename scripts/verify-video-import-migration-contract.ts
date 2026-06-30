import { strict as assert } from 'node:assert';

async function main() {
  const webMigration = await import('../apps/web/src/utils/nodeMigration.ts');
  const apiMigration = await import('../apps/api/src/canvas-node-migration.ts');

  const importedVideoNode = {
    id: 'video-imported-1',
    type: 'video',
    position: { x: 120, y: 80 },
    data: {
      modelSource: 'backend',
      backendModelId: 'video-model-1',
      backendProviderId: 'provider-1',
      ratio: '16:9',
      duration: 6,
      resolution: '720p',
      prompt: '保留这个视频提示词',
      localRefImages: ['/files/input/ref-1.png'],
      generationCount: 2,
      status: 'polling',
      taskId: 'task-old-1',
      taskIds: ['task-old-1', 'task-old-2'],
      progress: '45%',
      error: '旧错误',
      taskRuns: [
        {
          batchIndex: 0,
          kind: 'video',
          status: 'running',
          progress: '45%',
          outputCount: 0,
        },
      ],
      videoUrl: '/files/output/old-video.mp4',
      videoUrls: ['/files/output/old-video.mp4'],
      remoteVideoUrls: ['https://remote.example.com/old-video.mp4'],
      startedAt: 1710000000000,
      finishedAt: 1710000001000,
      lastPrompt: '旧运行时 prompt',
      lastDurationMs: 1000,
    },
  };

  const migratedNode = webMigration.migrateImportedNodeData(importedVideoNode as any);
  const migratedData = (migratedNode as any).data || {};

  assert.equal(migratedData.modelSource, 'backend', 'video migration should preserve model source');
  assert.equal(migratedData.backendModelId, 'video-model-1', 'video migration should preserve backend model id');
  assert.equal(migratedData.prompt, '保留这个视频提示词', 'video migration should preserve editable prompt');
  assert.deepEqual(migratedData.localRefImages, ['/files/input/ref-1.png'], 'video migration should preserve local references');
  for (const field of [
    'status',
    'taskId',
    'taskIds',
    'progress',
    'error',
    'taskRuns',
    'videoUrl',
    'videoUrls',
    'remoteVideoUrls',
    'startedAt',
    'finishedAt',
    'lastPrompt',
    'lastDurationMs',
  ]) {
    assert.equal(field in migratedData, false, `web migration should drop stale video runtime field: ${field}`);
  }

  const apiCleaned = apiMigration.cleanImportedNodeData('video', importedVideoNode.data) as Record<string, unknown>;
  assert.equal(apiCleaned.modelSource, 'backend', 'api migration should preserve model source');
  assert.equal(apiCleaned.prompt, '保留这个视频提示词', 'api migration should preserve editable prompt');
  for (const field of [
    'status',
    'taskId',
    'taskIds',
    'progress',
    'error',
    'taskRuns',
    'videoUrl',
    'videoUrls',
    'remoteVideoUrls',
    'startedAt',
    'finishedAt',
    'lastPrompt',
    'lastDurationMs',
  ]) {
    assert.equal(field in apiCleaned, false, `api migration should drop stale video runtime field: ${field}`);
  }

  console.log(JSON.stringify({
    ok: true,
    verified: [
      'web video import migration clears stale runtime and output state',
      'api video import migration matches web cleanup contract',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
