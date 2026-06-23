import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const apiSettings = await readFile(
  new URL("../apps/web/src/components/ApiSettings.tsx", import.meta.url),
  "utf8",
);
const keySectionsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsKeySections.tsx", import.meta.url),
  "utf8",
);
const keyFieldComponent = await readFile(
  new URL("../apps/web/src/components/ApiSettingsKeyField.tsx", import.meta.url),
  "utf8",
);

assert.match(
  apiSettings,
  /from ['"]\.\/ApiSettingsKeySections['"]/,
  "ApiSettings should import the extracted key sections component",
);

assert.match(
  keySectionsSource,
  /from ['"]\.\/ApiSettingsKeyField['"]/,
  "ApiSettingsKeySections should import the extracted key field component",
);

assert.match(
  keyFieldComponent,
  /export default function ApiSettingsKeyField\(/,
  "ApiSettingsKeyField should export the key field component",
);

assert.doesNotMatch(
  keySectionsSource,
  /const renderKey = \(/,
  "ApiSettingsKeySections should not keep the old inline renderKey helper after the split",
);

assert.doesNotMatch(
  keySectionsSource,
  /const renderGetKeyButtons = \(/,
  "ApiSettingsKeySections should not keep inline key action button rendering after the split",
);

console.log("PASS api settings key field split contract");
