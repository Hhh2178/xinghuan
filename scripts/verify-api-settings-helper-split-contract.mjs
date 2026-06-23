import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const apiSettings = await readFile(
  new URL("../apps/web/src/components/ApiSettings.tsx", import.meta.url),
  "utf8",
);
const apiSettingsHelpers = await readFile(
  new URL("../apps/web/src/components/apiSettingsHelpers.ts", import.meta.url),
  "utf8",
);

assert.match(
  apiSettings,
  /from ['"]\.\/apiSettingsHelpers['"]/,
  "ApiSettings should import extracted helper constants from apiSettingsHelpers",
);

for (const symbol of [
  "COMMON_KEYS",
  "CLASSIFIED_KEYS",
  "ADVANCED_PROVIDER_GUIDES",
  "CLOUD_UPLOAD_GUIDES",
  "summarizeCloudUploadForm",
  "normalizeImportedSettings",
  "buildSettingsBackupPayload",
  "tryParseJsonObject",
  "emptyMap",
  "emptyShow",
]) {
  assert.match(
    apiSettingsHelpers,
    new RegExp(`export\\s+(?:const|function)\\s+${symbol}\\b`),
    `apiSettingsHelpers should export ${symbol}`,
  );
}

assert.doesNotMatch(apiSettings, /const COMMON_KEYS:/);
assert.doesNotMatch(apiSettings, /const CLASSIFIED_KEYS:/);
assert.doesNotMatch(apiSettings, /function summarizeCloudUploadForm\(/);
assert.doesNotMatch(apiSettings, /function tryParseJsonObject\(/);
assert.doesNotMatch(apiSettings, /function normalizeImportedSettings\(/);
assert.doesNotMatch(apiSettings, /function buildSettingsBackupPayload\(/);

console.log("PASS api settings helper split contract");
