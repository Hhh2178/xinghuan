import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const server = read("apps/api/src/server.ts");
const orchestrator = read("apps/api/src/agent-orchestrator.ts");
const routing = read("apps/api/src/llm-routing-repository.ts");
const panel = read("apps/admin/src/admin-assistant-panel.tsx");
const types = read("apps/admin/src/admin-types.ts");
const answerPolicy = read("apps/api/src/assistant-answer-policy.ts");
const assistantUi = read("packages/ui/src/assistant-chat-ui.tsx");

assert.match(server, /url\.pathname === "\/api\/admin\/assistant\/chat\/stream"/);
assert.match(server, /buildInternalAssistantChatPrompt/);
assert.match(server, /createAgentOrchestrator/);
assert.match(server, /mode: "agent"/);
assert.match(server, /assistantAgentIdempotencyKey/);
assert.match(server, /summarizeAssistantAttachment/);
assert.doesNotMatch(server, /XINGHUAN_.+WEBUI|\/api\/session\/new|assistant.+SessionCache/i);

assert.match(orchestrator, /validateAgentRoleTask/);
assert.match(orchestrator, /recordDecision/);
assert.match(orchestrator, /recordOutcome/);
assert.match(orchestrator, /ownerId !== actor\.id|ownerId: task\.ownerId/);
assert.match(routing, /m\.capability = 'chat'/);
assert.match(routing, /xh_llm_route_pool_publications/);
assert.match(routing, /pub\.environment = \$3/);

assert.match(types, /mode: "agent" \| "fallback"/);
assert.match(types, /idempotencyKey\?: string/);
assert.match(panel, /idempotencyKey: crypto\.randomUUID\(\)/);
assert.match(panel, /kind: "image"/);
assert.match(panel, /setStatus\(assistantPhaseLabel\(data\.status\)\)/);
assert.match(answerPolicy, /resolveAssistantDetailLevel/);
assert.match(assistantUi, /正在读取上下文/);
assert.match(assistantUi, /正在生成答复/);

console.log("admin internal assistant chat contract: ok");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}
