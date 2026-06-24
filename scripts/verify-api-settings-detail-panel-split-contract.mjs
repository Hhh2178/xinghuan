import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const apiSettingsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettings.tsx", import.meta.url),
  "utf8",
);
const cloudTargetDetailSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsCloudTargetDetailPanel.tsx", import.meta.url),
  "utf8",
);
const formBlockSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsFormBlock.tsx", import.meta.url),
  "utf8",
);

assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsCloudTargetDetailPanel['"]/,
  "ApiSettings should import the extracted cloud target detail panel",
);
assert.match(
  apiSettingsSource,
  /const renderCloudTargetForm = \(target: CloudUploadTargetConfig\) => \{\s*return \(\s*<ApiSettingsCloudTargetDetailPanel/,
  "ApiSettings should delegate cloud target detail rendering to the extracted panel",
);
assert.match(
  cloudTargetDetailSource,
  /export default function ApiSettingsCloudTargetDetailPanel\(/,
  "cloud target detail panel should export the extracted detail component",
);
assert.match(
  cloudTargetDetailSource,
  /from ['"]\.\/ApiSettingsFormBlock['"]/,
  "cloud target detail panel should reuse the extracted form block shell",
);
assert.match(
  formBlockSource,
  /export default function ApiSettingsFormBlock\(/,
  "ApiSettingsFormBlock should export the extracted detail block shell",
);

console.log("PASS api settings detail panel split contract");
