import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const apiSettingsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettings.tsx", import.meta.url),
  "utf8",
);
const keySectionsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsKeySections.tsx", import.meta.url),
  "utf8",
);
const localPathsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsLocalPathsSection.tsx", import.meta.url),
  "utf8",
);
const advancedProvidersSectionSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsAdvancedProvidersSection.tsx", import.meta.url),
  "utf8",
);
const cloudUploadSectionSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsCloudUploadSection.tsx", import.meta.url),
  "utf8",
);
const footerActionsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsFooterActions.tsx", import.meta.url),
  "utf8",
);

assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsKeySections['"]/,
  "ApiSettings should import the extracted key sections component",
);
assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsLocalPathsSection['"]/,
  "ApiSettings should import the extracted local paths section component",
);
assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsFooterActions['"]/,
  "ApiSettings should import the extracted footer actions component",
);
assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsAdvancedProvidersSection['"]/,
  "ApiSettings should import the extracted advanced providers section component",
);
assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsCloudUploadSection['"]/,
  "ApiSettings should import the extracted cloud upload section component",
);

assert.match(
  keySectionsSource,
  /export default function ApiSettingsKeySections\(/,
  "ApiSettingsKeySections should export the split key section",
);
assert.match(
  localPathsSource,
  /export default function ApiSettingsLocalPathsSection\(/,
  "ApiSettingsLocalPathsSection should export the split local paths section",
);
assert.match(
  footerActionsSource,
  /export default function ApiSettingsFooterActions\(/,
  "ApiSettingsFooterActions should export the split footer actions",
);
assert.match(
  advancedProvidersSectionSource,
  /export default function ApiSettingsAdvancedProvidersSection\(/,
  "ApiSettingsAdvancedProvidersSection should export the split advanced providers section",
);
assert.match(
  cloudUploadSectionSource,
  /export default function ApiSettingsCloudUploadSection\(/,
  "ApiSettingsCloudUploadSection should export the split cloud upload section",
);

assert.doesNotMatch(
  apiSettingsSource,
  /backupFileInputRef/,
  "ApiSettings should no longer own the import file input ref after footer extraction",
);

console.log("PASS api settings section split contract");
