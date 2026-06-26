import { strict as assert } from 'node:assert';

async function main() {
  const webMigration = await import('../apps/web/src/utils/nodeMigration.ts');
  const workflowResource = await import('../apps/web/src/utils/workflowResource.ts');
  const apiMigration = await import('../apps/api/src/canvas-node-migration.ts');

  const importedLlmNode = {
    id: 'llm-imported-1',
    type: 'llm',
    position: { x: 120, y: 80 },
    data: {
      status: 'success',
      taskId: 'task-old-1',
      progress: '100%',
      error: null,
      prompt: 'legacy user prompt',
      reply: 'stale assistant reply',
      userPrompt: 'keep this user prompt',
      history: [
        {
          role: 'user',
          text: 'old multimodal request',
          images: ['/files/output/old-image.png'],
        },
        {
          role: 'assistant',
          text: 'old multimodal answer',
        },
      ],
      generatedImages: ['/files/output/generated-old.png'],
      imageUrl: '/files/output/generated-old.png',
      imageUrls: ['/files/output/generated-old.png'],
      consumedTexts: ['old text output'],
      userPromptMentions: [],
    },
  };

  const migratedNode = webMigration.migrateImportedNodeData(importedLlmNode as any);
  const migratedData = (migratedNode as any).data || {};

  assert.equal(migratedData.userPrompt, 'keep this user prompt', 'existing userPrompt should be preserved');
  for (const field of [
    'status',
    'taskId',
    'progress',
    'reply',
    'prompt',
    'history',
    'generatedImages',
    'imageUrl',
    'imageUrls',
    'consumedTexts',
  ]) {
    assert.equal(field in migratedData, false, `web migration should drop stale llm field: ${field}`);
  }

  const legacyPromptOnlyNode = webMigration.migrateImportedNodeData({
    id: 'llm-legacy-only',
    type: 'llm',
    position: { x: 0, y: 0 },
    data: {
      prompt: 'legacy prompt only',
      status: 'idle',
    },
  } as any);

  assert.equal((legacyPromptOnlyNode as any).data.userPrompt, 'legacy prompt only', 'legacy prompt should be promoted to userPrompt');
  assert.equal('prompt' in ((legacyPromptOnlyNode as any).data || {}), false, 'legacy prompt field should be removed after promotion');

  const apiCleaned = apiMigration.cleanImportedNodeData('llm', importedLlmNode.data) as Record<string, unknown>;
  assert.equal(apiCleaned.userPrompt, 'keep this user prompt', 'api migration should preserve userPrompt');
  for (const field of [
    'status',
    'taskId',
    'progress',
    'reply',
    'prompt',
    'history',
    'generatedImages',
    'imageUrl',
    'imageUrls',
    'consumedTexts',
  ]) {
    assert.equal(field in apiCleaned, false, `api migration should drop stale llm field: ${field}`);
  }

  const manifest = workflowResource.createWorkflowResourceManifest({
    nodes: [importedLlmNode as any],
    edges: [],
    sourceCanvasId: 'canvas-1',
  });

  const fragment = workflowResource.workflowManifestToFragment(manifest) as { nodes: Array<{ data?: Record<string, unknown> }> } | null;
  assert(fragment, 'workflow manifest should resolve to fragment');
  const fragmentNodeData = fragment?.nodes?.[0]?.data || {};
  for (const field of ['reply', 'prompt', 'history', 'generatedImages', 'imageUrl', 'imageUrls']) {
    assert.equal(field in fragmentNodeData, false, `workflow fragments should not preserve stale llm field: ${field}`);
  }

  console.log(JSON.stringify({
    ok: true,
    verified: [
      'web llm import migration clears stale conversation and output state',
      'legacy llm prompt is promoted to userPrompt',
      'api llm import migration matches web cleanup contract',
      'workflow resource manifests keep llm nodes clean on save and restore',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
