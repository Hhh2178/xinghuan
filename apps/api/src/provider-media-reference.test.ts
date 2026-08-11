import { describe, expect, it } from 'vitest';
import {
  ProviderMediaReferenceError,
  createProviderMediaReferenceResolver,
} from './provider-media-reference.js';
import type { ProviderMediaClaim } from './provider-media-access.js';

function resolver() {
  return createProviderMediaReferenceResolver({
    signClaim: (claim: ProviderMediaClaim) => `signed-${claim.sourceType}-${claim.sourceId}`,
    authorizeSharedResource: async (_actorId: string, id: string) => id === 'shared-1',
    authorizeGenerationArtifact: async (_actorId: string, id: string) => id === 'artifact-1',
  });
}

describe('provider media reference resolver', () => {
  it('creates runtime URLs for user, shared and generation references', async () => {
    const resolve = resolver();
    await expect(resolve({ reference: '/files/input/source.png', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .resolves.toBe('https://gray.example/api/provider-media/gray/signed-user-file-input%2Fsource.png');
    await expect(resolve({ reference: '/api/shared-resources/items/shared-1/content', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .resolves.toBe('https://gray.example/api/provider-media/gray/signed-shared-resource-shared-1');
    await expect(resolve({ reference: '/api/materials/generation-library/artifact-1/content', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .resolves.toBe('https://gray.example/api/provider-media/gray/signed-generation-artifact-artifact-1');
  });

  it('changes only the outgoing origin when the same logical reference moves servers', async () => {
    const resolve = resolver();
    const reference = '/api/shared-resources/items/shared-1/content';
    const first = await resolve({ reference, kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://server-a.example', environment: 'gray' });
    const second = await resolve({ reference, kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://server-b.example', environment: 'gray' });
    expect(new URL(first).pathname).toBe(new URL(second).pathname);
    expect(new URL(first).origin).not.toBe(new URL(second).origin);
  });

  it('passes data and external HTTPS URLs while rejecting unknown internal paths', async () => {
    const resolve = resolver();
    await expect(resolve({ reference: 'data:image/png;base64,AAAA', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .resolves.toBe('data:image/png;base64,AAAA');
    await expect(resolve({ reference: 'https://cdn.example/image.png', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .resolves.toBe('https://cdn.example/image.png');
    await expect(resolve({ reference: '/api/unknown/internal', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .rejects.toMatchObject({ code: 'LLM_MEDIA_REFERENCE_UNSUPPORTED' });
  });

  it('rejects unauthorized shared resources and path traversal', async () => {
    const resolve = resolver();
    await expect(resolve({ reference: '/api/shared-resources/items/other/content', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .rejects.toMatchObject({ code: 'LLM_MEDIA_REFERENCE_FORBIDDEN' });
    await expect(resolve({ reference: '/files/input/../secret.png', kind: 'image', actor: { id: 'user-1' }, publicOrigin: 'https://gray.example', environment: 'gray' }))
      .rejects.toBeInstanceOf(ProviderMediaReferenceError);
  });
});
