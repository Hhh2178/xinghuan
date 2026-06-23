import { spawnSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./verify-current-release-entry-consistency.mjs", import.meta.url));

const pass = spawnSync(process.execPath, [scriptPath], { encoding: "utf8", shell: false, stdio: "pipe" });
assert.equal(pass.status, 0, `expected current release entry consistency script to pass:\n${pass.stdout}\n${pass.stderr}`);
assert.match(pass.stdout, /"ok": true/);

console.log("PASS current release entry consistency contract");
