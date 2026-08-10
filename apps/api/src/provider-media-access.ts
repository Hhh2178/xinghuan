import { createHmac, timingSafeEqual } from 'node:crypto';

export type ProviderMediaScope = 'local' | 'gray' | 'production';
export type ProviderMediaSourceType = 'user-file' | 'shared-resource' | 'generation-artifact';

export interface ProviderMediaClaim {
  version: 1;
  scope: ProviderMediaScope;
  actorId: string;
  sourceType: ProviderMediaSourceType;
  sourceId: string;
  expiresAt: number;
}

export function signProviderMediaClaim(claim: ProviderMediaClaim, secret: Buffer) {
  const normalized = normalizeClaim(claim);
  const payload = encode(JSON.stringify(normalized));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyProviderMediaToken(token: string, secret: Buffer, now = Date.now()): ProviderMediaClaim | null {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const claim = normalizeClaim(JSON.parse(decode(payload)) as ProviderMediaClaim);
    return claim.expiresAt > now ? claim : null;
  } catch {
    return null;
  }
}

function normalizeClaim(value: ProviderMediaClaim): ProviderMediaClaim {
  if (!value || value.version !== 1) throw new Error('INVALID_PROVIDER_MEDIA_CLAIM');
  const scope = value.scope === 'local' || value.scope === 'gray' || value.scope === 'production' ? value.scope : '';
  const sourceType = value.sourceType === 'user-file' || value.sourceType === 'shared-resource' || value.sourceType === 'generation-artifact'
    ? value.sourceType
    : '';
  const actorId = safeSegment(value.actorId);
  const sourceId = safeSourceId(value.sourceId);
  const expiresAt = Number(value.expiresAt);
  if (!scope || !sourceType || !actorId || !sourceId || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error('INVALID_PROVIDER_MEDIA_CLAIM');
  }
  return { version: 1, scope, actorId, sourceType, sourceId, expiresAt: Math.floor(expiresAt) };
}

function safeSegment(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length > 160 || /[\\/\0]/.test(text)) throw new Error('INVALID_PROVIDER_MEDIA_CLAIM');
  return text;
}

function safeSourceId(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length > 300 || /(?:^|[\\/])\.\.(?:[\\/]|$)|^[A-Za-z]:[\\/]|^\//.test(text)) {
    throw new Error('INVALID_PROVIDER_MEDIA_CLAIM');
  }
  return text;
}

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}
