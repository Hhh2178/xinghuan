import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const adminSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const adminStyles = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

const checks = [
  {
    name: "admin avoids native confirm dialogs",
    pass: !/\b(?:window\.)?confirm\s*\(/.test(adminSource),
  },
  {
    name: "admin avoids native prompt dialogs",
    pass: !/\b(?:window\.)?prompt\s*\(/.test(adminSource),
  },
  {
    name: "destructive provider/model actions use in-app confirm dialog",
    pass:
      adminSource.includes("ConfirmActionDialog") &&
      adminSource.includes("pendingConfirmAction") &&
      adminSource.includes("requestDeleteProvider") &&
      adminSource.includes("requestDeleteModel"),
  },
  {
    name: "manual model creation uses in-app dialog",
    pass:
      adminSource.includes("ManualModelDialog") &&
      adminSource.includes("manualModelCapability") &&
      adminSource.includes("requestAddManualModel"),
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
