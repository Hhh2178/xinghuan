import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

async function main() {
  const performanceMode = await import('../apps/web/src/utils/visualPerformanceMode.ts');
  const cssSource = await readFile(new URL('../apps/web/src/styles/index.css', import.meta.url), 'utf8');

  assert.equal(
    performanceMode.resolveVisualPerformanceMode({
      prefersReducedMotion: false,
      hardwareConcurrency: 12,
      deviceMemory: 16,
    }),
    'default',
    'high-end devices should stay on the default visual mode',
  );

  assert.equal(
    performanceMode.resolveVisualPerformanceMode({
      prefersReducedMotion: true,
      hardwareConcurrency: 12,
      deviceMemory: 16,
    }),
    'reduced',
    'reduced-motion preference should force reduced visual mode',
  );

  assert.equal(
    performanceMode.resolveVisualPerformanceMode({
      prefersReducedMotion: false,
      hardwareConcurrency: 4,
      deviceMemory: 8,
    }),
    'reduced',
    'low CPU concurrency should force reduced visual mode',
  );

  assert.equal(
    performanceMode.resolveVisualPerformanceMode({
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
      deviceMemory: 4,
    }),
    'reduced',
    'low device memory should force reduced visual mode',
  );

  assert.match(
    cssSource,
    /data-performance-mode=['"]reduced['"][\s\S]*\.xh-cursor-aura[\s\S]*display:\s*none/i,
    'reduced visual mode should disable cursor aura rendering',
  );
  assert.match(
    cssSource,
    /data-performance-mode=['"]reduced['"][\s\S]*\.react-flow__node[\s\S]*backdrop-filter:\s*none\s*!important/i,
    'reduced visual mode should disable node backdrop blur',
  );

  console.log('verify-visual-performance-mode-contract: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
