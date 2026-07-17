import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const [migration, providerRoutes, repository, server, adminPanel, modelEditor, webApi] = await Promise.all([
  read('apps/api/db/023_provider_model_display_order.sql'),
  read('apps/api/src/admin-provider-routes.ts'),
  read('apps/api/src/provider-repository.ts'),
  read('apps/api/src/server.ts'),
  read('apps/admin/src/admin-api-settings-panel.tsx'),
  read('apps/admin/src/admin-model-editor.tsx'),
  read('apps/web/src/services/api.ts'),
]);

assert.match(migration, /xh_providers[\s\S]*sort_order/, 'Provider display order migration is missing.');
assert.match(migration, /xh_models[\s\S]*sort_order/, 'Model display order migration is missing.');
assert.match(providerRoutes, /PROVIDER_PATH}\/reorder/, 'Admin Provider reorder route is missing.');
assert.match(repository, /reorderProviderRecords/, 'Provider reorder repository boundary is missing.');
assert.match(repository, /reorderModelRecords/, 'Model reorder repository boundary is missing.');
assert.match(server, /models\/reorder/, 'Admin model reorder route is missing.');
assert.match(server, /providerOrder/, 'Public model catalog must apply Provider display order.');
assert.match(server, /sortOrder: normalizeCatalogSortOrder\(model\.sortOrder\)/, 'Public model catalog must expose normalized model order.');
assert.match(adminPanel, /上移平台/, 'Provider order controls are missing.');
assert.match(adminPanel, /下移平台/, 'Provider order controls are missing.');
assert.match(modelEditor, /上移模型/, 'Model order controls are missing.');
assert.match(modelEditor, /下移模型/, 'Model order controls are missing.');
assert.match(webApi, /sortOrder: number/, 'Canvas model catalog types must carry display order.');

console.log('PASS catalog display order contract');
