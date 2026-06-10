import { readFile } from "node:fs/promises";

async function main() {
  const [mainSource, panelSource, settingsSource, styleSource] = await Promise.all([
    readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-assistant-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-assistant-settings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8"),
  ]);

  const checks = [
    [
      "Admin app still mounts docked assistant panel and dedicated assistant settings page",
      mainSource.includes("import { AdminAssistantPanel } from \"./admin-assistant-panel\";") &&
        mainSource.includes("<AdminAssistantPanel") &&
        mainSource.includes('activeTab === "assistant"'),
    ],
    [
      "Admin assistant nav item opens a real page and dock toggle is not duplicated in the topbar",
      mainSource.includes("const [assistantOpen, setAssistantOpen]") &&
        !mainSource.includes('title={assistantOpen ? "收起 AI 助手" : "展开 AI 助手"}') &&
        panelSource.includes('title={open ? "收起 AI 助手" : "展开 AI 助手"}') &&
        !mainSource.includes('item.id === "assistant"'),
    ],
    [
      "Admin assistant settings page exposes frontend, backend, integration and explicit save actions",
      settingsSource.includes("创作侧助手") &&
        settingsSource.includes("后台审计助手") &&
        settingsSource.includes("外部服务接入") &&
        settingsSource.includes("保存 AI 助手配置") &&
        settingsSource.includes("重置未保存修改"),
    ],
    [
      "Admin assistant uses right-side chat composer",
      panelSource.includes("admin-assistant-dock__composer") &&
        panelSource.includes("<textarea") &&
        panelSource.includes("先从上面选几条上下文卡片"),
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
      !panelSource.includes(">Hermes<") &&
        !panelSource.includes(">Fallback<") &&
        !settingsSource.includes(">Hermes<") &&
        !settingsSource.includes(">Fallback<") &&
        !panelSource.includes("<summary>过程</summary>") &&
        !panelSource.includes("assistant-process-block"),
    ],
    [
      "Admin assistant settings copy avoids debug and acceptance wording",
      ["测试", "验收", "前端助手", "Hermes", "Fallback", "过程"].every(
        (banned) => !panelSource.includes(`>${banned}<`) && !settingsSource.includes(`>${banned}<`),
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
        styleSource.includes("max-height: calc(100dvh") &&
        (
          styleSource.includes("grid-template-columns: minmax(120px, 180px) minmax(0, 1fr)") ||
          styleSource.includes("grid-template-columns: minmax(220px, 300px) minmax(0, 1fr)")
        ) &&
        styleSource.includes("text-overflow: ellipsis"),
    ],
    [
      "Collapsed admin assistant dock does not block main workspace clicks",
      panelSource.includes('admin-assistant-dock--open') &&
        styleSource.includes(".admin-assistant-dock:not(.admin-assistant-dock--open)") &&
        styleSource.includes("pointer-events: none;") &&
        styleSource.includes(".admin-assistant-dock:not(.admin-assistant-dock--open) .admin-assistant-dock__toggle") &&
        styleSource.includes("pointer-events: auto;"),
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
