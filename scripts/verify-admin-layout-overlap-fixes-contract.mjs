import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiSettingsSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const accountsSource = readFileSync(join(root, "apps", "admin", "src", "admin-user-accounts-section.tsx"), "utf8");
const permissionsRailSource = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-group-rail.tsx"), "utf8");
const resourcePanelSource = readFileSync(join(root, "apps", "admin", "src", "admin-public-resources-panel.tsx"), "utf8");
const resourceCardSource = readFileSync(join(root, "apps", "admin", "src", "admin-public-resource-card.tsx"), "utf8");
const stylesSource = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

const checks = [
  {
    name: "api settings removes duplicated capability console workspace band title",
    pass: !apiSettingsSource.includes('title="统一管理接入能力"'),
  },
  {
    name: "account create card uses dedicated stacked layout marker",
    pass: accountsSource.includes("users-create-stack-card"),
  },
  {
    name: "permissions rail no longer uses success pill for selected member count",
    pass: !permissionsRailSource.includes('tone={selected ? "success" : "muted"}'),
  },
  {
    name: "public resources panel tracks a single expanded resource id",
    pass:
      resourcePanelSource.includes("expandedItemId") &&
      resourcePanelSource.includes("setExpandedItemId") &&
      resourcePanelSource.includes("expanded={expandedItemId === item.id}"),
  },
  {
    name: "public resource card exposes expand collapse controls and detail section",
    pass:
      resourceCardSource.includes("onToggleExpand") &&
      resourceCardSource.includes("展开详情") &&
      resourceCardSource.includes("收起详情") &&
      resourceCardSource.includes("admin-public-resource-card__detail"),
  },
  {
    name: "public resource desktop grid uses adaptive minmax columns",
    pass: /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(240px,\s*1fr\)\)/.test(stylesSource),
  },
  {
    name: "public resource card has collapsed and expanded state styles",
    pass:
      stylesSource.includes(".admin-public-resource-card--expanded") &&
      stylesSource.includes(".admin-public-resource-card__detail") &&
      stylesSource.includes(".admin-public-resource-card__summary"),
  },
  {
    name: "create user panel and normal action buttons do not rely on bright cyan filled primary button",
    pass:
      !stylesSource.includes(".primary-action {\n  background: linear-gradient(135deg, #22d3ee") &&
      stylesSource.includes(".users-create-stack-card button"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin layout overlap fixes contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
