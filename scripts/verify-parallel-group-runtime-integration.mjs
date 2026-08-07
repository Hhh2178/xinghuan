import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtime = readFileSync(join(root, 'apps/web/src/components/canvas/useCanvasRuntime.ts'), 'utf8');
const canvas = readFileSync(join(root, 'apps/web/src/components/Canvas.tsx'), 'utf8');
const groupBox = readFileSync(join(root, 'apps/web/src/components/nodes/GroupBoxNode.tsx'), 'utf8');
const overlay = readFileSync(join(root, 'apps/web/src/components/canvas/CanvasOverlayLayer.tsx'), 'utf8');

assert.match(runtime, /createGroupRunScheduler/);
assert.match(runtime, /buildGroupExecutionPlan/);
assert.match(runtime, /handleRunGroup = useCallback\(\s*async \(groupId: string, ids: string\[\], executionCount = 1\)/);
assert.doesNotMatch(runtime, /async \(groupId: string, ids: string\[\], executionCount = 1\)[\s\S]{0,180}if \(isRunning\) return/);
assert.match(runtime, /getSnapshot\(\)\.activeGroupIds\.length === 0[\s\S]{0,100}cancelRunRef\.current = false/);
assert.match(runtime, /manualGroupSchedulerRef\.current\?\.cancelAll\(\)/);
assert.match(canvas, /handleRunGroup\(executeReq\.groupId, executeReq\.memberIds, executeReq\.executionCount\)/);
assert.match(groupBox, /useGroupRunStore/);
assert.match(groupBox, /activeGroupIds\.includes\(id\)/);
assert.doesNotMatch(groupBox, /useEffect\(\(\) => \{[\s\S]{0,400}updateData\(\{ memberIds: liveMemberIds \}\)/);
assert.match(groupBox, /const onUp = \(\) => \{[\s\S]{0,500}getGroupBoxLiveMemberIds/);
assert.match(canvas, /拖动结束后一次性冻结所有分组的几何成员/);
assert.match(overlay, /runNotice/);
assert.doesNotMatch(overlay, /backdrop-filter|backdropBlur|fixed inset-0/);

console.log('verify-parallel-group-runtime-integration: ok');
