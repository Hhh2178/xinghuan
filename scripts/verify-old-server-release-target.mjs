import {
  firstArg,
  parseArgs,
  printJson,
  requiredArg,
} from "./release/_shared.mjs";
import {
  assertOldServerTarget,
  assertTargetOverridesMatch,
  loadReleaseTargetProfile,
  sanitizedTargetFingerprint,
} from "./release/target-profile.mjs";

const args = parseArgs(process.argv.slice(2));
const profile = requiredArg(args, "target-profile");
const environment = String(firstArg(args.env) || "gray").trim();
const target = await loadReleaseTargetProfile({ profile, environment });

assertOldServerTarget(target);
assertTargetOverridesMatch(args, target);

printJson({ ok: true, stage: "verify-old-server-release-target", target: sanitizedTargetFingerprint(target) });
