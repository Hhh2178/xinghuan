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
assert.match(serverSource, /taskQueueNameForCapability/);
assert.match(serverSource, /normalizeTaskQueueSettings/);
assert.match(serviceSource, /taskPayload\.taskCapability/);
assert.match(serviceSource, /normalizeGenerationCapability/);
assert.match(serviceSource, /enqueueTask\(task\.id,\s*input\.capability\)/);
assert.match(serviceSource, /queueName/);
assert.match(serviceSource, /safePromptText\(body\.prompt,\s*""\s*,\s*8000\)/);
assert.match(serviceSource, /safePromptText\(body\.prompt,\s*""\s*,\s*16000\)/);
assert.match(serviceSource, /safeLongText\(body\.text \|\| body\.prompt,\s*""\s*,\s*16000\)/);
assert.match(serviceSource, /validateVideoInputs/);
assert.match(serviceSource, /videoInputMode:\s*validatedInputs\.mode/);
assert.match(serviceSource, /modeType:\s*validatedInputs\.modeType/);
assert.match(serviceSource, /requestContract:\s*deps\.plainObject\(advancedConfig\.requestContract\)/);
assert.match(serviceSource, /referenceImageTransport:\s*advancedConfig\.referenceImageTransport === "data_url"/);
assert.doesNotMatch(serviceSource, /prepareInlineImageReferences/);
assert.match(serverSource, /invalidRequest:\s*\(message\) => new HttpError\(400, message\)/);

console.log(JSON.stringify({ ok: true }, null, 2));
