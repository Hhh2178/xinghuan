import { strict as assert } from 'node:assert';

async function main() {
  const workflowResource = await import('../apps/web/src/utils/workflowResource.ts');

  assert.equal(
    typeof (workflowResource as Record<string, unknown>).resolveWorkflowResourceFragment,
    'function',
    'resolveWorkflowResourceFragment export is missing',
  );

  const resolveWorkflowResourceFragment = (workflowResource as {
    createWorkflowResourceManifest: (fragment: any, options?: { title?: string }) => Record<string, any>;
    resolveWorkflowResourceFragment: (
      item: Record<string, any>,
      fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    ) => Promise<Record<string, any> | null>;
  }).resolveWorkflowResourceFragment;

  const manifest = workflowResource.createWorkflowResourceManifest(
    {
      nodes: [
        {
          id: 'node-1',
          type: 'llm',
          position: { x: 20, y: 40 },
          data: { label: 'LLM 节点' },
        },
      ],
      edges: [],
      sourceCanvasId: 'canvas-1',
    },
    { title: '测试工作流' },
  );

  let fetchCount = 0;
  const embeddedFragment = await resolveWorkflowResourceFragment(
    {
      id: 'workflow-embedded',
      kind: 'workflow',
      title: '测试工作流',
      workflowFragment: manifest,
    },
    async () => {
      fetchCount += 1;
      throw new Error('embedded workflow should not hit network');
    },
  );

  assert(embeddedFragment, 'embedded workflow fragment should resolve');
  assert.equal(fetchCount, 0, 'embedded workflow fragment should not fetch fileUrl');
  assert.equal(Array.isArray(embeddedFragment?.nodes), true, 'embedded workflow fragment nodes missing');
  assert.equal(embeddedFragment?.nodes?.length, 1, 'embedded workflow fragment node count mismatch');

  const fetchedFragment = await resolveWorkflowResourceFragment(
    {
      id: 'workflow-remote',
      kind: 'workflow',
      title: '远端工作流',
      fileUrl: '/files/workflow-remote.json',
    },
    async () => {
      fetchCount += 1;
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  );

  assert(fetchedFragment, 'remote workflow fragment should resolve');
  assert.equal(fetchCount, 1, 'remote workflow fragment should fetch exactly once');
  assert.equal(fetchedFragment?.nodes?.length, 1, 'remote workflow fragment node count mismatch');

  console.log(JSON.stringify({
    ok: true,
    verified: [
      'embedded workflow resource resolves without network',
      'file-backed workflow resource resolves with single fetch',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
