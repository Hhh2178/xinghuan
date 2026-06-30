import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const canvasFile = path.join(repoRoot, 'apps/web/src/components/Canvas.tsx');
const runtimeFile = path.join(repoRoot, 'apps/web/src/components/canvas/useCanvasRuntime.ts');
const viewportHotkeysFile = path.join(repoRoot, 'apps/web/src/components/canvas/useCanvasViewportHotkeys.ts');

function ensureExists(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Expected file to exist: ${path.relative(repoRoot, file)}`);
  }
}

function ensureContains(file, snippet) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(snippet)) {
    throw new Error(`${path.relative(repoRoot, file)} is missing required snippet: ${snippet}`);
  }
}

ensureExists(runtimeFile);
ensureExists(viewportHotkeysFile);

ensureContains(canvasFile, "import { useCanvasRuntime } from './canvas/useCanvasRuntime';");
ensureContains(canvasFile, "import { useCanvasViewportHotkeys } from './canvas/useCanvasViewportHotkeys';");
ensureContains(canvasFile, 'const {\n    batchDone,\n    batchTotal,\n    handleCancelRun,\n    handleRunAll,\n    handleRunGroup,\n    handleRunAllGroups,\n    isRunning,\n  } = useCanvasRuntime({');
ensureContains(canvasFile, 'const { focusNodeBySerialId, handleViewportHotkeys } = useCanvasViewportHotkeys({');
ensureContains(canvasFile, 'handleViewportHotkeys(e)');

ensureContains(runtimeFile, 'export function useCanvasRuntime(');
ensureContains(runtimeFile, 'const runNodesByOrder = useCallback(');
ensureContains(runtimeFile, 'const runManagedRounds = useCallback(async () => {');
ensureContains(runtimeFile, 'const handleRunAll = useCallback(async () => {');
ensureContains(runtimeFile, 'const handleRunGroup = useCallback(');
ensureContains(runtimeFile, 'const handleRunAllGroups = useCallback(async () => {');

ensureContains(viewportHotkeysFile, 'export function useCanvasViewportHotkeys(');
ensureContains(viewportHotkeysFile, 'const focusNearestNodeToViewport = useCallback(() => {');
ensureContains(viewportHotkeysFile, 'const focusNodeBySerialId = useCallback(() => {');
ensureContains(viewportHotkeysFile, 'const handleViewportHotkeys = useCallback((event: KeyboardEvent) => {');

console.log('verify-canvas-runtime-split-contract: ok');
