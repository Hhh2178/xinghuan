import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const adminPanelSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const adminEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const stylesSource = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

const checks = [
  {
    name: "admin model test route is registered",
    pass: serverSource.includes("/^\\/api\\/admin\\/models\\/([^/]+)\\/test$/") && serverSource.includes("testAdminModelConnectivity"),
  },
  {
    name: "test route supports safe test kinds",
    pass:
      serverSource.includes('"chat"') &&
      serverSource.includes('"image_understanding"') &&
      serverSource.includes('"video_understanding"') &&
      serverSource.includes('"audio_generation"') &&
      serverSource.includes('"voice_clone"'),
  },
  {
    name: "test route stores per-model test state",
    pass:
      serverSource.includes("model.testState") &&
      serverSource.includes("checkedAt") &&
      serverSource.includes("latencyMs") &&
      serverSource.includes("inferredTags"),
  },
  {
    name: "admin settings panel wires test callback",
    pass: adminPanelSource.includes("testModel") && adminPanelSource.includes("onTest={testModel}"),
  },
  {
    name: "admin model editor renders test controls",
    pass:
      adminEditorSource.includes("model-test-actions") &&
      adminEditorSource.includes("测试并修正") &&
      adminEditorSource.includes("测试"),
  },
  {
    name: "admin model editor displays latest test state",
    pass:
      adminEditorSource.includes("model-test-state") &&
      adminEditorSource.includes("checkedAt") &&
      adminEditorSource.includes("sampleOutput"),
  },
  {
    name: "test controls have dedicated styles",
    pass:
      stylesSource.includes(".model-test-actions") &&
      stylesSource.includes(".model-test-action") &&
      stylesSource.includes(".model-test-state"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Provider model tests contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
