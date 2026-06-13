import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");

const checks = [
  [
    "Canvas write rejects owner transfer",
    /async function writeCanvasData[\s\S]*CANVAS_OWNERSHIP_MISMATCH/i.test(api) &&
      !/async function writeCanvasData[\s\S]*set owner_id = excluded\.owner_id/i.test(api),
  ],
  [
    "Canvas create path uses direct postgres write",
    /if \(usePostgresRepository\(\)\) \{\s*await writeCanvasData\(id, emptyCanvasData\(\), currentUser!, \{ name: item\.name, createdAt: now \}\);/i.test(
      api,
    ),
  ],
  [
    "Canvas rename and delete use postgres-specific ownership helpers",
    /renameCanvasRecord\(id, safeText\(body\.name, "未命名画布"\), currentUser!\)/.test(api) &&
      /await deleteCanvasRecord\(id, currentUser!\);/.test(api),
  ],
  [
    "Auth login/logout use targeted postgres session writes",
    /if \(usePostgresRepository\(\)\) \{\s*await createSessionRecordPostgres\(session\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await deleteSessionRecordPostgres\(sessionId\);/i.test(api),
  ],
  [
    "Auth postgres bootstrap cleanup avoids full rewrite on read",
    /if \(bootstrapped !== db\) \{\s*for \(const user of cleaned\.users\) \{\s*await upsertAuthUserPostgres\(user\);/i.test(api) &&
      /if \(cleaned\.sessions\.length !== bootstrapped\.sessions\.length\) \{\s*await pruneExpiredSessionsPostgres\(now\);/i.test(api),
  ],
  [
    "Resource routes use postgres-specific targeted writes",
    /sendT8\(response, await upsertResourceCategoryPostgres\(category, currentUser!\)\);/i.test(api) &&
      /sendT8\(response, await updateResourceCategoryPostgres\(id, safeText\(body\.name, "未分类"\), currentUser!\)\);/i.test(api) &&
      /await deleteResourceCategoryPostgres\(id, currentUser!\);/i.test(api) &&
      /sendT8\(response, await updateResourceItemPostgres\(id, patch, currentUser!\)\);/i.test(api) &&
      /await deleteResourceItemPostgres\(id, currentUser!\);/i.test(api),
  ],
  [
    "Resource postgres upserts reject cross-owner conflicts",
    /async function writeResourceDb[\s\S]*RESOURCE_OWNERSHIP_MISMATCH/i.test(api) &&
      /async function upsertResourceCategoryPostgres[\s\S]*RESOURCE_OWNERSHIP_MISMATCH/i.test(api) &&
      /async function upsertResourceItemPostgres[\s\S]*RESOURCE_OWNERSHIP_MISMATCH/i.test(api),
  ],
  [
    "Provider and model admin routes avoid full admin-db rewrites on postgres hot paths",
    /if \(usePostgresRepository\(\)\) \{\s*await insertProviderRecordPostgres\(provider\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await upsertProviderRecordPostgres\(updated\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await deleteProviderRecordPostgres\(id\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await insertModelRecordPostgres\(normalizedModel\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await upsertModelRecordPostgres\(updatedModel\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await upsertModelRecordPostgres\(updated\);/i.test(api) &&
      /if \(usePostgresRepository\(\)\) \{\s*await deleteModelRecordPostgres\(id\);/i.test(api),
  ],
  [
    "Provider model import uses targeted postgres upserts",
    /if \(usePostgresRepository\(\)\) \{\s*for \(const model of touchedModels\) \{\s*await upsertModelRecordPostgres\(model\);/i.test(api),
  ],
  [
    "Postgres full-replace valves are explicitly disabled by default",
    /async function writeAuthDb\(db: AuthDb, options\?: \{ allowPostgresFullReplace\?: boolean; reason\?: string \}\) \{\s*if \(usePostgresRepository\(\)\) \{\s*if \(!options\?\.allowPostgresFullReplace\)/i.test(api) &&
      /async function writeAdminDb\(db: AdminDb, options\?: \{ allowPostgresFullReplace\?: boolean; reason\?: string \}\) \{\s*if \(usePostgresRepository\(\)\) \{\s*if \(!options\?\.allowPostgresFullReplace\)/i.test(api),
  ],
  [
    "Direct postgres full-replace helpers also require explicit allow flags",
    /async function writeAuthDbPostgres\(db: AuthDb, options\?: \{ allowFullReplace\?: boolean; reason\?: string \}\) \{\s*if \(!options\?\.allowFullReplace\)/i.test(api) &&
      /async function writeAdminDbPostgres\(db: AdminDb, options\?: \{ allowFullReplace\?: boolean; reason\?: string \}\) \{\s*if \(!options\?\.allowFullReplace\)/i.test(api),
  ],
  [
    "Admin postgres cold bootstrap no longer uses destructive full replace",
    /await bootstrapDefaultAdminDbPostgres\(seeded\);/i.test(api) &&
      /async function bootstrapDefaultAdminDbPostgres\(db: AdminDb\)/i.test(api) &&
      /async function bootstrapDefaultAdminDbPostgres[\s\S]*on conflict \(id\) do nothing/i.test(api),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
