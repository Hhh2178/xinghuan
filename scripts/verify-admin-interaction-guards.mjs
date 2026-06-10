import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const adminSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const apiSettingsSource = readFileSync(
  join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"),
  "utf8",
);
const adminStyles = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");
const interactionSources = [adminSource, apiSettingsSource].join("\n");

const checks = [
  {
    name: "admin avoids native confirm dialogs",
    pass: !/\b(?:window\.)?confirm\s*\(/.test(interactionSources),
  },
  {
    name: "admin avoids native prompt dialogs",
    pass: !/\b(?:window\.)?prompt\s*\(/.test(interactionSources),
  },
  {
    name: "destructive provider/model actions use in-app confirm dialog",
    pass:
      interactionSources.includes("ConfirmActionDialog") &&
      apiSettingsSource.includes("pendingConfirmAction") &&
      apiSettingsSource.includes("requestDeleteProvider") &&
      apiSettingsSource.includes("requestDeleteModel"),
  },
  {
    name: "manual model creation uses in-app dialog",
    pass:
      interactionSources.includes("ManualModelDialog") &&
      apiSettingsSource.includes("manualModelCapability") &&
      apiSettingsSource.includes("requestAddManualModel"),
  },
  {
    name: "admin modal styles are present",
    pass:
      adminStyles.includes(".admin-modal-backdrop") &&
      adminStyles.includes(".admin-confirm-dialog") &&
      adminStyles.includes(".manual-model-dialog"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin interaction guard verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
