import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [verifier, routes, repository, server, packageJson] = await Promise.all([
  read("scripts/verify-agent-environment-readiness.mjs"),
  read("apps/api/src/admin-agent-governance-routes.ts"),
  read("apps/api/src/agent-governance-repository.ts"),
  read("apps/api/src/server.ts"),
  read("package.json"),
]);
for (const key of ["assistant-planner", "admin-assistant-planner", "supervision-planner", "provider-analysis-planner", "artifact-image-understanding", "artifact-video-understanding", "artifact-checker", "generation-recovery"]) assert.match(verifier, new RegExp(key), `missing bootstrap definition check: ${key}`);
for (const key of ["assistant-diagnosis", "admin-assistant-diagnosis", "supervision-planning"]) assert.match(verifier, new RegExp(key), `missing route publication check: ${key}`);
assert.match(verifier, /text_chat/, "readiness must require text_chat candidates");
assert.match(verifier, /allow-billed-canaries/, "billed canaries must require explicit approval");
assert.match(verifier, /frontend\?\.mode === "agent"/, "frontend canary must reject fallback");
assert.match(verifier, /admin\?\.mode === "agent"/, "admin canary must reject fallback");
assert.match(verifier, /admin-cookie-env/, "credentials must be read from an environment variable");
assert.match(verifier, /readiness.*skip/, "readiness skip mode missing");
assert.match(verifier, /liveReadiness/, "readiness result must be explicit");
assert.doesNotMatch(verifier, /bootstrap\"\s*,\s*\{ method: "POST"/, "readiness verifier must not bootstrap");
assert.match(routes, /agent-runtime\/roles" && request\.method === "GET"/, "read-only definitions endpoint missing");
assert.match(routes, /agent-runtime\/controls" && request\.method === "GET"/, "read-only controls endpoint missing");
assert.match(repository, /DEFAULT_AGENT_DEFINITIONS/, "bootstrap definitions must remain code-owned");
assert.match(server, /url\.pathname === "\/api\/assistant\/chat"/, "frontend assistant endpoint missing");
assert.match(server, /url\.pathname === "\/api\/admin\/assistant\/chat"/, "admin assistant endpoint missing");
assert.match(packageJson, /verify:agent-environment-readiness-contract/, "package command missing");
console.log(JSON.stringify({ ok: true, contract: "agent-environment-readiness" }, null, 2));
