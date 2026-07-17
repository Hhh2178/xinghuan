import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const stylesSource = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");
const modelEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const apiSettingsSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const apiServerSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

function cssBlock(selector, requiredText = "") {
  let index = -1;
  let searchFrom = 0;
  do {
    index = stylesSource.indexOf(`${selector} {`, searchFrom);
    if (index < 0) return "";
    const end = stylesSource.indexOf("}", index);
    const block = end < 0 ? "" : stylesSource.slice(index, end + 1);
    if (!requiredText || block.includes(requiredText)) return block;
    searchFrom = end + 1;
  } while (searchFrom > 0);
  if (index < 0) return "";
  const end = stylesSource.indexOf("}", index);
  return end < 0 ? "" : stylesSource.slice(index, end + 1);
}

const providerRailBlock = cssBlock(".provider-rail", "display: grid");

const readAdminDbSource = apiServerSource.slice(
  apiServerSource.indexOf("async function readAdminDb()"),
  apiServerSource.indexOf("async function writeAdminDb("),
);
const providerRouteSplitSource = apiServerSource.slice(
  apiServerSource.indexOf("if (await handleAdminProviderRoutes({"),
  apiServerSource.indexOf("const providerRunningHubKeyPoolMatch"),
);
const providerProbeSource = apiServerSource.slice(
  apiServerSource.indexOf("async function probeProviderDraft"),
  apiServerSource.indexOf("async function fetchProviderModelsDraft"),
);

const checks = [
  {
    name: "styles define shared sticky offset",
    pass: stylesSource.includes("--admin-sticky-offset"),
  },
  {
    name: "provider rail stays sticky within the viewport",
    pass:
      providerRailBlock.includes("display: grid") &&
      providerRailBlock.includes("position: sticky") &&
      providerRailBlock.includes("top: var(--admin-sticky-offset)") &&
      providerRailBlock.includes("max-height: calc(100vh"),
  },
  {
    name: "users create column uses shared sticky offset",
    pass: stylesSource.includes(".users-create-column {\n  position: sticky;\n  top: var(--admin-sticky-offset);"),
  },
  {
    name: "api settings exposes styled status chip",
    pass:
      apiSettingsSource.includes("api-settings-status") &&
      apiSettingsSource.includes("api-settings-inline-status") &&
      !apiSettingsSource.includes("api-settings-section-head"),
  },
  {
    name: "api settings exposes assistant configuration card",
    pass: apiSettingsSource.includes("AI 协助配置") && stylesSource.includes(".api-assistant-card"),
  },
  {
    name: "api settings requires explicit assistant draft apply",
    pass:
      apiSettingsSource.includes("applyAssistantProviderDraft") &&
      apiSettingsSource.includes("应用到表单") &&
      !apiSettingsSource.includes("autoSaveAssistantDraft"),
  },
  {
    name: "api settings applies assistant model draft as well as provider draft",
    pass:
      apiSettingsSource.includes("upsertAssistantModelDraft") &&
      apiSettingsSource.includes("assistantResult.drafts?.model") &&
      apiSettingsSource.includes("/api/admin/models/"),
  },
  {
    name: "api settings calls assistant analyze-provider endpoint",
    pass: apiSettingsSource.includes("/api/admin/assistant/analyze-provider"),
  },
  {
    name: "api settings surfaces assistant-driven site access judgment",
    pass:
      apiSettingsSource.includes("接入判断") &&
      apiSettingsSource.includes("recommendedLayer") &&
      apiSettingsSource.includes("应用到表单"),
  },
  {
    name: "api settings surfaces generic async video task fields",
    pass:
      apiSettingsSource.includes("submitPath") &&
      apiSettingsSource.includes("async_video_task"),
  },
  {
    name: "model editor exposes toggle head and state",
    pass:
      modelEditorSource.includes("capability-toggle-head") &&
      modelEditorSource.includes("capability-toggle-state"),
  },
  {
    name: "model editor exposes structured poll timeout controls",
    pass:
      modelEditorSource.includes("model-runtime-grid") &&
      modelEditorSource.includes("最大轮询时长（秒）") &&
      (modelEditorSource.includes("默认 360 秒") || modelEditorSource.includes("默认留空，不启用轮询超时")),
  },
  {
    name: "postgres admin reads do not perform full-table writes",
    pass:
      readAdminDbSource.includes("if (!usePostgresRepository()") &&
      readAdminDbSource.includes("await writeAdminDb(visibleSanitized.db);"),
  },
  {
    name: "provider probe and fetch status updates are targeted in postgres",
    pass:
      providerRouteSplitSource.includes("updateProviderProbeResult") &&
      providerRouteSplitSource.includes("updateProviderLastFetchedAt") &&
      !providerRouteSplitSource.includes("writeAdminDb({ ...db, providers"),
  },
  {
    name: "GRSAI providers are detected by endpoint as well as protocol",
    pass:
      apiServerSource.includes("function isGrsaiProviderDraft") &&
      providerProbeSource.includes("isGrsaiProviderDraft(provider)") &&
      !providerProbeSource.includes('normalizeProviderProtocol(provider.protocol) === "grsai_draw"'),
  },
  {
    name: "provider list status icon keeps fixed dimensions",
    pass:
      stylesSource.includes("grid-template-columns: 36px minmax(0, 1fr) max-content;") &&
      stylesSource.includes(".provider-order-row {\n  display: grid;") &&
      stylesSource.includes(".provider-key {\n  display: grid;\n  flex: 0 0 34px;") &&
      stylesSource.includes(".provider-item em {\n  flex: 0 0 auto;"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin API layout contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
