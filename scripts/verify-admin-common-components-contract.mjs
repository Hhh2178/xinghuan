import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-common-components.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const workspaceBandSource = readFileSync(join(root, "apps", "admin", "src", "admin-shell-workspace-band.tsx"), "utf8");
const componentSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const checks = [
  {
    name: "admin common components module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "admin shell imports common components",
    pass: workspaceBandSource.includes('from "./admin-common-components"') || workspaceBandSource.includes('from "./admin-common-components.js"'),
  },
  {
    name: "main does not inline common table/form/status components",
    pass:
      !/function\s+DataTable\s*\(/.test(mainSource) &&
      !/function\s+AdminTable\s*\(/.test(mainSource) &&
      !/function\s+FormPanel\s*\(/.test(mainSource) &&
      !/function\s+StatusPill\s*\(/.test(mainSource),
  },
  {
    name: "module exports expected components",
    pass:
      /export\s+function\s+DataTable\s*\(/.test(componentSource) &&
      /export\s+function\s+AdminTable\s*\(/.test(componentSource) &&
      /export\s+function\s+FormPanel\s*\(/.test(componentSource) &&
      /export\s+function\s+StatusPill\s*\(/.test(componentSource),
  },
  {
    name: "table and form class names stay stable",
    pass:
      componentSource.includes('className="data-panel"') &&
      componentSource.includes('"table-wrap"') &&
      componentSource.includes('className="form-panel"') &&
      componentSource.includes('bodyClassName = "form-grid"'),
  },
  {
    name: "status pill keeps tone class contract",
    pass: componentSource.includes("status-pill ${tone}") && componentSource.includes("StatusTone"),
  },
  {
    name: "data table renders headers and rows",
    pass:
      componentSource.includes("columns.map") &&
      componentSource.includes("rows.map") &&
      componentSource.includes("<AdminTable title={title}>"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin common components contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
