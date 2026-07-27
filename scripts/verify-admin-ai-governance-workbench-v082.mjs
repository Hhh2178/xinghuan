import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [assistant, governance, activity, styles, lifecycle, supervisionMode, activityViewModel] = await Promise.all([
  "apps/admin/src/admin-assistant-governance-workspace.tsx",
  "apps/admin/src/admin-agent-governance-workspace.tsx",
  "apps/admin/src/admin-agent-activity-workspace.tsx",
  "apps/admin/src/styles.css",
  "apps/admin/src/admin-assistant-lifecycle.ts",
  "apps/admin/src/admin-supervision-mode.ts",
  "apps/admin/src/admin-agent-activity-view-model.ts",
].map(async (path) => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
}));
const verifyVisual = process.argv.includes("--visual");

for (const label of ["助手能力", "模型路由", "审核发布", "生效验证"]) {
  assert.match(assistant, new RegExp(label), `assistant lifecycle step is missing: ${label}`);
}
assert.match(assistant, /deriveAssistantLifecycle/, "assistant workspace must derive effective readiness");
assert.match(assistant, /publicationMode="manage"/, "assistant workspace must complete Agent and route publication");
assert.doesNotMatch(assistant, /只读显示，不在此工作台切换/, "assistant publication must not remain read-only");
assert.match(assistant, /Production[^\n]+后续新 (Agent )?Run/, "Production publication must explain its impact");
assert.match(assistant, /高级策略/, "advanced strategy must be separated from the guided lifecycle");
assert.match(assistant, /runtimeEnvironment !== environment/, "real verification must reject a mismatched runtime environment");
assert.match(lifecycle, /route_not_published/, "assistant lifecycle must distinguish missing route publication");

if (supervisionMode) {
  assert.match(supervisionMode, /deriveSupervisionMode/, "supervision mode projection must be isolated");
  assert.match(governance, /受控托管/, "supervision workspace must explain the effective managed mode");
  assert.match(governance, /仅影响新 Workflow Run/, "supervision controls must explain snapshot scope");
}

if (activityViewModel || activity) {
  assert.match(activityViewModel, /buildActivityCases/, "activity correlation must be a pure view model");
  assert.match(activity, /需要关注/, "activity workspace must expose an exception-first queue");
  assert.match(activity, /批准后的影响/, "approval details must explain impact before mutation");
}

if (verifyVisual) {
  for (const selector of [
    ".assistant-lifecycle-track",
    ".assistant-readiness-band",
    ".supervision-mode-grid",
    ".agent-activity-workbench",
    ".agent-activity-detail",
  ]) {
    assert.match(styles, new RegExp(selector.replace(".", "\\.")), `Starlight workbench selector is missing: ${selector}`);
  }
}

console.log("PASS Admin AI governance v0.8.2 lifecycle, supervision, activity and Starlight contract");
