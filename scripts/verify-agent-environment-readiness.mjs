import assert from "node:assert/strict";

import { firstArg, flagEnabled, parseArgs, printJson, requiredArg } from "./release/_shared.mjs";
import { assertTargetOverridesMatch, loadReleaseTargetProfile, sanitizedTargetFingerprint } from "./release/target-profile.mjs";

const EXPECTED_AGENT_KEYS = [
  "assistant-planner", "admin-assistant-planner", "supervision-planner", "provider-analysis-planner",
  "artifact-image-understanding", "artifact-video-understanding", "artifact-checker", "generation-recovery",
];
const EXPECTED_POOL_KEYS = ["assistant-diagnosis", "admin-assistant-diagnosis", "supervision-planning"];
const args = parseArgs(process.argv.slice(2));
const profile = requiredArg(args, "target-profile");
const environment = String(firstArg(args.env) || "gray").trim();
const dryRun = flagEnabled(args["dry-run"]);
const allowBilledCanaries = flagEnabled(args["allow-billed-canaries"]);
const target = await loadReleaseTargetProfile({ profile, environment });
assertTargetOverridesMatch(args, target);

if (dryRun) {
  printJson({ ok: true, stage: "verify-agent-environment-readiness", dryRun: true, target: sanitizedTargetFingerprint(target), liveCanaries: "skipped" });
  process.exit(0);
}

const cookie = process.env[requiredArg(args, "admin-cookie-env")];
if (!cookie) throw new Error("AGENT_READINESS_ADMIN_COOKIE_MISSING");
const baseUrl = target.publicStatusUrl.replace(/\/api\/status$/, "");
const request = async (pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { cookie, "content-type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`AGENT_READINESS_HTTP_${response.status}:${pathname}`);
  return response.json();
};

const [definitions, pools, controls] = await Promise.all([
  request("/api/admin/agent-runtime/roles"),
  request("/api/admin/agent-runtime/llm-pools"),
  request("/api/admin/agent-runtime/controls"),
]);
assert(Array.isArray(definitions), "AGENT_READINESS_DEFINITIONS_INVALID");
assert(Array.isArray(pools), "AGENT_READINESS_POOLS_INVALID");
assert(Array.isArray(controls), "AGENT_READINESS_CONTROLS_INVALID");
for (const key of EXPECTED_AGENT_KEYS) assert(definitions.some((item) => item?.agentKey === key), `AGENT_READINESS_DEFINITION_MISSING:${key}`);
for (const key of EXPECTED_POOL_KEYS) {
  const pool = pools.find((item) => item?.poolKey === key);
  assert(pool, `AGENT_READINESS_POOL_MISSING:${key}`);
  const published = pool.versions?.some((version) => version?.publications?.some((publication) => publication?.environment === environment) && version.entries?.some((entry) => entry?.enabled !== false && Array.isArray(entry.capabilityTags) && entry.capabilityTags.includes("text_chat")));
  assert(published, `AGENT_READINESS_TEXT_CHAT_PUBLICATION_MISSING:${key}`);
}
const publishedAgentCount = definitions.filter((item) => item?.publications?.some((publication) => publication?.environment === environment)).length;
assert(publishedAgentCount >= 3, "AGENT_READINESS_AGENT_PUBLICATIONS_MISSING");
const control = controls.find((item) => item?.environment === environment);
for (const key of ["agentEnabled", "canvasRunsEnabled", "automaticRecoveryEnabled", "qualityEvaluationEnabled"]) assert(typeof control?.[key] === "boolean", `AGENT_READINESS_CONTROL_MISSING:${key}`);

let canaries = "skipped";
if (allowBilledCanaries) {
  const payload = JSON.stringify({ message: "Release readiness probe: reply with a short confirmation.", idempotencyKey: `release-readiness-${environment}-${Date.now()}` });
  const [frontend, admin] = await Promise.all([
    request("/api/assistant/chat", { method: "POST", body: payload }),
    request("/api/admin/assistant/chat", { method: "POST", body: payload }),
  ]);
  assert(frontend?.mode === "agent", "AGENT_READINESS_FRONTEND_FALLBACK");
  assert(admin?.mode === "agent", "AGENT_READINESS_ADMIN_FALLBACK");
  canaries = "agent";
}

printJson({
  ok: true,
  stage: "verify-agent-environment-readiness",
  target: sanitizedTargetFingerprint(target),
  environment,
  definitions: EXPECTED_AGENT_KEYS.length,
  agentPublications: publishedAgentCount,
  routePublications: EXPECTED_POOL_KEYS.length,
  liveCanaries: canaries,
});
