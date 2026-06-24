import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const canvasFile = path.join(repoRoot, 'apps/web/src/components/Canvas.tsx');
const selectionMenusFile = path.join(
  repoRoot,
  'apps/web/src/components/canvas/useCanvasSelectionMenus.ts',
);
const bulkReconnectFile = path.join(
  repoRoot,
  'apps/web/src/components/canvas/useCanvasBulkReconnect.ts',
);

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

ensureExists(selectionMenusFile);
ensureExists(bulkReconnectFile);

ensureContains(canvasFile, "import { useCanvasSelectionMenus } from './canvas/useCanvasSelectionMenus';");
ensureContains(canvasFile, "import { useCanvasBulkReconnect } from './canvas/useCanvasBulkReconnect';");
ensureContains(canvasFile, 'const {\n    closeContextMenu,\n    closePaneMenu,\n    contextMenu,\n    onCanvasContextMenuCapture,\n    onNodeContextMenu,\n    onPaneContextMenu,\n    onSelectionChange,\n    onSelectionContextMenu,\n    onSelectionEnd,\n    paneMenu,\n  } = useCanvasSelectionMenus({');
ensureContains(canvasFile, 'const {\n    handleBulkReconnectConnectEnd,\n    handleBulkReconnectConnectStart,\n    hasPendingBulkReconnect,\n  } = useCanvasBulkReconnect({');
ensureContains(canvasFile, 'handleBulkReconnectConnectStart(evt, params);');
ensureContains(canvasFile, 'if (connectionPanModeRef.current && from && !droppedOnHandle && !hasPendingBulkReconnect()) {');
ensureContains(canvasFile, 'if (handleBulkReconnectConnectEnd(event)) return;');

ensureContains(selectionMenusFile, 'export function useCanvasSelectionMenus(');
ensureContains(selectionMenusFile, 'const lastSelectedIdsRef = useRef<string[]>([]);');
ensureContains(selectionMenusFile, "setContextMenu({ x: clientX, y: clientY, ids });");
ensureContains(selectionMenusFile, 'lastSelectedIdsRef.current = nodes.map((node) => node.id);');

ensureContains(bulkReconnectFile, 'export function useCanvasBulkReconnect(');
ensureContains(bulkReconnectFile, "document.body.classList.add('bulk-reconnecting');");
ensureContains(bulkReconnectFile, "window.addEventListener('mousedown', onMouseDownCapture, true);");
ensureContains(bulkReconnectFile, 'const stashed: Edge[] = JSON.parse(JSON.stringify(relatedEdges));');

console.log('verify-canvas-interaction-seam-contract: ok');
