import { readFile } from "node:fs/promises";

async function main() {
  const apiSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  const routeSource = await readFile(
    new URL("../apps/api/src/admin-assistant-settings-routes.ts", import.meta.url),
    "utf8",
  );
  const repositorySource = await readFile(
    new URL("../apps/api/src/settings-repository.ts", import.meta.url),
    "utf8",
  );
  const settingsSource = await readFile(
    new URL("../apps/admin/src/admin-assistant-settings-panel.tsx", import.meta.url),
    "utf8",
  );

  const checks = [
    [
      "API wires the settings repository",
      /createSettingsRepository\(/.test(apiSource) &&
        /const settingsRepository = createSettingsRepository/.test(apiSource),
    ],
    [
      "API exposes a thin storage-agnostic assistant settings writer",
      /async function writeAssistantSettingsRecord\([\s\S]*?settingsRepository\.writeAssistantSettingsRecord\(settings,\s*expectedRevision\)/.test(apiSource),
    ],
    [
      "Assistant settings GET uses targeted settings reader",
      /readAssistantSettingsRecord/.test(routeSource) &&
        !/readAdminDb/.test(routeSource),
    ],
    [
      "Assistant settings PATCH uses targeted settings writer",
      /await deps\.writeAssistantSettingsRecord\(settings,\s*deps\.adminSettingsRevisionFromPayload\(body\)\)/.test(routeSource),
    ],
    [
      "Assistant settings PATCH does not rewrite the full admin database",
      !/writeAdminDb\(/.test(routeSource),
    ],
    [
      "Repository PostgreSQL assistant settings writer upserts only xh_assistant_settings",
      /insert into xh_assistant_settings/.test(repositorySource) &&
        /on conflict \(id\) do update set/.test(repositorySource),
    ],
    [
      "Targeted assistant settings writer does not delete admin tables",
      /async function writeAssistantSettingsRecord\([\s\S]*?insert into xh_assistant_settings/.test(repositorySource) &&
        !/async function writeAssistantSettingsRecord\([\s\S]*?\bdelete\s+from\b/i.test(repositorySource),
    ],
    [
      "File assistant settings writer preserves the rest of admin.json",
      /adminDbPath/.test(repositorySource) &&
        /\.\.\.db/.test(repositorySource) &&
        /assistantSettings:\s*\{/.test(repositorySource),
    ],
    [
      "Assistant settings writer supports revision conflict protection",
      /createRevisionConflictError\("assistant",\s*currentRevision\)/.test(repositorySource) &&
        /expectedRevision/.test(repositorySource),
    ],
    [
      "Assistant settings panel keeps local draft state instead of saving on every keystroke",
      settingsSource.includes("useState") &&
        settingsSource.includes("setDraft") &&
        !settingsSource.includes('onChange={(event) => void onSave(') &&
        !settingsSource.includes('onChange={(checked) => void onSave('),
    ],
    [
      "Assistant settings panel exposes explicit save action",
      settingsSource.includes("保存 AI 助手配置") &&
        settingsSource.includes("assistant-settings-actions"),
    ],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
