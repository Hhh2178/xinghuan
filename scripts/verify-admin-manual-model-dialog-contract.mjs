import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-manual-model-dialog.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const dialogSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const checks = [
  {
    name: "admin manual model dialog module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports manual model dialog",
    pass: mainSource.includes('from "./admin-manual-model-dialog"') || mainSource.includes('from "./admin-manual-model-dialog.js"'),
  },
  {
    name: "main no longer inlines ManualModelDialog",
    pass: !/function\s+ManualModelDialog\s*\(/.test(mainSource),
  },
  {
    name: "main exports Capability type",
    pass: /export\s+type\s+Capability\s*=/.test(mainSource),
  },
  {
    name: "capability label helper lives outside main",
    pass:
      !/function\s+capabilityLabel\s*\(/.test(mainSource) &&
      dialogSource.includes('from "./admin-view-model"') &&
      dialogSource.includes("capabilityLabel(capability)") &&
      dialogSource.includes('import type { Capability } from "./main"') &&
      !dialogSource.includes('import { capabilityLabel } from "./main"') &&
      !dialogSource.includes('import { Capability } from "./main"'),
  },
  {
    name: "module exports ManualModelDialog",
    pass: /export\s+function\s+ManualModelDialog\s*\(/.test(dialogSource),
  },
  {
    name: "dialog preserves modal semantics and labels",
    pass:
      dialogSource.includes('className="admin-modal-backdrop"') &&
      dialogSource.includes('role="dialog"') &&
      dialogSource.includes('aria-labelledby="manual-model-title"') &&
      dialogSource.includes('className="manual-model-dialog"') &&
      dialogSource.includes("新增{capabilityLabel(capability)}模型") &&
      dialogSource.includes("手动登记模型 ID 后，画布会从模型目录读取。"),
  },
  {
    name: "dialog preserves model id input placeholders",
    pass:
      dialogSource.includes('placeholder={capability === "image" ? "gpt-image-2" : capability === "video" ? "grok-video" : "gpt-5.5"}') &&
      dialogSource.includes("autoFocus") &&
      dialogSource.includes("const trimmedModelId = modelId.trim()"),
  },
  {
    name: "dialog preserves submit and disabled behavior",
    pass:
      dialogSource.includes("event.preventDefault()") &&
      dialogSource.includes("if (trimmedModelId) void onSubmit(trimmedModelId)") &&
      dialogSource.includes("disabled={busy || !trimmedModelId}") &&
      dialogSource.includes("创建模型"),
  },
  {
    name: "dialog preserves cancel and loading icon behavior",
    pass:
      dialogSource.includes("onClick={onCancel}") &&
      dialogSource.includes("disabled={busy}") &&
      dialogSource.includes("<Loader2") &&
      dialogSource.includes("<Plus"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin manual model dialog contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
