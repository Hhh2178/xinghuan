import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootPackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const connectorPackage = JSON.parse(
  await readFile(
    new URL("../apps/comfyui-connector/package.json", import.meta.url),
    "utf8",
  ),
);
const connectorSource = await readFile(
  new URL("../apps/comfyui-connector/src/connector.ts", import.meta.url),
  "utf8",
);
const readmeSource = await readFile(
  new URL("../apps/comfyui-connector/README.md", import.meta.url),
  "utf8",
);
const envExampleSource = await readFile(
  new URL("../apps/comfyui-connector/.env.example", import.meta.url),
  "utf8",
);
const configSource = await readFile(
  new URL("../apps/comfyui-connector/src/config.ts", import.meta.url),
  "utf8",
);
const systemdSource = await readFile(
  new URL(
    "../ops/systemd/xinghuan-comfyui-connector.service.example",
    import.meta.url,
  ),
  "utf8",
);

assert.equal(
  connectorPackage.name,
  "@xinghuan/comfyui-connector",
  "connector workspace should exist",
);
assert.equal(
  rootPackage.scripts["verify:comfyui-connector-harness"],
  "node scripts/verify-comfyui-connector-harness-contract.mjs",
  "root package should expose connector harness verification",
);
assert.match(
  connectorSource,
  /readConnectorConfig/,
  "connector should read config from a dedicated config module",
);
assert.match(
  configSource,
  /export function readConnectorConfig/,
  "connector config module should expose readConnectorConfig",
);
assert.match(
  envExampleSource,
  /XINGHUAN_COMFYUI_CONNECTOR_API_BASE_URL=/,
  "env example should document api base url",
);
assert.match(
  envExampleSource,
  /XINGHUAN_COMFYUI_CONNECTOR_TOKEN=/,
  "env example should document connector token",
);
assert.match(
  envExampleSource,
  /XINGHUAN_COMFYUI_INSTANCE_ID=/,
  "env example should document instance id",
);
assert.match(
  readmeSource,
  /环境变量/,
  "README should document environment variables",
);
assert.match(
  readmeSource,
  /systemd/,
  "README should document systemd deployment",
);
assert.match(
  readmeSource,
  /npm run verify:comfyui-connector-harness/,
  "README should document the harness verification command",
);
assert.match(
  systemdSource,
  /EnvironmentFile=/,
  "systemd template should use an env file",
);
assert.match(
  systemdSource,
  /apps\/comfyui-connector/,
  "systemd template should start the connector workspace",
);

console.log("comfyui connector harness contract: ok");
