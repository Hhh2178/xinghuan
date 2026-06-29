import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const groupBus = readFileSync(join(root, "apps/web/src/stores/groupBus.ts"), "utf8");
const canvas = readFileSync(join(root, "apps/web/src/components/Canvas.tsx"), "utf8");

assert.match(groupBus, /DEFAULT_GROUP_NAME\s*=\s*['"]未命名组['"]/);
assert.match(canvas, /DEFAULT_GROUP_NAME/);

console.log("PASS group default name contract");
