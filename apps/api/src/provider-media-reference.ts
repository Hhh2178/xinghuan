import {
  type ProviderMediaClaim,
  type ProviderMediaScope,
  type ProviderMediaSourceType,
} from './provider-media-access.js';

export type ProviderMediaKind = 'image' | 'video';

export interface ProviderMediaResolveInput {
  reference: string;
  kind: ProviderMediaKind;
  actor: { id: string };
  publicOrigin: string;
  environment?: ProviderMediaScope;
}

export interface ProviderMediaResolverDependencies {
  signClaim: (claim: ProviderMediaClaim) => string;
  authorizeSharedResource: (actorId: string, itemId: string) => Promise<boolean>;
  authorizeGenerationArtifact: (actorId: string, artifactId: string) => Promise<boolean>;
  now?: () => number;
  ttlMs?: number;
}

export class ProviderMediaReferenceError extends Error {
  constructor(public code: string, message = code) {
    super(message);
  }
}

export function createProviderMediaReferenceResolver(deps: ProviderMediaResolverDependencies) {
  const now = deps.now ?? (() => Date.now());
  const ttlMs = deps.ttlMs ?? 5 * 60 * 1000;
  return async function resolveProviderMediaReference(input: ProviderMediaResolveInput): Promise<string> {
    const reference = String(input.reference || '').trim();
    if (!reference) throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
    const origin = normalizeOrigin(input.publicOrigin);

    if (/^data:/i.test(reference)) return validateDataUrl(reference, input.kind);
    if (/^https:\/\//i.test(reference)) {
      const parsed = new URL(reference);
      if (parsed.origin !== origin) return reference;
      return resolvePath(parsed.pathname, input, deps, now, ttlMs);
    }
    if (/^http:\/\//i.test(reference)) throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
    if (/^[a-z]+:\/\//i.test(reference) || /^[A-Za-z]:[\\/]/.test(reference)) {
      throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
    }
    return resolvePath(reference, input, deps, now, ttlMs);
  };
}

async function resolvePath(
  rawPath: string,
  input: ProviderMediaResolveInput,
  deps: ProviderMediaResolverDependencies,
  now: () => number,
  ttlMs: number,
) {
  const pathname = normalizeLogicalPath(rawPath);
  const userFileMatch = pathname.match(/^\/(?:files\/)?(input|output)\/(.+)$/i);
  if (userFileMatch) {
    const sourceId = `${userFileMatch[1].toLowerCase()}/${safeFilename(userFileMatch[2])}`;
    return signReference({ input, sourceType: 'user-file', sourceId, now, ttlMs }, deps);
  }

  const sharedMatch = pathname.match(/^\/api\/shared-resources\/items\/([^/]+)\/content$/);
  if (sharedMatch) {
    const sourceId = decodeSegment(sharedMatch[1]);
    if (!await deps.authorizeSharedResource(input.actor.id, sourceId)) {
      throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_FORBIDDEN');
    }
    return signReference({ input, sourceType: 'shared-resource', sourceId, now, ttlMs }, deps);
  }

  const artifactMatch = pathname.match(/^\/api\/materials\/generation-library\/([^/]+)\/content$/);
  if (artifactMatch) {
    const sourceId = decodeSegment(artifactMatch[1]);
    if (!await deps.authorizeGenerationArtifact(input.actor.id, sourceId)) {
      throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_FORBIDDEN');
    }
    return signReference({ input, sourceType: 'generation-artifact', sourceId, now, ttlMs }, deps);
  }

  throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
}

function signReference(input: {
  input: ProviderMediaResolveInput;
  sourceType: ProviderMediaSourceType;
  sourceId: string;
  now: () => number;
  ttlMs: number;
}, deps: ProviderMediaResolverDependencies) {
  const environment = input.input.environment || 'local';
  const claim: ProviderMediaClaim = {
    version: 1,
    scope: environment,
    actorId: input.input.actor.id,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    expiresAt: input.now() + input.ttlMs,
  };
  const token = deps.signClaim(claim);
  return new URL(
    `/api/provider-media/${environment}/${encodeURIComponent(token)}`,
    normalizeOrigin(input.input.publicOrigin),
  ).toString();
}

function normalizeOrigin(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new ProviderMediaReferenceError('LLM_MEDIA_PUBLIC_ORIGIN_INVALID');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new ProviderMediaReferenceError('LLM_MEDIA_PUBLIC_ORIGIN_INVALID');
  }
  return parsed.origin;
}

function normalizeLogicalPath(value: string) {
  const path = String(value || '').trim();
  if (!path.startsWith('/') || path.includes('\\') || path.includes('?') || path.includes('#')) {
    throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
  }
  const decoded = decodeURIComponent(path);
  const segments = decoded.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..' || segment === '')) {
    if (segments.some((segment) => segment === '.' || segment === '..')) {
      throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
    }
  }
  return decoded;
}

function decodeSegment(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded.includes('/') || decoded.includes('\\') || decoded === '.' || decoded === '..') {
      throw new Error('invalid');
    }
    return decoded;
  } catch {
    throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
  }
}

function safeFilename(value: string) {
  const decoded = decodeURIComponent(value);
  if (!decoded || decoded.includes('/') || decoded.includes('\\') || decoded === '.' || decoded === '..') {
    throw new ProviderMediaReferenceError('LLM_MEDIA_REFERENCE_UNSUPPORTED');
  }
  return decoded;
}

function validateDataUrl(value: string, kind: ProviderMediaKind) {
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match || !match[1].toLowerCase().startsWith(`${kind}/`)) {
    throw new ProviderMediaReferenceError('LLM_MEDIA_KIND_MISMATCH');
  }
  if (Buffer.byteLength(match[2], 'base64') > 20 * 1024 * 1024) {
    throw new ProviderMediaReferenceError('LLM_MEDIA_DATA_URL_TOO_LARGE');
  }
  return value;
}
