import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const server = read("apps/api/src/server.ts");
const webApi = read("apps/web/src/services/api.ts");
const assistant = read("apps/web/src/components/canvas-assistant/useAssistantSession.ts");
const shared = read("packages/shared/src/assistant-chat.ts");

assert.match(server, /url\.pathname === "\/api\/assistant\/chat\/stream"/);
assert.match(server, /scenario: "assistant-chat"/);
assert.match(server, /agentKey: settings\.integration\.assistantAgentKey/);
assert.match(server, /providerParams: \{ modelRecordId: invocation\.modelRecordId \}/);
assert.match(server, /AGENT_TOOL_OWNER_MISMATCH/);
assert.match(server, /rawAssistant: `\$\{fallback\.rawAssistant\}/);
assert.doesNotMatch(server, /WEBUI_PASSWORD|\/api\/chat\/start|stream_id/);

assert.match(webApi, /mode: 'agent' \| 'fallback'/);
assert.match(webApi, /idempotencyKey\?: string/);
assert.match(assistant, /idempotencyKey: crypto\.randomUUID\(\)/);
assert.match(webApi, /payload\?: Record<string, unknown>/);
assert.match(shared, /mode: "agent" \| "fallback"/);

console.log("canvas internal assistant chat contract: ok");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}
