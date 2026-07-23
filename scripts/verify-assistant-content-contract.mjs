import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [shared, sharedTest, ui, uiTest, uiPackage, server, webApi, assistantApi, canvas, admin, webStyles, adminStyles] = await Promise.all([
  read("packages/shared/src/assistant-content.ts"),
  read("packages/shared/src/assistant-content.test.ts"),
  read("packages/ui/src/assistant-markdown.tsx"),
  read("packages/ui/src/assistant-markdown.test.tsx"),
  read("packages/ui/package.json"),
  read("apps/api/src/server.ts"),
  read("apps/web/src/services/api.ts"),
  read("apps/web/src/services/assistant-api.ts"),
  read("apps/web/src/components/canvas-assistant/AssistantConversation.tsx"),
  read("apps/admin/src/admin-assistant-panel.tsx"),
  read("apps/web/src/styles/index.css"),
  read("apps/admin/src/styles.css"),
]);

assert.match(shared, /ASSISTANT_CONTENT_FORMAT = "markdown-v1"/);
assert.match(shared, /createAssistantContentStreamFilter/);
assert.match(shared, /<think>/);
assert.match(shared, /internalLinePrefixes/);
assert.match(sharedTest, /filters reasoning tags split across chunks/);
assert.match(sharedTest, /unclosed reasoning block/);

assert.match(uiPackage, /"react-markdown"/);
assert.match(uiPackage, /"remark-gfm"/);
assert.match(ui, /skipHtml/);
assert.match(ui, /urlTransform=\{safeUrl\}/);
assert.match(ui, /rel=\{external \? "noopener noreferrer"/);
assert.match(ui, /img: \(\{ alt \}\) => <span role="note">/);
assert.match(uiTest, /javascript:alert/);
assert.match(uiTest, /replaces remote images/);

const assistantChatRuntime = server.slice(
  server.indexOf("async function runAssistantChat"),
  server.indexOf("function extractAssistantProcess"),
);
assert.match(assistantChatRuntime, /buildAssistantChatContentResult\("agent"/);
assert.doesNotMatch(assistantChatRuntime, /rawAssistant: `\$\{fallback\.rawAssistant\}/);
assert.match(webApi, /from '\.\/assistant-api'/);
assert.match(assistantApi, /createAssistantContentStreamFilter/);
assert.match(canvas, /AssistantMarkdown/);
assert.match(admin, /createAssistantContentStreamFilter/);
assert.match(admin, /AssistantMarkdown/);

assert.match(webStyles, /agent-assistant-message__body[^}]*font-size: 14px;[^}]*line-height: 22px;/);
assert.match(webStyles, /agent-assistant-message__identity[^}]*font-size: 12px;[^}]*line-height: 18px;/);
assert.match(adminStyles, /admin-assistant-message[^}]*font-size: 14px;[^}]*line-height: 22px;/);
assert.match(adminStyles, /admin-assistant-message__body table \{ width: 100%; min-width: 0; \}/);

console.log("assistant content contract: ok");
