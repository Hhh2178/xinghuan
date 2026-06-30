import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

async function main() {
  const appSource = await readFile(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8');
  const storeSource = await readFile(new URL('../apps/web/src/stores/performanceMode.ts', import.meta.url), 'utf8');

  assert.match(
    storeSource,
    /export type PerformanceMode = 'normal' \| 'optimized';/,
    'performance mode store should expose normal/optimized modes',
  );
  assert.match(
    storeSource,
    /mode:\s*'normal'/,
    'performance mode should default to normal/off',
  );
  assert.match(
    storeSource,
    /name:\s*'xinghuan-canvas-performance-mode-v1'/,
    'performance mode should persist under a stable storage key',
  );
  assert.match(
    storeSource,
    /partialize:\s*\(state\)\s*=>\s*\(\{\s*mode:\s*state\.mode\s*\}\)/,
    'performance mode persistence should only store the selected mode',
  );

  assert.match(
    appSource,
    /usePerformanceModeStore/,
    'App should read the persisted performance mode store',
  );
  assert.match(
    appSource,
    /performanceMode === 'optimized' \? 'reduced' : 'default'/,
    'App should map optimized mode to reduced visual rendering',
  );
  assert.match(
    appSource,
    /window\.location\.reload\(\)/,
    'performance mode toggling should force a full page reload',
  );
  assert.match(
    appSource,
    /性能优化/,
    'topbar should expose a visible performance mode control',
  );

  console.log('verify-performance-mode-toggle-contract: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
