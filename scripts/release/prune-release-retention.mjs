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

const RELEASE_RETENTION_COUNT = 3;
const args = parseArgs(process.argv.slice(2));

if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/prune-release-retention.mjs --env=<gray|production> --ssh-key=<path> [--apply=true --confirm-retention=3]

The default mode is a read-only dry run. Apply is accepted only with --confirm-retention=3.`);
  process.exit(0);
}

const environment = String(firstArg(args.env) || "gray").trim();
const defaults = await loadEnvironmentConfig(environment);
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
retention=${RELEASE_RETENTION_COUNT}
apply=${apply ? "true" : "false"}

current_release="$(readlink -f -- "$current_link")"
case "$current_release" in
  "$release_root"/*) ;;
  *) echo "REFUSE_CURRENT_OUTSIDE_RELEASE_ROOT|$current_release"; exit 41 ;;
esac

mapfile -t releases < <(find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@|%p\n' | sort -t'|' -k1,1nr | cut -d'|' -f2-)
if [ "${"${#releases[@]}"}" -eq 0 ]; then
  echo "REFUSE_EMPTY_RELEASE_SET"; exit 42
fi

current_retained=false
for index in "${"${!releases[@]}"}"; do
  release="${"${releases[$index]}"}"
  resolved="$(readlink -f -- "$release")"
  case "$resolved" in
    "$release_root"/*) ;;
    *) echo "REFUSE_CANDIDATE_OUTSIDE_RELEASE_ROOT|$resolved"; exit 43 ;;
  esac
  if [ "$index" -lt "$retention" ]; then
    echo "KEEP|$resolved"
    [ "$resolved" = "$current_release" ] && current_retained=true
    continue
  fi
  [ "$resolved" != "$current_release" ] || { echo "REFUSE_DELETE_CURRENT|$resolved"; exit 44; }
  bytes="$(du -s -B1 "$resolved" | awk '{print $1}')"
  echo "PRUNE|$bytes|$resolved"
done

[ "$current_retained" = true ] || { echo "REFUSE_CURRENT_NOT_IN_LATEST_THREE|$current_release"; exit 45; }

if [ "$apply" = true ]; then
  for index in "${"${!releases[@]}"}"; do
    [ "$index" -ge "$retention" ] || continue
    resolved="$(readlink -f -- "${"${releases[$index]}"}")"
    [ "$resolved" != "$current_release" ] || { echo "REFUSE_DELETE_CURRENT|$resolved"; exit 46; }
    find "$resolved" -depth -delete
    [ ! -e "$resolved" ] || { echo "DELETE_INCOMPLETE|$resolved"; exit 47; }
    echo "DELETED|$resolved"
  done
fi

remaining="$(find "$release_root" -mindepth 1 -maxdepth 1 -type d | wc -l)"
expected="${"${#releases[@]}"}"
if [ "$apply" = true ] && [ "$expected" -gt "$retention" ]; then
  expected="$retention"
fi
[ "$remaining" -eq "$expected" ] || { echo "RETENTION_COUNT_MISMATCH|$remaining|$expected"; exit 48; }
[ -d "$current_release" ] || { echo "CURRENT_RELEASE_MISSING|$current_release"; exit 49; }
echo "RESULT|$apply|$remaining|$current_release"
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
  target,
  remoteRoot,
  inventory: lines,
});
