import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const canvasFile = path.join(repoRoot, 'apps/web/src/components/Canvas.tsx');
const sendFlowFile = path.join(repoRoot, 'apps/web/src/components/canvas/useCanvasSendFlow.ts');

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

function ensureNotContains(file, snippet) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(snippet)) {
    throw new Error(`${path.relative(repoRoot, file)} should not keep snippet after split: ${snippet}`);
  }
}

ensureExists(sendFlowFile);

ensureContains(canvasFile, "import { useCanvasSendFlow } from './canvas/useCanvasSendFlow';");
ensureContains(canvasFile, 'const {\n    handleSaveSendMaterialsToResource,\n    handleSendMaterialsToCanvas,\n    handleSendMaterialsToEagle,\n    insertWorkflowFragment,\n    openSendMaterials,\n    saveWorkflowFragmentToResource,\n    sendModal,\n    setSendModal,\n  } = useCanvasSendFlow({');
ensureContains(canvasFile, 'onInsertWorkflowRef.current = insertWorkflowFragment;');
ensureContains(canvasFile, 'open={!!sendModal}');
ensureContains(canvasFile, 'onClose={() => setSendModal(null)}');
ensureContains(canvasFile, 'onSendToCanvas={handleSendMaterialsToCanvas}');
ensureContains(canvasFile, 'onSaveToResource={handleSaveSendMaterialsToResource}');
ensureContains(canvasFile, 'onSendToEagle={handleSendMaterialsToEagle}');

ensureNotContains(canvasFile, "window.addEventListener('penguin:open-send-materials'");
ensureNotContains(canvasFile, 'const [sendModal, setSendModal] = useState<');
ensureNotContains(canvasFile, 'const openSendMaterials = useCallback(');
ensureNotContains(canvasFile, 'const resolveSendMode = useCallback(');
ensureNotContains(canvasFile, 'const basePositionForActiveSend = useCallback(');
ensureNotContains(canvasFile, 'const insertWorkflowFragment = useCallback(');
ensureNotContains(canvasFile, 'const handleSendMaterialsToCanvas = useCallback(');
ensureNotContains(canvasFile, 'const saveWorkflowFragmentToResource = useCallback(');
ensureNotContains(canvasFile, 'const handleSaveSendMaterialsToResource = useCallback(');
ensureNotContains(canvasFile, 'const handleSendMaterialsToEagle = useCallback(');

ensureContains(sendFlowFile, 'export function useCanvasSendFlow(');
ensureContains(sendFlowFile, "window.addEventListener('penguin:open-send-materials', onOpenSendMaterials);");
ensureContains(sendFlowFile, 'const [sendModal, setSendModal] = useState<');
ensureContains(sendFlowFile, 'const openSendMaterials = useCallback(');
ensureContains(sendFlowFile, 'const resolveSendMode = useCallback(');
ensureContains(sendFlowFile, 'const basePositionForActiveSend = useCallback(() => {');
ensureContains(sendFlowFile, 'const insertWorkflowFragment = useCallback(');
ensureContains(sendFlowFile, 'const handleSendMaterialsToCanvas = useCallback(');
ensureContains(sendFlowFile, 'const saveWorkflowFragmentToResource = useCallback(');
ensureContains(sendFlowFile, 'const handleSaveSendMaterialsToResource = useCallback(');
ensureContains(sendFlowFile, 'const handleSendMaterialsToEagle = useCallback(async () => {');
ensureContains(sendFlowFile, 'return {');
ensureContains(sendFlowFile, 'sendModal,');
ensureContains(sendFlowFile, 'setSendModal,');
ensureContains(sendFlowFile, 'openSendMaterials,');
ensureContains(sendFlowFile, 'insertWorkflowFragment,');
ensureContains(sendFlowFile, 'handleSendMaterialsToCanvas,');
ensureContains(sendFlowFile, 'handleSaveSendMaterialsToResource,');
ensureContains(sendFlowFile, 'handleSendMaterialsToEagle,');
ensureContains(sendFlowFile, 'saveWorkflowFragmentToResource,');

console.log('verify-canvas-send-flow-split-contract: ok');
