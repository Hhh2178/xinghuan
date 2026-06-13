import { readFile } from "node:fs/promises";

async function main() {
  const apiSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  const settingsSource = await readFile(
    new URL("../apps/admin/src/admin-assistant-settings-panel.tsx", import.meta.url),
    "utf8",
  );
  const settingsRouteStart = apiSource.indexOf('if (url.pathname === "/api/admin/assistant/settings")');
  const settingsRouteEnd = apiSource.indexOf('if (url.pathname === "/api/admin/assistant/chat"', settingsRouteStart);
  const settingsRoute = settingsRouteStart >= 0 && settingsRouteEnd > settingsRouteStart
    ? apiSource.slice(settingsRouteStart, settingsRouteEnd)
    : "";
  const postgresWriterMatch = apiSource.match(
    /async function writeAssistantSettingsRecordPostgres\([\s\S]*?\n}\n\nfunction toAdminTaskRecord/,
  );
  const postgresWriter = postgresWriterMatch?.[0] || "";
  const storageWriterMatch = apiSource.match(
    /async function writeAssistantSettingsRecord\([\s\S]*?\n}\n\nfunction usePostgresRepository/,
  );
  const storageWriter = storageWriterMatch?.[0] || "";

  const checks = [
    [
      "API has a dedicated PostgreSQL assistant settings writer",
      /async function writeAssistantSettingsRecordPostgres\(/.test(apiSource),
    ],
    [
      "API has a storage-agnostic assistant settings writer",
      /async function writeAssistantSettingsRecord\(/.test(apiSource),
    ],
    [
      "Assistant settings PATCH uses targeted settings writer",
      /await writeAssistantSettingsRecord\(settings,\s*adminSettingsRevisionFromPayload\(body\)\)/.test(settingsRoute),
    ],
    [
      "Assistant settings PATCH does not rewrite the full admin database",
      settingsRoute.length > 0 && !/writeAdminDb\(/.test(settingsRoute),
    ],
    [
      "PostgreSQL assistant settings writer upserts only xh_assistant_settings",
      /insert into xh_assistant_settings/.test(postgresWriter) &&
        /on conflict \(id\) do update set/.test(postgresWriter),
    ],
    [
      "PostgreSQL assistant settings writer does not delete admin tables",
      postgresWriter.length > 0 && !/\bdelete\s+from\b/i.test(postgresWriter),
    ],
    [
      "File assistant settings writer preserves the rest of admin.json",
      /adminDbPath/.test(storageWriter) &&
        /\.\.\.db/.test(storageWriter) &&
        /assistantSettings:\s*\{/.test(storageWriter),
    ],
    [
      "Assistant settings writer supports revision conflict protection",
      /ADMIN_SETTINGS_REVISION_CONFLICT/.test(storageWriter) &&
        /expectedRevision/.test(storageWriter),
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
