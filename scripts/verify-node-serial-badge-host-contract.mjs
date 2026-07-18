import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const canvas = await readFile(new URL('../apps/web/src/components/Canvas.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../apps/web/src/styles/index.css', import.meta.url), 'utf8');

assert.match(
  canvas,
  /const WrappedNode = \(props: any\) => \(\s*<div className="t8-node-serial-host">[\s\S]*<NodeSerialBadge/,
  'serial badge wrapper must expose one stable DOM host to ReactFlow',
);
assert.match(canvas, /badgeEl\?\.offsetParent instanceof HTMLElement/, 'badge anchoring must use the actual positioned ancestor');
assert.match(styles, /\.t8-node-serial-host\s*\{\s*display:\s*contents;/, 'serial host must not change node layout');

console.log('PASS node serial badge stable host contract');
