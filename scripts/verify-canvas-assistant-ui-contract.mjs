import { readFile } from "node:fs/promises";

async function main() {
  const [canvasSource, assistantSource, styleSource] = await Promise.all([
    readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/CanvasAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/styles/index.css", import.meta.url), "utf8"),
  ]);

  const checks = [
    [
      "Canvas mounts floating assistant component",
      canvasSource.includes("<CanvasAssistant nodes={nodes} edges={edges} activeCanvasId={activeId} />"),
    ],
    [
      "Selection menu can send workflow context to assistant",
      canvasSource.includes("kind: 'workflow'") &&
        canvasSource.includes("发送到 AI 助手") &&
        canvasSource.includes("penguin:append-assistant-context"),
    ],
    [
      "Selection menu forwards media context to assistant",
      canvasSource.includes("kind: item.kind") &&
        canvasSource.includes("sourceNodeId: item.sourceNodeId") &&
        canvasSource.includes("sourceCanvasId: item.sourceCanvasId"),
    ],
    [
      "Canvas assistant exposes draggable floating entry",
      assistantSource.includes("canvas-assistant-fab__drag") &&
        assistantSource.includes("setDragging(true)") &&
        assistantSource.includes('title="拖动助手入口"'),
    ],
    [
      "Canvas assistant no longer persists open state or position to localStorage",
      !assistantSource.includes("window.localStorage") &&
        !assistantSource.includes("STORAGE_KEY") &&
        !assistantSource.includes("readStoredAssistantState"),
    ],
    [
      "Canvas assistant uses text dialog composer",
      assistantSource.includes("canvas-assistant-panel__composer") &&
        assistantSource.includes("<textarea") &&
        assistantSource.includes("输入问题或要求"),
    ],
    [
      "Canvas assistant supports direct image upload in composer",
      assistantSource.includes("uploadDataUrl") &&
        assistantSource.includes("canvas-assistant-panel__file-input") &&
        assistantSource.includes("附加图片") &&
        assistantSource.includes("sourceUrl: uploadedUrl"),
    ],
    [
      "Canvas assistant copy avoids test-only placeholder wording",
      !assistantSource.includes("补一句你想让助手分析的问题，例如：这段工作流为什么出图不稳定？") &&
        !assistantSource.includes("本地验收前端助手") &&
        !assistantSource.includes("前端验收提示") &&
        !assistantSource.includes("会话 {sessionKey}") &&
        !assistantSource.includes("先选中节点、工作流或带媒体输出的节点，再把上下文挂到这里。") &&
        !assistantSource.includes("? <span>{message.mode === 'hermes' ? 'Hermes' : 'Fallback'}</span> : null"),
    ],
    [
      "Canvas assistant creates stable conversation id and sends it with stream payload",
      assistantSource.includes("function createAssistantConversationId") &&
        assistantSource.includes("useState(() => createAssistantConversationId('canvas'))") &&
        assistantSource.includes("conversationId: conversationId") &&
        assistantSource.includes("setConversationId(createAssistantConversationId('canvas'))"),
    ],
    [
      "Canvas assistant compacts attachments before sending",
      assistantSource.includes("function compactAssistantAttachment") &&
        assistantSource.includes("const outgoingAttachments = attachments.map(compactAssistantAttachment)") &&
        !assistantSource.includes("data: node.data") &&
        !assistantSource.includes("position: node.position"),
    ],
    [
      "Canvas assistant hides raw process and implementation labels",
      !assistantSource.includes("<summary>过程</summary>") &&
        !assistantSource.includes("assistant-process-block") &&
        !assistantSource.includes(">Hermes<") &&
        !assistantSource.includes(">Fallback<"),
    ],
    [
      "Canvas assistant supports workflow, node, image, video, audio attachments",
      assistantSource.includes("kind: 'workflow'") &&
        assistantSource.includes("kind: 'node'") &&
        assistantSource.includes("kind: 'image'") &&
        assistantSource.includes("kind: 'video'") &&
        assistantSource.includes("kind: 'audio'"),
    ],
    [
      "Canvas assistant filters empty media placeholders before creating attachments",
      assistantSource.includes("if (!item.url) return"),
    ],
    [
      "Canvas assistant supports resizable panel shell and overflow-safe content",
      assistantSource.includes("canvas-assistant-panel__resize") &&
        styleSource.includes("resize: both;") &&
        styleSource.includes("overflow-wrap: anywhere;"),
    ],
    [
      "Canvas assistant avoids fixed viewport height clamps and uses adaptive context layout",
      !assistantSource.includes("window.innerHeight - 624") &&
        assistantSource.includes("canvas-assistant-panel__context") &&
        styleSource.includes("flex-direction: column;") &&
        styleSource.includes("repeat(auto-fit, minmax(132px, 1fr))") &&
        styleSource.includes("max-height: min(32vh, 280px);") &&
        !styleSource.includes("max-height: min(820px, calc(100dvh - var(--canvas-assistant-panel-top, 96px) - 12px));") &&
        styleSource.includes("max-height: calc(100dvh - var(--canvas-assistant-panel-top, 96px) - var(--t8-floating-control-bottom, 12px));"),
    ],
    [
      "Canvas assistant attachment cards use compact metadata wrappers",
      assistantSource.includes("canvas-assistant-attachment__meta") &&
        assistantSource.includes("canvas-assistant-attachment__badge") &&
        styleSource.includes(".canvas-assistant-attachment__meta {") &&
        styleSource.includes("text-overflow: ellipsis;") &&
        styleSource.includes("white-space: nowrap;"),
    ],
    [
      "Canvas assistant controls and cards can shrink without expanding the panel",
      styleSource.includes(".canvas-assistant-panel__context-actions button") &&
        styleSource.includes("min-width: 0;") &&
        styleSource.includes(".canvas-assistant-attachment {") &&
        styleSource.includes("grid-template-columns: minmax(0, 1fr) auto;"),
    ],
    [
      "Canvas assistant styles are fixed-position floating UI",
      styleSource.includes(".canvas-assistant-fab {") &&
        styleSource.includes("position: fixed;") &&
        styleSource.includes(".canvas-assistant-panel {"),
    ],
    [
      "Canvas assistant upload controls have dedicated responsive styles",
      styleSource.includes(".canvas-assistant-panel__composer-actions {") &&
        styleSource.includes(".canvas-assistant-panel__file-input {") &&
        styleSource.includes(".canvas-assistant-panel__attach {"),
    ],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
