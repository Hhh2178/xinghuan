import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const [registry, ports, codeNode, labelNode, groupExecutionManagerNode, codeRoutes, server, toolbar, modal, textSplit, textSplitGraph, runtime, guards, canvas, codeNodeApi] = await Promise.all([
  read('apps/web/src/config/nodeRegistry.ts'),
  read('apps/web/src/config/portTypes.ts'),
  read('apps/web/src/components/nodes/CodeNode.tsx'),
  read('apps/web/src/components/nodes/LabelNode.tsx'),
  read('apps/web/src/components/nodes/GroupExecutionManagerNode.tsx'),
  read('apps/api/src/code-node-routes.ts'),
  read('apps/api/src/server.ts'),
  read('apps/web/src/components/CanvasToolbar.tsx'),
  read('apps/web/src/components/WorkflowTemplateModal.tsx'),
  read('apps/web/src/components/nodes/TextSplitNode.tsx'),
  read('apps/web/src/components/nodes/textSplitGeneratedGraph.ts'),
  read('apps/web/src/components/canvas/useCanvasRuntime.ts'),
  read('apps/web/src/components/canvas/groupBoxGuards.ts'),
  read('apps/web/src/components/Canvas.tsx'),
  read('apps/web/src/services/codeNodeApi.ts'),
]);

assert.match(registry, /type: 'code'.*category: 'utility'.*color: 'orange'/, 'Code node must stay in the orange utility category.');
assert.match(registry, /type: 'label'.*category: 'auxiliary'.*color: 'slate'/, 'Label node must stay in the slate auxiliary category.');
assert.match(ports, /code: \{ inputs:/, 'Code node port contract is missing.');
assert.match(ports, /label: \{ inputs: \[\], outputs: \[\] \}/, 'Label node must remain portless.');
assert.match(codeNode, /useRunTrigger/, 'Code node must support grouped and manual execution through the shared trigger.');
assert.match(codeNodeApi, /\/api\/code-node\/execute/, 'Code node API client is missing.');
assert.match(codeNode, /保存为新预设/, 'Code node preset controls are missing.');
assert.doesNotMatch(labelNode, /<Handle\b/, 'Label node must not render React Flow handles.');
assert.match(labelNode, /固定在画布/, 'Label node lock control is missing.');
assert.match(labelNode, /ResizableCorners/, 'Label node must support canvas resizing.');
assert.match(labelNode, /keepAspectRatio=\{false\}/, 'Label node resizing must allow independent width and height changes.');
assert.match(labelNode, /width:\s*p\.width/, 'Label node must persist its resized width.');
assert.match(labelNode, /height:\s*p\.height/, 'Label node must persist its resized height.');
assert.match(groupExecutionManagerNode, /color: '#fb923c'/, 'Group execution manager header icon must use the orange utility color.');
assert.match(codeRoutes, /\/api\/code-node\/execute/, 'Code execution route is missing.');
assert.match(server, /handleCodeNodeRoutes/, 'API server must mount the code execution route.');
assert.match(await read('apps/api/src/code-node-runtime.ts'), /RLIMIT_AS/, 'Linux code runtime memory limit is missing.');
assert.match(await read('apps/api/src/code-node-runtime.ts'), /CODE_NODE_BUSY/, 'Code runtime concurrency limit is missing.');
assert.match(toolbar, /penguin:open-workflow-templates/, 'Toolbar must open the workflow template modal.');
assert.doesNotMatch(toolbar, /CANVAS_TEMPLATES/, 'Toolbar must not restore the static template catalog.');
assert.doesNotMatch(toolbar, /unreadCount/, 'Terminal toolbar control must not render a numeric badge.');
assert.match(modal, /getSharedResourceItems\(\{ kind: 'workflow'/, 'Template modal must use the shared workflow resource source.');
assert.match(modal, /WorkflowTopologyCard/, 'Template modal must reuse the shared workflow thumbnail component.');
assert.match(textSplit, /useRunTrigger/, 'Text split must be group-runnable.');
assert.match(textSplitGraph, /TEXT_SPLIT_RUN_MARKER = 'text-split-run'/, 'Text split must track generated output nodes.');
assert.match(textSplitGraph, /type: mode === 'output' \? 'output' : 'text'/, 'Text split default runs must generate output nodes.');
assert.match(canvas, /!n\.hidden/, 'Canvas quick-add menus must exclude hidden legacy nodes.');
assert.match(runtime, /runNodeWithRetries/, 'Canvas runtime must retry failed nodes.');
assert.match(runtime, /options\.maxRetries \?\? 3/, 'Node retry helper must default to three additional attempts.');
assert.match(runtime, /maxRetries: 3/, 'Canvas batch execution must use three additional attempts.');
assert.match(guards, /filterLockedNodePositionChanges/, 'Locked group position changes must be filtered.');
assert.match(canvas, /filterLockedNodePositionChanges\(changes, lockedDrag\?\.nodeId\)/, 'Canvas must apply the locked-position guard.');

console.log('PASS canvas workflow capabilities contract');
