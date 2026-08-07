import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readAgentRuntimeProcessGates } from '../apps/api/src/agent-runtime-gates';

assert.deepEqual(readAgentRuntimeProcessGates({}), {
  apiCanvasRunsEnabled: false,
  workerCanvasRunsEnabled: false,
});
assert.deepEqual(readAgentRuntimeProcessGates({
  XINGHUAN_CANVAS_RUNS_ENABLED: 'true',
  XINGHUAN_CANVAS_RUN_WORKER_ENABLED: 'true',
}), {
  apiCanvasRunsEnabled: true,
  workerCanvasRunsEnabled: true,
});
assert.equal(readAgentRuntimeProcessGates({ XINGHUAN_CANVAS_RUNS_ENABLED: 'TRUE' }).apiCanvasRunsEnabled, false);

const root = process.cwd();
const assistantPanel = readFileSync(join(root, 'apps/admin/src/admin-assistant-panel.tsx'), 'utf8');
const routeHandler = readFileSync(join(root, 'apps/api/src/admin-agent-governance-routes.ts'), 'utf8');
assert.doesNotMatch(assistantPanel, /id: ["'`]assistant-welcome["'`][\s\S]{0,220}mode: ["'`]fallback["'`]/);
assert.doesNotMatch(assistantPanel, /id: `assistant-welcome-\$\{Date\.now\(\)\}`[\s\S]{0,220}mode: ["'`]fallback["'`]/);
assert.match(routeHandler, /processGates: deps\.readProcessGates\(\)/);

console.log('verify-agent-runtime-gate-diagnostics: ok');
