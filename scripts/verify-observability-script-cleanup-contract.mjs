import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const systemScript = await readFile(new URL("../scripts/verify-system-observability.mjs", import.meta.url), "utf8");
const requestChainScript = await readFile(new URL("../scripts/verify-request-chain-observability.mjs", import.meta.url), "utf8");

assert.doesNotMatch(
  systemScript,
  /\/api\/admin\/providers/,
  "verify-system-observability must not create admin providers",
);
assert.match(
  requestChainScript,
  /\/api\/admin\/providers\/\$\{encodeURIComponent\(providerId\)\}/,
  "verify-request-chain-observability must delete the created provider",
);
assert.match(
  requestChainScript,
  /finally\s*\{/,
  "verify-request-chain-observability cleanup must run in finally",
);

console.log(JSON.stringify({ ok: true }, null, 2));
