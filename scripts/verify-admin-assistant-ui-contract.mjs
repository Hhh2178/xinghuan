import { readFile } from "node:fs/promises";

async function main() {
  const [mainSource, panelSource, workspaceSource, supervisionSource, assistantUiSource, styleSource] = await Promise.all([
    readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-assistant-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-assistant-governance-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-agent-governance-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/ui/src/assistant-chat-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8"),
  ]);

  const checks = [
    [
      "Admin app mounts the docked assistant and the separated assistant governance workspace",
      mainSource.includes("import { AdminAssistantPanel } from \"./admin-assistant-panel\";") &&
        mainSource.includes("<AdminAssistantPanel") &&
        mainSource.includes("AdminAssistantGovernanceWorkspace") &&
        !mainSource.includes("AdminAssistantSettingsPanel"),
    ],
    [
      "Admin assistant dock toggle remains available from the topbar",
      mainSource.includes("const [assistantOpen, setAssistantOpen]") &&
        mainSource.includes('title={assistantOpen ? "收起 AI 助手" : "展开 AI 助手"}'),
    ],
    [
      "Assistant governance separates frontend and backend configuration with matching editors",
      workspaceSource.includes("创作侧助手") &&
        workspaceSource.includes("后台 AI 助手") &&
        workspaceSource.includes("frontendAssistantAgentKey") &&
        workspaceSource.includes("backendAssistantAgentKey") &&
        workspaceSource.includes("AdminAgentRoleConfigurationEditor") &&
        workspaceSource.includes("AdminAgentPoolEditor") &&
        workspaceSource.includes('publicationMode="read-only"') &&
        workspaceSource.includes("保存当前助手设置"),
    ],
    [
      "Assistant governance remounts editors when switching assistant surfaces",
      workspaceSource.includes('key={definition.id}') &&
        workspaceSource.includes('key={pools.map((pool) => pool.poolKey).join(":")}'),
    ],
    [
      "Supervision governance copy owns planning, recovery and candidate evaluation",
      supervisionSource.includes("托管分析用途") &&
        supervisionSource.includes("质量与候选选择") &&
        supervisionSource.includes('definition.agentKey !== "generation-recovery"') &&
        supervisionSource.includes('navigation.active === "recovery"') &&
        !supervisionSource.includes("只管理助手诊断、失败恢复和候选评估"),
    ],
    [
      "Admin assistant uses right-side chat composer",
      panelSource.includes("<AssistantComposer") &&
        panelSource.includes('classPrefix="admin-assistant"') &&
        assistantUiSource.includes("<textarea") &&
        panelSource.includes("可直接提问，或展开上方添加当前页上下文。"),
    ],
    [
      "Admin assistant supports page context attachments",
      panelSource.includes('kind: "provider"') &&
        panelSource.includes('kind: "model"') &&
        panelSource.includes('kind: "task"') &&
        panelSource.includes('kind: "user"') &&
        panelSource.includes('kind: "audit"'),
    ],
    [
      "Admin assistant posts to admin chat API",
      panelSource.includes('fetch("/api/admin/assistant/chat/stream"') &&
        panelSource.includes('scope: "admin"') &&
        panelSource.includes("conversationId: conversationId"),
    ],
    [
      "Admin assistant creates a stable conversation id and only resets it on new session",
      panelSource.includes('useState(() => createAssistantConversationId("admin"))') &&
        panelSource.includes('setConversationId(createAssistantConversationId("admin"))'),
    ],
    [
      "Admin assistant compacts attachments before sending",
      panelSource.includes("function compactAssistantAttachment") &&
        panelSource.includes("const outgoingAttachments = attachments.map(compactAssistantAttachment)") &&
        !panelSource.includes("payload: provider as unknown as Record<string, unknown>") &&
        !panelSource.includes("payload: model as unknown as Record<string, unknown>") &&
        !panelSource.includes("payload: task as unknown as Record<string, unknown>"),
    ],
    [
      "Admin assistant UI hides implementation labels and process output",
      panelSource.includes('mode?: "agent" | "fallback"') &&
        !panelSource.includes(">Fallback<") &&
        workspaceSource.includes("项目内 Agent Runtime") &&
        !workspaceSource.includes(">Fallback<") &&
        !panelSource.includes("<summary>过程</summary>") &&
        !panelSource.includes("assistant-process-block"),
    ],
    [
      "Admin assistant renders the shared safe Markdown surface instead of a paragraph blob",
      panelSource.includes("AssistantConversationList") &&
        assistantUiSource.includes("AssistantMarkdown") &&
        panelSource.includes("createAssistantContentStreamFilter") &&
        !panelSource.includes("<p>{message.text}</p>"),
    ],
    [
      "Admin assistant renders semantic SSE phases from the shared status map",
      panelSource.includes('eventName === "status"') &&
        panelSource.includes("setStatus(assistantPhaseLabel(data.status))") &&
        assistantUiSource.includes('starting: "正在读取上下文"') &&
        assistantUiSource.includes('"building-context": "正在分析"') &&
        assistantUiSource.includes('generating: "正在生成答复"'),
    ],
    [
      "Admin assistant preserves IME composition and blocks accidental Enter submission",
      assistantUiSource.includes("useImeSafeTextControl") &&
        assistantUiSource.includes("isImeSubmissionEvent(event.nativeEvent, textControl.isComposing)") &&
        assistantUiSource.includes("onCompositionStart={textControl.onCompositionStart}") &&
        assistantUiSource.includes("onCompositionEnd={textControl.onCompositionEnd}"),
    ],
    [
      "Admin assistant Markdown preserves readable body sizing and overflow",
      styleSource.includes(".admin-assistant-message__body {") &&
        styleSource.includes("font-size: 14px") &&
        styleSource.includes("overflow: auto"),
    ],
    [
      "Admin assistant supports clipboard image paste in the composer",
      panelSource.includes("onUpload={handleUploadImage}") &&
        assistantUiSource.includes("event.clipboardData.files") &&
        assistantUiSource.includes("onPaste={pasteImage}"),
    ],
    [
      "Admin assistant settings copy avoids debug and acceptance wording",
      ["测试", "验收", "前端助手", "Fallback", "过程"].every(
        (banned) => !panelSource.includes(`>${banned}<`) && !workspaceSource.includes(`>${banned}<`),
      ),
    ],
    [
      "Admin assistant styles are fixed right dock with responsive overlay fallback",
      styleSource.includes(".admin-assistant-dock {") &&
        styleSource.includes("height: 100vh;") &&
        styleSource.includes(".admin-workspace--with-assistant {") &&
        styleSource.includes("@media (max-width: 1360px)") &&
        styleSource.includes("position: fixed;"),
    ],
    [
      "Admin assistant layouts shrink, wrap long text and preserve viewport bottom gap",
      styleSource.includes("minmax(0, 1fr)") &&
        styleSource.includes("overflow-wrap: anywhere") &&
        styleSource.includes("text-overflow: ellipsis") &&
        styleSource.includes(".assistant-message-code pre"),
    ],
    [
      "Collapsed admin assistant dock does not block main workspace clicks",
        panelSource.includes('admin-assistant-dock--open') &&
        styleSource.includes(".admin-assistant-dock:not(.admin-assistant-dock--open)") &&
        styleSource.includes("pointer-events: none;"),
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
