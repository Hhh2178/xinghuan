import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

function assertNoMatch(source, pattern, message) {
  if (pattern.test(source)) {
    throw new Error(message);
  }
}

const canvasSource = read('apps/web/src/components/Canvas.tsx');
const groupBoxSource = read('apps/web/src/components/nodes/GroupBoxNode.tsx');
const viewportHotkeysSource = read('apps/web/src/components/canvas/useCanvasViewportHotkeys.ts');
const apiKeysSource = read('apps/web/src/stores/apiKeys.ts');
const apiSettingsSource = read('apps/web/src/components/ApiSettings.tsx');
const apiSettingsKeySectionsSource = read('apps/web/src/components/ApiSettingsKeySections.tsx');
const apiSettingsKeyFieldSource = read('apps/web/src/components/ApiSettingsKeyField.tsx');
const apiSettingsHelpersSource = read('apps/web/src/components/apiSettingsHelpers.ts');
const canvasTypesSource = read('apps/web/src/types/canvas.ts');

assertMatch(
  canvasSource,
  /minZoom=\{CANVAS_MIN_ZOOM\}/,
  'Canvas must wire ReactFlow minZoom to shared CANVAS_MIN_ZOOM.',
);
assertMatch(
  viewportHotkeysSource,
  /fitView\(\{ padding: 0\.18, duration: 420, minZoom: CANVAS_MIN_ZOOM, maxZoom: CANVAS_MAX_ZOOM \}\)/,
  'Viewport overview shortcut must use shared zoom bounds.',
);
assertMatch(
  groupBoxSource,
  /locked\?: boolean;/,
  'GroupBoxData must include locked state.',
);
assertMatch(
  groupBoxSource,
  /const locked = d\?\.locked !== false;/,
  'GroupBoxNode must treat legacy groups as locked by default.',
);
assertMatch(
  groupBoxSource,
  /title=\{locked \? '解锁分组' : '锁定分组'\}/,
  'GroupBoxNode must render a lock toggle button.',
);
assertMatch(
  canvasSource,
  /locked: true,/,
  'New groups must be created as locked by default.',
);
assertMatch(
  canvasSource,
  /draggable: false,/,
  'New locked groups must disable dragging at creation time.',
);
assertNoMatch(
  apiKeysSource,
  /ai\.t8star\.org|runninghub\.cn|runninghub\.ai/,
  'Api key store should not hardcode legacy external service URLs.',
);
assertNoMatch(
  apiSettingsKeyFieldSource,
  /ai\.t8star\.org|runninghub\.cn|runninghub\.ai/,
  'API settings key field should not link to legacy external service URLs.',
);
assertNoMatch(
  apiSettingsKeySectionsSource,
  /FIXED_ZHENZHEN_BASE|RH_BASE|Base URL 锁定:/,
  'API settings key sections should not show legacy fixed base URL copy.',
);
assertNoMatch(
  apiSettingsSource,
  /FIXED_ZHENZHEN_BASE|RH_BASE/,
  'API settings modal should not import legacy fixed base URLs.',
);
assertNoMatch(
  apiSettingsHelpersSource,
  /fixedZhenzhenBaseUrl|runningHubBaseUrl/,
  'API settings backup helper should not depend on legacy fixed base URL args.',
);
assertNoMatch(
  canvasTypesSource,
  /ai\.t8star\.org|runninghub\.cn/,
  'Canvas ApiSettings type comments should not mention legacy external URLs.',
);

console.log('verify-canvas-group-lock-and-api-settings-contract: OK');
