import { describe, expect, it } from 'vitest';
import {
  signProviderMediaClaim,
  verifyProviderMediaToken,
  type ProviderMediaClaim,
} from './provider-media-access.js';

const secret = Buffer.from('provider-media-test-secret');
const claim: ProviderMediaClaim = {
  version: 1,
  scope: 'gray',
  actorId: 'user-1',
  sourceType: 'shared-resource',
  sourceId: 'resource-1',
  expiresAt: 2_000,
};

describe('provider media access token', () => {
  it('round-trips a relative logical claim', () => {
    const token = signProviderMediaClaim(claim, secret);
    expect(verifyProviderMediaToken(token, secret, 1_000)).toEqual(claim);
    expect(token).not.toContain('http');
    expect(token).not.toContain('/opt/');
    expect(token).not.toContain('C:');
  });

  it('rejects expiry and signature tampering', () => {
    const token = signProviderMediaClaim(claim, secret);
    expect(verifyProviderMediaMediaToken(token, secret, 2_001)).toBeNull();
    expect(verifyProviderMediaToken(`${token.slice(0, -1)}x`, secret, 1_000)).toBeNull();
  });
});

function verifyProviderMediaMediaToken(token: string, key: Buffer, now: number) {
  return verifyProviderMediaToken(token, key, now);
}
