import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiSettingsSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const accountsSource = readFileSync(join(root, "apps", "admin", "src", "admin-user-accounts-section.tsx"), "utf8");
const groupsSource = readFileSync(join(root, "apps", "admin", "src", "admin-user-groups-section.tsx"), "utf8");
const permissionsRailSource = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-group-rail.tsx"), "utf8");
const resourcePanelSource = readFileSync(join(root, "apps", "admin", "src", "admin-public-resources-panel.tsx"), "utf8");
const resourceCardSource = readFileSync(join(root, "apps", "admin", "src", "admin-public-resource-card.tsx"), "utf8");
const mediaModalSource = readFileSync(join(root, "apps", "admin", "src", "admin-media-preview-modal.tsx"), "utf8");
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
    name: "account create form removes noisy placeholders and adds random strong password action",
    pass:
      !accountsSource.includes('placeholder="邮箱"') &&
      !accountsSource.includes('placeholder="名称"') &&
      !accountsSource.includes('placeholder="账号备注"') &&
      accountsSource.includes("generateStrongPassword") &&
      accountsSource.includes("生成强密码") &&
      stylesSource.includes(".users-create-stack-card__password-row"),
  },
  {
    name: "account records default to compact row and expand details on demand",
    pass:
      accountsSource.includes("expandedUserId") &&
      accountsSource.includes("users-account-record__summary-row") &&
      accountsSource.includes("users-account-record__details") &&
      accountsSource.includes("展开管理") &&
      accountsSource.includes("收起管理"),
  },
  {
    name: "user group create form uses the same full-width vertical card pattern",
    pass:
      groupsSource.includes("users-group-create-card") &&
      groupsSource.includes("users-group-create-card__field") &&
      !groupsSource.includes('placeholder="分组名称"') &&
      !groupsSource.includes('placeholder="分组说明"') &&
      !groupsSource.includes('placeholder="排序值"') &&
      stylesSource.includes(".users-group-create-card"),
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
    pass: /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(220px,\s*1fr\)\)/.test(stylesSource),
  },
  {
    name: "public resource card has collapsed and expanded state styles",
    pass:
      stylesSource.includes(".admin-public-resource-card--expanded") &&
      stylesSource.includes(".admin-public-resource-card__detail") &&
      stylesSource.includes(".admin-public-resource-card__summary") &&
      !/\.admin-public-resource-card--expanded\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s.test(stylesSource),
  },
  {
    name: "public resource previews and modal use contain instead of cropped cover",
    pass:
      stylesSource.includes(".admin-public-resource-card__preview-frame img") &&
      stylesSource.includes("object-fit: contain") &&
      stylesSource.includes(".admin-media-preview-modal__media") &&
      mediaModalSource.includes('className="admin-media-preview-modal__media"'),
  },
  {
    name: "api settings avoids sticky provider rail overlap and keeps content scroll isolated",
    pass:
      stylesSource.includes(".api-settings-layout") &&
      stylesSource.includes("grid-template-columns: minmax(220px, 260px) minmax(0, 1fr)") &&
      /\.provider-rail\s*\{\s*position:\s*relative;/s.test(stylesSource) &&
      stylesSource.includes("max-height: calc(100vh - var(--admin-sticky-offset) - 24px)") &&
      /\.api-settings-content\s*\{[\s\S]*?min-width:\s*0;/s.test(stylesSource),
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
