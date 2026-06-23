import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const apiSettings = await readFile(
  new URL("../apps/web/src/components/ApiSettings.tsx", import.meta.url),
  "utf8",
);
const keyFieldComponent = await readFile(
  new URL("../apps/web/src/components/ApiSettingsKeyField.tsx", import.meta.url),
  "utf8",
);

assert.match(
  apiSettings,
  /from ['"]\.\/ApiSettingsKeyField['"]/,
  "ApiSettings should import the extracted key field component",
);

assert.match(
  keyFieldComponent,
  /export default function ApiSettingsKeyField\(/,
  "ApiSettingsKeyField should export the key field component",
);

assert.doesNotMatch(
  apiSettings,
  /const renderKey = \(/,
  "ApiSettings should not keep the inline renderKey helper after the split",
);

assert.doesNotMatch(
  apiSettings,
  /const renderGetKeyButtons = \(/,
  "ApiSettings should not keep inline key action button rendering after the split",
);

console.log("PASS api settings key field split contract");
