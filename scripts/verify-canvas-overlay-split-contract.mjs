import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const canvasFile = path.join(repoRoot, 'apps/web/src/components/Canvas.tsx');
const overlayLayerFile = path.join(repoRoot, 'apps/web/src/components/canvas/CanvasOverlayLayer.tsx');

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

ensureExists(overlayLayerFile);

ensureContains(canvasFile, "import { CanvasOverlayLayer } from './canvas/CanvasOverlayLayer';");
ensureContains(canvasFile, '<CanvasOverlayLayer');
ensureContains(canvasFile, 'connectionPanModeActive={connectionPanModeActive}');
ensureContains(canvasFile, 'connectionPanShortcutLabel={connectionPanShortcutLabel}');
ensureContains(canvasFile, 'onCutEdges={(edgeIds) => {');

ensureContains(overlayLayerFile, 'export function CanvasOverlayLayer(');
ensureContains(overlayLayerFile, "document.body.classList.add('cut-mode');");
ensureContains(overlayLayerFile, "window.addEventListener('mousedown', onCutMouseDownCapture, true);");
ensureContains(overlayLayerFile, 'if (!connectionPanModeActive) return null;');

console.log('verify-canvas-overlay-split-contract: ok');
