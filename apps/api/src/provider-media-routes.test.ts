import { describe, expect, it } from 'vitest';
import { createProviderMediaRouteHandler } from './provider-media-routes.js';
import { signProviderMediaClaim } from './provider-media-access.js';

const secret = Buffer.from('route-secret');

function response() {
  return {
    statusCode: 0,
    headers: new Map<string, string>(),
    setHeader(name: string, value: string) { this.headers.set(name, value); },
  } as any;
}

describe('provider media route', () => {
  it('streams a valid user-file token without browser cookies', async () => {
    const served: string[] = [];
    const handler = createProviderMediaRouteHandler({
      scope: 'gray',
      secretKey: () => secret,
      userDataDirsForId: (id: string) => ({ inputDir: `/data/${id}/input`, outputDir: `/data/${id}/output` }),
      sendStaticFile: async (_response: any, baseDir: string, filename: string) => { served.push(`${baseDir}/${filename}`); },
      resolveSharedResourceContent: async () => null,
      resolveGenerationArtifactContent: async () => null,
    });
    const token = signProviderMediaClaim({ version: 1, scope: 'gray', actorId: 'user-1', sourceType: 'user-file', sourceId: 'input/source.png', expiresAt: Date.now() + 10_000 }, secret);
    const result = await handler({ request: { method: 'GET', headers: {} } as any, response: response(), url: new URL(`http://localhost/api/provider-media/gray/${encodeURIComponent(token)}`) });
    expect(result).toBe(true);
    expect(served).toEqual(['/data/user-1/input/source.png']);
  });

  it('rejects expired tokens before resolving a source', async () => {
    const handler = createProviderMediaRouteHandler({
      scope: 'gray',
      secretKey: () => secret,
      userDataDirsForId: () => ({ inputDir: '/data/input', outputDir: '/data/output' }),
      sendStaticFile: async () => { throw new Error('should not read'); },
      resolveSharedResourceContent: async () => null,
      resolveGenerationArtifactContent: async () => null,
      now: () => 2_000,
    });
    const token = signProviderMediaClaim({ version: 1, scope: 'gray', actorId: 'user-1', sourceType: 'shared-resource', sourceId: 'resource-1', expiresAt: 1_999 }, secret);
    const res = response();
    await handler({ request: { method: 'GET', headers: {} } as any, response: res, url: new URL(`http://localhost/api/provider-media/gray/${encodeURIComponent(token)}`) });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a token routed to the wrong environment scope', async () => {
    const handler = createProviderMediaRouteHandler({
      scope: 'gray',
      secretKey: () => secret,
      userDataDirsForId: () => ({ inputDir: '/data/input', outputDir: '/data/output' }),
      sendStaticFile: async () => { throw new Error('should not read'); },
      resolveSharedResourceContent: async () => null,
      resolveGenerationArtifactContent: async () => null,
    });
    const token = signProviderMediaClaim({ version: 1, scope: 'gray', actorId: 'user-1', sourceType: 'user-file', sourceId: 'input/source.png', expiresAt: Date.now() + 10_000 }, secret);
    const res = response();
    await handler({ request: { method: 'GET', headers: {} } as any, response: res, url: new URL(`http://localhost/api/provider-media/production/${encodeURIComponent(token)}`) });
    expect(res.statusCode).toBe(403);
  });
});
