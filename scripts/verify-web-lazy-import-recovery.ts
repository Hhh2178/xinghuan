import { strict as assert } from "node:assert";

import {
  DYNAMIC_IMPORT_RECOVERY_KEY,
  createLazyImportWithReloadRecovery,
  isDynamicImportFetchFailure,
} from "../apps/web/src/utils/lazyImportRecovery";

type SessionStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createSessionStorageMock(): SessionStorageMock {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

async function main() {
  assert.equal(
    isDynamicImportFetchFailure(new Error("Failed to fetch dynamically imported module: /assets/LLMNode-old.js")),
    true,
    "standard dynamic import fetch failure should be recognized",
  );
  assert.equal(
    isDynamicImportFetchFailure(new Error("Importing a module script failed.")),
    true,
    "Safari-style dynamic import failure should be recognized",
  );
  assert.equal(
    isDynamicImportFetchFailure(new Error("普通渲染错误")),
    false,
    "generic render errors must not trigger reload recovery",
  );

  const sessionStorage = createSessionStorageMock();
  let reloadCount = 0;
  const dynamicImportError = new Error("Failed to fetch dynamically imported module: /assets/LLMNode-old.js");

  const importer = createLazyImportWithReloadRecovery(
    async () => {
      throw dynamicImportError;
    },
    {
      sessionStorage,
      reload: () => {
        reloadCount += 1;
      },
    },
  );

  await assert.rejects(importer, /Failed to fetch dynamically imported module/);
  assert.equal(reloadCount, 1, "first stale chunk failure should force one reload");
  assert.equal(
    sessionStorage.getItem(DYNAMIC_IMPORT_RECOVERY_KEY),
    "1",
    "reload marker should be stored after first recovery attempt",
  );

  await assert.rejects(importer, /Failed to fetch dynamically imported module/);
  assert.equal(reloadCount, 1, "second failure in same session must not loop reloads");

  sessionStorage.setItem(DYNAMIC_IMPORT_RECOVERY_KEY, "1");
  const successImporter = createLazyImportWithReloadRecovery(
    async () => ({ default: { node: "ok" } }),
    {
      sessionStorage,
      reload: () => {
        reloadCount += 1;
      },
    },
  );

  const result = await successImporter();
  assert.deepEqual(result, { default: { node: "ok" } });
  assert.equal(
    sessionStorage.getItem(DYNAMIC_IMPORT_RECOVERY_KEY),
    null,
    "successful import should clear any stale recovery marker",
  );

  console.log("PASS web lazy import recovery");
}

void main();
