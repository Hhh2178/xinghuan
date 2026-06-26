import { strict as assert } from 'node:assert';

async function main() {
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init });
    return new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const api = await import('../apps/web/src/services/api.ts');

    await api.getResourceItems({ kind: 'workflow', categoryId: 'all' });
    assert.equal(fetchCalls.length, 1, 'expected one request for all-category query');
    const allUrl = new URL(fetchCalls[0].url, 'http://localhost');
    assert.equal(allUrl.searchParams.get('kind'), 'workflow', 'kind should still be forwarded');
    assert.equal(allUrl.searchParams.has('categoryId'), false, 'categoryId=all should not be forwarded to backend');

    await api.getResourceItems({ kind: 'workflow', categoryId: 'cat-workflow-1' });
    assert.equal(fetchCalls.length, 2, 'expected second request for concrete category query');
    const categoryUrl = new URL(fetchCalls[1].url, 'http://localhost');
    assert.equal(categoryUrl.searchParams.get('categoryId'), 'cat-workflow-1', 'real categoryId should still be forwarded');

    console.log(JSON.stringify({
      ok: true,
      verified: [
        'categoryId=all omitted from getResourceItems query',
        'concrete categoryId preserved in getResourceItems query',
      ],
    }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
