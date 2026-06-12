import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverPath = join(root, "apps", "api", "src", "server.ts");
const servicePath = join(root, "apps", "api", "src", "provider-generation-task-service.ts");
const serverSource = readFileSync(serverPath, "utf8");
const serviceSource = readFileSync(servicePath, "utf8");

assert.equal(existsSync(servicePath), true, "provider-generation-task-service.ts should exist");
assert.match(serverSource, /\/api\/proxy\/external\/image\/task/);
assert.match(serverSource, /\/api\/proxy\/external\/audio\/task/);
assert.match(serverSource, /createProviderGenerationTaskService/);
assert.match(serverSource, /submitProviderGenerationTask/);
assert.match(serverSource, /readProviderGenerationTaskStatus/);
assert.match(serverSource, /capability: "audio"/);
assert.match(serviceSource, /taskPayload\.taskCapability/);
assert.match(serviceSource, /normalizeGenerationCapability/);

console.log(JSON.stringify({ ok: true }, null, 2));
