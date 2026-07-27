import assert from "node:assert/strict";

import {
  assertOldServerTarget,
  assertTargetOverridesMatch,
  loadReleaseTargetProfile,
} from "./target-profile.mjs";

const oldGray = await loadReleaseTargetProfile({ profile: "old-server", environment: "gray" });
const oldProduction = await loadReleaseTargetProfile({ profile: "old-server", environment: "production" });

assert.doesNotThrow(() => assertOldServerTarget(oldGray));
assert.doesNotThrow(() => assertOldServerTarget(oldProduction));
assert.throws(
  () => assertOldServerTarget({ ...oldGray, host: "43.131.246.222" }),
  /OLD_SERVER_TARGET_MISMATCH/,
);
assert.throws(
  () => assertTargetOverridesMatch({ host: "43.131.246.222" }, oldGray),
  /OLD_SERVER_TARGET_MISMATCH/,
);
assert.doesNotThrow(() => assertTargetOverridesMatch({ host: oldGray.host, port: String(oldGray.port) }, oldGray));

console.log(JSON.stringify({ ok: true, contract: "old-server-target-profile" }, null, 2));
