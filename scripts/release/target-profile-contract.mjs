import strict from "node:assert/strict";
import * as profile from "./target-profile.mjs";

const targets = await Promise.all(
  ["gray", "production"].map(async (environment) => {
    const target = await profile.loadReleaseTargetProfile({ profile: "old-server", environment });
    profile.assertOldServerTarget(target);
    return target;
  }),
);

strict.equal(targets.length, 2, "both old-server environments must resolve");
strict.equal(targets[0]?.host, "101.33.75.38", "Gray host must be the approved old server");
strict.equal(targets[1]?.port, 728, "Production must use the approved SSH port");

const gray = targets[0];
strict.throws(() => profile.assertOldServerTarget({ ...gray, host: "43.131.246.222" }), {
  message: /OLD_SERVER_TARGET_MISMATCH/,
});
strict.throws(() => profile.assertTargetOverridesMatch({ "remote-root": "/other" }, gray), {
  message: /OLD_SERVER_TARGET_MISMATCH/,
});
profile.assertTargetOverridesMatch({ host: gray.host, user: "ubuntu" }, gray);

process.stdout.write(`${JSON.stringify({ ok: true, contract: "old-server-target-profile", environments: targets.map((item) => item.environment) })}\n`);
