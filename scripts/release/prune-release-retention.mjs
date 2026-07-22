import { readFile } from "node:fs/promises";

import {
  ensureFileExists,
  firstArg,
  flagEnabled,
  helpRequested,
  loadEnvironmentConfig,
  parseArgs,
  printJson,
  requiredArg,
  runCommand,
  shellQuote,
  sshTarget,
} from "./_shared.mjs";

const RELEASE_RETENTION_COUNT = 5;
const args = parseArgs(process.argv.slice(2));

if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/prune-release-retention.mjs --env=<gray|production> --ssh-key=<path> [--apply=true --confirm-retention=5]

The default mode is a read-only dry run. Apply is accepted only with --confirm-retention=5.`);
  process.exit(0);
}

const environment = String(firstArg(args.env) || "gray").trim();
const defaults = await loadEnvironmentConfig(environment);
const releaseState = JSON.parse(await readFile(new URL("../../ops/current/release-state.json", import.meta.url), "utf8"));
const rollbackReleaseId = String(releaseState.environments?.[environment]?.rollbackReleaseId || "").trim();
if (!rollbackReleaseId) throw new Error(`ROLLBACK_RELEASE_ID_MISSING:${environment}`);
const sshKeyPath = await ensureFileExists(requiredArg(args, "ssh-key"));
const host = String(firstArg(args.host) || defaults.host);
const port = String(firstArg(args.port) || defaults.sshPort);
const user = String(firstArg(args.user) || defaults.sshUser);
const remoteRoot = defaults.remoteRoot;
const apply = flagEnabled(args.apply);
const confirmation = String(firstArg(args["confirm-retention"]) || "").trim();

if (apply && confirmation !== String(RELEASE_RETENTION_COUNT)) {
  throw new Error(`RETENTION_CONFIRMATION_REQUIRED:${RELEASE_RETENTION_COUNT}`);
}

const releaseRoot = `${remoteRoot}/releases`;
const currentLink = `${remoteRoot}/current`;
const remoteScript = `
set -euo pipefail
release_root=${shellQuote(releaseRoot)}
current_link=${shellQuote(currentLink)}
rollback_release_id=${shellQuote(rollbackReleaseId)}
retention=${RELEASE_RETENTION_COUNT}
apply=${apply ? "true" : "false"}

current_release="$(readlink -f -- "$current_link")"
case "$current_release" in
  "$release_root"/*) ;;
  *) echo "REFUSE_CURRENT_OUTSIDE_RELEASE_ROOT|$current_release"; exit 41 ;;
esac

rollback_release="$release_root/$rollback_release_id"
[ -d "$rollback_release" ] || { echo "REFUSE_ROLLBACK_MISSING|$rollback_release"; exit 42; }
rollback_release="$(readlink -f -- "$rollback_release")"
case "$rollback_release" in
  "$release_root"/*) ;;
  *) echo "REFUSE_ROLLBACK_OUTSIDE_RELEASE_ROOT|$rollback_release"; exit 43 ;;
esac

mapfile -t releases < <(find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@|%p\n' | sort -t'|' -k1,1nr | cut -d'|' -f2-)
if [ "${"${#releases[@]}"}" -eq 0 ]; then
  echo "REFUSE_EMPTY_RELEASE_SET"; exit 44
fi

declare -A retained=()
retained["$current_release"]=1
retained["$rollback_release"]=1
retained_count="${"${#retained[@]}"}"
for release in "${"${releases[@]}"}"; do
  [ "$retained_count" -lt "$retention" ] || break
  resolved="$(readlink -f -- "$release")"
  case "$resolved" in
    "$release_root"/*) ;;
    *) echo "REFUSE_CANDIDATE_OUTSIDE_RELEASE_ROOT|$resolved"; exit 45 ;;
  esac
  if [ -z "${"${retained[$resolved]:-}"}" ]; then
    retained["$resolved"]=1
    retained_count=$((retained_count + 1))
  fi
done

current_retained=false
rollback_retained=false
for release in "${"${releases[@]}"}"; do
  resolved="$(readlink -f -- "$release")"
  case "$resolved" in
    "$release_root"/*) ;;
    *) echo "REFUSE_CANDIDATE_OUTSIDE_RELEASE_ROOT|$resolved"; exit 46 ;;
  esac
  if [ -n "${"${retained[$resolved]:-}"}" ]; then
    echo "KEEP|$resolved"
    [ "$resolved" = "$current_release" ] && current_retained=true
    [ "$resolved" = "$rollback_release" ] && rollback_retained=true
    continue
  fi
  [ "$resolved" != "$current_release" ] || { echo "REFUSE_DELETE_CURRENT|$resolved"; exit 47; }
  [ "$resolved" != "$rollback_release" ] || { echo "REFUSE_DELETE_ROLLBACK|$resolved"; exit 48; }
  bytes="$(du -s -B1 "$resolved" | awk '{print $1}')"
  echo "PRUNE|$bytes|$resolved"
done

[ "$current_retained" = true ] || { echo "REFUSE_CURRENT_NOT_RETAINED|$current_release"; exit 49; }
[ "$rollback_retained" = true ] || { echo "REFUSE_ROLLBACK_NOT_RETAINED|$rollback_release"; exit 50; }

if [ "$apply" = true ]; then
  for release in "${"${releases[@]}"}"; do
    resolved="$(readlink -f -- "$release")"
    [ -z "${"${retained[$resolved]:-}"}" ] || continue
    [ "$resolved" != "$current_release" ] || { echo "REFUSE_DELETE_CURRENT|$resolved"; exit 51; }
    [ "$resolved" != "$rollback_release" ] || { echo "REFUSE_DELETE_ROLLBACK|$resolved"; exit 52; }
    find "$resolved" -depth -delete
    [ ! -e "$resolved" ] || { echo "DELETE_INCOMPLETE|$resolved"; exit 53; }
    echo "DELETED|$resolved"
  done
fi

remaining="$(find "$release_root" -mindepth 1 -maxdepth 1 -type d | wc -l)"
expected="${"${#releases[@]}"}"
if [ "$apply" = true ] && [ "$expected" -gt "$retention" ]; then
  expected="$retention"
fi
[ "$remaining" -eq "$expected" ] || { echo "RETENTION_COUNT_MISMATCH|$remaining|$expected"; exit 54; }
[ -d "$current_release" ] || { echo "CURRENT_RELEASE_MISSING|$current_release"; exit 55; }
[ -d "$rollback_release" ] || { echo "ROLLBACK_RELEASE_MISSING|$rollback_release"; exit 56; }
echo "RESULT|$apply|$remaining|$current_release|$rollback_release"
`;

const target = sshTarget(user, host);
const result = await runCommand(
  "ssh",
  ["-i", sshKeyPath, "-p", port, target, "bash", "-lc", shellQuote(remoteScript)],
  { inherit: false, capture: true },
);

const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
printJson({
  ok: true,
  environment,
  apply,
  retention: RELEASE_RETENTION_COUNT,
  rollbackReleaseId,
  target,
  remoteRoot,
  inventory: lines,
});
