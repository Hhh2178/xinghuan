import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const canvasFile = path.join(repoRoot, 'apps/web/src/components/Canvas.tsx');
const persistenceFile = path.join(repoRoot, 'apps/web/src/components/canvas/useCanvasPersistence.ts');
const panModeFile = path.join(repoRoot, 'apps/web/src/components/canvas/useCanvasConnectionPanMode.ts');
const overlaysFile = path.join(repoRoot, 'apps/web/src/components/canvas/CanvasFlowOverlays.tsx');

function ensureContains(file, snippet) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(snippet)) {
    throw new Error(`${path.relative(repoRoot, file)} is missing required snippet: ${snippet}`);
  }
}

function ensureExists(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Expected file to exist: ${path.relative(repoRoot, file)}`);
  }
}

ensureExists(persistenceFile);
ensureExists(panModeFile);
ensureExists(overlaysFile);

ensureContains(canvasFile, "import { useCanvasPersistence } from './canvas/useCanvasPersistence';");
ensureContains(canvasFile, "import { useCanvasConnectionPanMode } from './canvas/useCanvasConnectionPanMode';");
ensureContains(canvasFile, "import { CanvasFlowOverlays } from './canvas/CanvasFlowOverlays';");
ensureContains(canvasFile, 'const { pendingSendFocusRef } = useCanvasPersistence({');
ensureContains(canvasFile, 'const { connectionPanShortcutLabel } = useCanvasConnectionPanMode({');
ensureContains(canvasFile, '<CanvasFlowOverlays');

ensureContains(persistenceFile, '.getCanvasData(requestedCanvasId)');
ensureContains(persistenceFile, 'saveCanvasData(canvasIdForSave, payload, { allowEmpty: allowEmptySave })');
ensureContains(panModeFile, "matchesAnyShortcut(shortcuts['connection.pan-mode'], event)");
ensureContains(overlaysFile, '<Controls');
ensureContains(overlaysFile, '<MiniMap');

console.log('verify-canvas-section-split-contract: ok');
