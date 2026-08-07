import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureFileExists,
  firstArg,
  flagEnabled,
  helpRequested,
  parseArgs,
  printJson,
  requiredArg,
  runCommand,
  shellQuote,
  sshTarget,
} from "./_shared.mjs";
import { loadReleaseTargetProfile } from "./target-profile.mjs";

const args = parseArgs(process.argv.slice(2));
if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/migrate-production-data.mjs --source-profile=old-server --target-profile=new-server --env=production --source-ssh-key=<path> --target-ssh-key=<path> [--apply=true --confirm-replace=new-production]

Default mode is a read-only preflight. Apply requires both --apply=true and --confirm-replace=new-production.`);
  process.exit(0);
}

const environment = String(firstArg(args.env) || "production").trim();
const sourceProfile = String(firstArg(args["source-profile"]) || "old-server").trim();
const targetProfile = String(firstArg(args["target-profile"]) || "new-server").trim();
const source = await loadReleaseTargetProfile({ profile: sourceProfile, environment });
const target = await loadReleaseTargetProfile({ profile: targetProfile, environment });
if (environment !== "production") throw new Error("PRODUCTION_MIGRATION_REQUIRES_PRODUCTION_ENV");
if (sourceProfile === targetProfile) throw new Error("SOURCE_AND_TARGET_MUST_DIFFER");
const sourceKey = await ensureFileExists(requiredArg(args, "source-ssh-key"));
const targetKey = await ensureFileExists(requiredArg(args, "target-ssh-key"));
const apply = flagEnabled(args.apply);
const confirmation = String(firstArg(args["confirm-replace"]) || "").trim();
if (apply && confirmation !== "new-production") throw new Error("REPLACE_CONFIRMATION_REQUIRED:new-production");

const migrationId = `production-migration-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const sourceTarget = sshTarget(source.sshUser, source.host);
const targetTarget = sshTarget(target.sshUser, target.host);
const sourceEnv = shellQuote(source.sharedEnvFile);
const targetEnv = shellQuote(target.sharedEnvFile);
const sourceRoot = shellQuote(source.remoteRoot);
const targetRoot = shellQuote(target.remoteRoot);
const sourceDump = `/tmp/${migrationId}-source.dump`;
const sourceData = `/tmp/${migrationId}-data.tgz`;
const targetDump = `/tmp/${migrationId}-source.dump`;
const targetData = `/tmp/${migrationId}-data.tgz`;
const targetBackupRoot = `${target.remoteRoot}/shared/migration-backups/${migrationId}`;

async function ssh(key, profile, command, capture = true) {
  return runCommand("ssh", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-i", key, "-p", String(profile.port), sshTarget(profile.sshUser, profile.host), "bash", "-lc", shellQuote(command)], { inherit: !capture, capture });
}

async function scp(key, sourcePath, profile, targetPath) {
  return runCommand("scp", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-i", key, "-P", String(profile.port), sourcePath, `${sshTarget(profile.sshUser, profile.host)}:${targetPath}`], { inherit: false, capture: true });
}

const sourceProbe = await ssh(sourceKey, source, `set -e; printf 'db=${source.expectedDatabaseName}'; printf '\nrelease='; readlink -f ${sourceRoot}/current; printf '\napp='; systemctl is-active ${shellQuote(source.serviceName)}; printf '\nworker='; systemctl is-active ${shellQuote(source.workerServiceName)}; printf '\ndata='; if [ -d ${sourceRoot}/shared/data ]; then du -sh ${sourceRoot}/shared/data | awk '{print $1}'; else printf 'missing'; fi; printf '\npublic_assets='; find ${sourceRoot}/shared/data/admin/shared-assets -maxdepth 1 -type f 2>/dev/null | wc -l`);
const targetProbe = await ssh(targetKey, target, `set -e; printf 'db=${target.expectedDatabaseName}'; printf '\nrelease='; readlink -f ${targetRoot}/current; printf '\napp='; systemctl is-active ${shellQuote(target.serviceName)}; printf '\nworker='; systemctl is-active ${shellQuote(target.workerServiceName)}; printf '\ndata='; if [ -d ${targetRoot}/shared/data ]; then du -sh ${targetRoot}/shared/data | awk '{print $1}'; else printf 'missing'; fi; printf '\npublic_assets='; find ${targetRoot}/shared/data/admin/shared-assets -maxdepth 1 -type f 2>/dev/null | wc -l`);

if (!apply) {
  printJson({ ok: true, mode: "preflight", migrationId, environment, sourceProfile, targetProfile, sourceProbe: sourceProbe.stdout.trim(), targetProbe: targetProbe.stdout.trim(), targetBackupRoot });
  process.exit(0);
}

const localRoot = await mkdtemp(join(tmpdir(), "xinghuan-production-migration-"));
const localDump = join(localRoot, `${migrationId}.dump`);
const localData = join(localRoot, `${migrationId}.data.tgz`);
try {
  await ssh(targetKey, target, `set -e; mkdir -p ${shellQuote(targetBackupRoot)}; . ${targetEnv} >/dev/null 2>&1; pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > ${shellQuote(`${targetBackupRoot}/target-before.dump`)}; if [ -d ${targetRoot}/shared/data ]; then tar -czf ${shellQuote(`${targetBackupRoot}/target-before-data.tgz`)} -C ${targetRoot}/shared data; fi;`);
  await ssh(sourceKey, source, `set -e; . ${sourceEnv} >/dev/null 2>&1; cd ${sourceRoot}/current; node apps/api/dist/cli/shared-resource-assets.js --data-dir=${sourceRoot}/shared/data --apply=true --expect-ready=true; pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > ${shellQuote(sourceDump)}; if [ -d ${sourceRoot}/shared/data ]; then tar --exclude='data/users/*/output' --exclude='data/users/*/output-archives' -czf ${shellQuote(sourceData)} -C ${sourceRoot}/shared data; else : > ${shellQuote(sourceData)}; fi;`);
  await runCommand("scp", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-i", sourceKey, "-P", String(source.port), `${sourceTarget}:${sourceDump}`, localDump], { inherit: false, capture: true });
  await runCommand("scp", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-i", sourceKey, "-P", String(source.port), `${sourceTarget}:${sourceData}`, localData], { inherit: false, capture: true });
  await scp(targetKey, localDump, target, targetDump);
  await scp(targetKey, localData, target, targetData);
  await ssh(targetKey, target, `set -e; sudo systemctl stop ${shellQuote(target.workerServiceName)} ${shellQuote(target.serviceName)}; . ${targetEnv} >/dev/null 2>&1; pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" ${shellQuote(targetDump)}; if [ -s ${shellQuote(targetData)} ]; then mv ${targetRoot}/shared/data ${shellQuote(`${targetBackupRoot}/target-before-data-live`)} 2>/dev/null || true; mkdir -p ${targetRoot}/shared; tar -xzf ${shellQuote(targetData)} -C ${targetRoot}/shared; fi; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into xh_system_settings (id, task_queue_settings, revision, updated_at) values ('default', jsonb_build_object('materialLifecycle', jsonb_build_object('outputRetentionDays', 15)), 1, now()) on conflict (id) do update set task_queue_settings = jsonb_set(coalesce(xh_system_settings.task_queue_settings, '{}'::jsonb), '{materialLifecycle,outputRetentionDays}', '15'::jsonb, true), revision = xh_system_settings.revision + 1, updated_at = now();"; cd ${targetRoot}/current; node apps/api/dist/cli/shared-resource-assets.js --data-dir=${targetRoot}/shared/data --expect-ready=true; sudo systemctl start ${shellQuote(target.serviceName)} ${shellQuote(target.workerServiceName)}; sleep 3; curl -fsS ${shellQuote(target.internalStatusUrl)}; . ${targetEnv} >/dev/null 2>&1; node apps/api/dist/cli/permission-readiness.js --expect-ready=true; rm -f ${shellQuote(targetDump)} ${shellQuote(targetData)}`);
  await ssh(sourceKey, source, `rm -f ${shellQuote(sourceDump)} ${shellQuote(sourceData)}`);
  printJson({ ok: true, mode: "apply", migrationId, sourceProfile, targetProfile, targetBackupRoot, sourceProbe: sourceProbe.stdout.trim(), targetProbe: targetProbe.stdout.trim() });
} finally {
  await unlink(localDump).catch(() => undefined);
  await unlink(localData).catch(() => undefined);
  await rmdir(localRoot).catch(() => undefined);
}
