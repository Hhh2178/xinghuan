import { strict as assert } from "node:assert";

import type { ApiSettings, CloudUploadTargetConfig } from "../apps/web/src/types/canvas";
import {
  SETTINGS_BACKUP_SCHEMA,
  SETTINGS_BACKUP_VERSION,
  buildSettingsBackupPayload,
  normalizeImportedSettings,
} from "../apps/web/src/components/apiSettingsHelpers";

const normalized = normalizeImportedSettings({
  settings: {
    zhenzhenApiKey: "  sk-real  ",
    rhApiKey: "******masked",
    llmApiKey: "",
    fileSavePath: "  D:/exports  ",
    preferences: { theme: "dark" },
    advancedProviders: [{ id: "ap-1", label: "Provider A", protocol: "openai-compatible" }],
    cloudUploadTargets: [{ id: "cos-1", provider: "tencent-cos", label: "COS A" }],
  },
});

assert.equal(normalized.zhenzhenApiKey, "sk-real");
assert.equal("rhApiKey" in normalized, false, "masked keys should be skipped during import");
assert.equal("llmApiKey" in normalized, false, "empty keys should be skipped during import");
assert.equal(normalized.fileSavePath, "D:/exports");
assert.deepEqual(normalized.preferences, { theme: "dark" });
assert.equal(normalized.advancedProviders?.[0]?.id, "ap-1");
assert.equal((normalized.cloudUploadTargets as CloudUploadTargetConfig[] | undefined)?.[0]?.id, "cos-1");

assert.throws(
  () => normalizeImportedSettings("oops"),
  /设置备份格式不正确/,
  "non-object payloads should be rejected",
);

const payload = buildSettingsBackupPayload({
  raw: {
    rhApiKey: "old-rh",
    zhenzhenBaseUrl: "legacy",
  } as ApiSettings,
  editable: {
    rhApiKey: "new-rh",
    llmApiKey: "  ",
    fileSavePath: "D:/canvas",
  },
  now: new Date("2026-06-24T08:09:10.000Z"),
  fixedZhenzhenBaseUrl: "https://ai.t8star.org",
  runningHubBaseUrl: "https://www.runninghub.cn",
});

assert.equal(payload.schema, SETTINGS_BACKUP_SCHEMA);
assert.equal(payload.version, SETTINGS_BACKUP_VERSION);
assert.equal(payload.exportedAt, "2026-06-24T08:09:10.000Z");
assert.equal(payload.settings.rhApiKey, "new-rh");
assert.equal(payload.settings.fileSavePath, "D:/canvas");
assert.equal("llmApiKey" in payload.settings, false, "blank editable string values should not override backup payload");
assert.equal(payload.settings.zhenzhenBaseUrl, "https://ai.t8star.org");
assert.equal(payload.settings.llmBaseUrl, "https://ai.t8star.org");
assert.equal(payload.settings.rhBaseUrl, "https://www.runninghub.cn");

console.log("PASS api settings backup helper contract");
