import { verifyProviderMediaToken, type ProviderMediaScope } from './provider-media-access.js';

interface MediaFile {
  baseDir: string;
  filename: string;
}

export function createProviderMediaRouteHandler(deps: {
  scope: ProviderMediaScope;
  secretKey: () => Buffer;
  userDataDirsForId: (userId: string) => { inputDir: string; outputDir: string };
  sendStaticFile: (response: import('node:http').ServerResponse, baseDir: string, rawRel: string) => Promise<void>;
  resolveSharedResourceContent: (itemId: string, actorId: string) => Promise<MediaFile | null>;
  resolveGenerationArtifactContent: (artifactId: string, actorId: string) => Promise<MediaFile | null>;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());
  return async function handleProviderMediaRoute({
    request,
    response,
    url,
  }: {
    request: import('node:http').IncomingMessage;
    response: import('node:http').ServerResponse;
    url: URL;
  }) {
    const match = url.pathname.match(/^\/api\/provider-media\/([^/]+)$/);
    if (!match || request.method !== 'GET') return false;
    let token = '';
    try {
      token = decodeURIComponent(match[1]);
    } catch {
      return fail(response, 403, 'PROVIDER_MEDIA_TOKEN_INVALID');
    }
    const claim = verifyProviderMediaToken(token, deps.secretKey(), now());
    if (!claim || claim.scope !== deps.scope) return fail(response, 403, 'PROVIDER_MEDIA_TOKEN_INVALID');

    const file = await resolveClaim(claim.sourceType, claim.sourceId, claim.actorId);
    if (!file) return fail(response, 404, 'PROVIDER_MEDIA_SOURCE_NOT_FOUND');
    await deps.sendStaticFile(response, file.baseDir, file.filename);
    return true;
  };

  async function resolveClaim(sourceType: string, sourceId: string, actorId: string): Promise<MediaFile | null> {
    if (sourceType === 'shared-resource') return deps.resolveSharedResourceContent(sourceId, actorId);
    if (sourceType === 'generation-artifact') return deps.resolveGenerationArtifactContent(sourceId, actorId);
    if (sourceType !== 'user-file') return null;
    const [bucket, ...filenameParts] = sourceId.split('/');
    const filename = filenameParts.join('/');
    if (!['input', 'output'].includes(bucket) || !safeFilename(filename)) return null;
    const dirs = deps.userDataDirsForId(actorId);
    return { baseDir: bucket === 'input' ? dirs.inputDir : dirs.outputDir, filename };
  }
}

function safeFilename(value: string) {
  return Boolean(value) && !value.includes('\\') && !value.split('/').some((part) => !part || part === '.' || part === '..');
}

function fail(response: import('node:http').ServerResponse, status: number, error: string) {
  response.statusCode = status;
  response.setHeader?.('content-type', 'application/json');
  response.end?.(JSON.stringify({ ok: false, success: false, error }));
  return true;
}
