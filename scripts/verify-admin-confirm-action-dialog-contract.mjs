import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-confirm-action-dialog.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const dialogSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const checks = [
  {
    name: "admin confirm action dialog module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports confirm action dialog",
    pass: mainSource.includes('from "./admin-confirm-action-dialog"') || mainSource.includes('from "./admin-confirm-action-dialog.js"'),
  },
  {
    name: "main no longer inlines ConfirmActionDialog",
    pass: !/function\s+ConfirmActionDialog\s*\(/.test(mainSource),
  },
  {
    name: "main exports ConfirmAction type",
    pass: /export\s+type\s+ConfirmAction\s*=/.test(mainSource),
  },
  {
    name: "module exports ConfirmActionDialog",
    pass: /export\s+function\s+ConfirmActionDialog\s*\(/.test(dialogSource),
  },
  {
    name: "dialog preserves modal semantics and tone class",
    pass:
      dialogSource.includes('className="admin-modal-backdrop"') &&
      dialogSource.includes('role="dialog"') &&
      dialogSource.includes('aria-modal="true"') &&
      dialogSource.includes('aria-labelledby="confirm-action-title"') &&
      dialogSource.includes("admin-confirm-dialog ${action.tone}"),
  },
  {
    name: "dialog preserves action copy rendering",
    pass:
      dialogSource.includes("{action.title}") &&
      dialogSource.includes("{action.message}") &&
      dialogSource.includes("{action.detail}") &&
      dialogSource.includes("{action.confirmLabel}"),
  },
  {
    name: "dialog preserves cancel and confirm behavior",
    pass:
      dialogSource.includes("onClick={onCancel}") &&
      dialogSource.includes("onClick={onConfirm}") &&
      dialogSource.includes("disabled={busy}") &&
      dialogSource.includes("取消"),
  },
  {
    name: "dialog preserves destructive icon and loading state",
    pass:
      dialogSource.includes('import { Loader2, Trash2 } from "lucide-react"') &&
      dialogSource.includes("<Trash2 aria-hidden=\"true\" />") &&
      dialogSource.includes("<Loader2 className=\"spin\" aria-hidden=\"true\" />"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin confirm action dialog contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
