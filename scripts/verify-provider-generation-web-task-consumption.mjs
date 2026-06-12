import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const generationPath = join(root, "apps", "web", "src", "services", "generation.ts");
const imageNodePath = join(root, "apps", "web", "src", "components", "nodes", "ImageNode.tsx");
const audioNodePath = join(root, "apps", "web", "src", "components", "nodes", "AudioNode.tsx");

const generationSource = readFileSync(generationPath, "utf8");
const imageNodeSource = readFileSync(imageNodePath, "utf8");
const audioNodeSource = readFileSync(audioNodePath, "utf8");

assert.match(generationSource, /submitExternalImageTask/);
assert.match(generationSource, /queryExternalImageTask/);
assert.match(generationSource, /submitExternalAudioTask/);
assert.match(generationSource, /queryExternalAudioTask/);

assert.match(imageNodeSource, /submitExternalImageTask/);
assert.match(imageNodeSource, /queryExternalImageTask/);
assert.doesNotMatch(imageNodeSource, /generateExternalImage\(/);

assert.match(audioNodeSource, /submitExternalAudioTask/);
assert.match(audioNodeSource, /queryExternalAudioTask/);
assert.doesNotMatch(audioNodeSource, /generateExternalAudio\(/);

console.log(JSON.stringify({ ok: true }, null, 2));
