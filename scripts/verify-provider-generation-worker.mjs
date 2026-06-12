import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workerPath = join(root, "apps", "worker", "src", "worker.ts");
const outputMaterialsPath = join(root, "apps", "worker", "src", "output-materials.ts");
const workerSource = readFileSync(workerPath, "utf8");
const outputMaterialsSource = readFileSync(outputMaterialsPath, "utf8");

assert.match(workerSource, /if \(task\.capability === "audio"\) return executeAudioTask\(task\)/);
assert.match(workerSource, /async function executeAudioTask/);
assert.match(workerSource, /createOpenAiAudioChatPayload/);
assert.match(workerSource, /extractAudioProviderResult/);
assert.match(workerSource, /return \["chat", "image", "video", "audio"\]\.includes\(capability\)/);

assert.match(outputMaterialsSource, /const audioUrls = readStringList\(result\.audioUrls\)/);
assert.match(outputMaterialsSource, /materializedAudioUrls/);
assert.match(outputMaterialsSource, /async function materializeAudioOutput/);

console.log(JSON.stringify({ ok: true }, null, 2));
