import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiSettingsSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const stylesSource = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const adminTypesSource = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");

const checks = [
  {
    name: "admin assistant panel exposes structured document url input",
    pass:
      apiSettingsSource.includes("文档链接") &&
      apiSettingsSource.includes("assistantDocUrls") &&
      stylesSource.includes(".assistant-analysis-grid"),
  },
  {
    name: "admin assistant panel exposes request and response sample inputs",
    pass:
      apiSettingsSource.includes("请求样例") &&
      apiSettingsSource.includes("响应样例") &&
      apiSettingsSource.includes("assistantSampleRequest") &&
      apiSettingsSource.includes("assistantSampleResponse"),
  },
  {
    name: "admin assistant panel exposes async template selector",
    pass:
      apiSettingsSource.includes("异步模板") &&
      apiSettingsSource.includes("assistantAsyncTemplate"),
  },
  {
    name: "assistant analysis request supports multi-doc and async template fields",
    pass:
      adminTypesSource.includes("docUrls?: string[];") &&
      adminTypesSource.includes("asyncTemplate?: string;") &&
      serverSource.includes("docUrls?: string[];") &&
      serverSource.includes("asyncTemplate?: string;"),
  },
  {
    name: "server normalizes and fetches multiple doc urls",
    pass:
      serverSource.includes("normalizeAssistantDocUrls") &&
      serverSource.includes("safeFetchDocExcerpts") &&
      serverSource.includes("docFetchItems"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin assistant structured analysis contract failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
