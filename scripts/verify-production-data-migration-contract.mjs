import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./release/migrate-production-data.mjs", import.meta.url), "utf8");

assert.match(source, /shared-resource-assets\.js[\s\S]*--apply=true[\s\S]*--expect-ready=true/, "source migration must materialize public assets before archiving data");
assert.match(source, /--exclude='data\/users\/\*\/output'/, "migration must exclude generated output binaries");
assert.match(source, /--exclude='data\/users\/\*\/output-archives'/, "migration must exclude generated output archives");
assert.doesNotMatch(source, /--exclude='data\/admin\/shared-assets'/, "migration must retain shared public assets");
assert.match(source, /shared-resource-assets\.js[\s\S]*--data-dir=\$\{targetRoot\}\/shared\/data[\s\S]*--expect-ready=true/, "target restore must verify public assets before services start");
assert.match(source, /target-before-data\.tgz/, "target data must be backed up before replacement");

console.log(JSON.stringify({ ok: true, checks: 6 }, null, 2));
