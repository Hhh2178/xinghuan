import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [design, plan, adr, context, agentRuntime, providerLayering, journal] = await Promise.all([
  read("docs/superpowers/specs/2026-07-24-ai-governance-provider-operability-and-supervision-v2-design.md"),
  read("docs/superpowers/plans/2026-07-24-ai-governance-provider-operability-and-supervision-v2.md"),
  read("docs/adr/0005-agent-analyzed-deterministic-supervision.md"),
  read("CONTEXT.md"),
  read("docs/systems/agent-runtime/README.md"),
  read("docs/systems/providers/protocol-layering.md"),
  read("docs/logbooks/daily/2026-07-24-ai-governance-provider-operability-supervision-v2.md"),
]);

for (const requirement of [
  "Human-readable identity",
  "Assistant configuration authority",
  "Supervision planning authority",
  "RunningHub Standard Model Protocol",
  "Error Contract And Assistant Context",
  "Real AI verification is mandatory",
]) {
  assert.match(design, new RegExp(requirement), `design must own ${requirement}`);
}

for (const task of [
  "Human-readable Task Identity",
  "Channel Health Provider/Model Visual Hierarchy",
  "Separate AI Assistant And Supervision Governance",
  "RunningHub Standard Image And Video Provider Adapter",
  "Normalized Supervision Errors And Assistant Diagnostic Context",
  "AI Agent Analysis And Validated Concurrent Supervision",
  "End-to-end Governance And Real AI Acceptance",
  "Full Harness, Completion Audit And Gray Approval Gate",
]) {
  assert.match(plan, new RegExp(task), `implementation plan must contain task: ${task}`);
}

assert.match(adr, /Status:\*\* Accepted/, "ADR 0005 must be accepted before implementation");
assert.match(adr, /Agent 输出必须经过结构、节点身份、依赖、预算和策略校验/, "ADR must preserve deterministic validation authority");
assert.match(context, /Canvas Run Agent Analysis/, "domain context must define Canvas Run Agent Analysis");
assert.match(context, /Execution Identity Snapshot/, "domain context must define Execution Identity Snapshot");
assert.match(context, /Canvas Run Failure Diagnostic/, "domain context must define the shared failure diagnostic");
assert.match(agentRuntime, /Agent Analysis And Shared Failure Diagnostics/, "Agent Runtime system doc must own the new runtime projection");
assert.match(providerLayering, /RunningHub 双执行模式/, "Provider protocol docs must separate RH standard and catalog execution");
assert.match(journal, /Gray release remains paused/, "journal must preserve the Gray release pause");
assert.match(journal, /GitHub push forbidden; Production untouched/, "journal must preserve push and Production boundaries");

for (const viewport of ["1920x1080", "2560x1440"]) {
  assert.match(plan, new RegExp(viewport), `plan must require ${viewport} acceptance`);
}

console.log("PASS AI governance, Provider operability and supervision V2 plan contract");
