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
      /if \(usePostgresRepository\(\)\) \{\s*await revokeSessionRecordPostgres\(sessionId, revokedAt\);/i.test(api),
  ],
  [
    "Auth postgres bootstrap cleanup avoids full rewrite on read",
    /if \(bootstrapped !== db\) \{\s*for \(const user of cleaned\.users\) \{\s*await upsertAuthUserPostgres\(user\);/i.test(api) &&
      /if \(cleaned\.sessions\.length !== bootstrapped\.sessions\.length\) \{\s*await pruneExpiredSessionsPostgres\(now\);/i.test(api),
  ],
  [
    "Resource routes use postgres-specific targeted writes",
      /sendT8\(response, await upsertResourceCategoryPostgres\(category, currentUser!\)\);/i.test(api) &&
      /await updateResourceCategoryPostgres\([\s\S]*?currentUser![\s\S]*?resourceRevisionFromPayload/i.test(api) &&
      /await deleteResourceCategoryPostgresWithItemRevision\(id, currentUser!, resourceRevisionFromPayload\(body\)\);/i.test(api) &&
      /await updateResourceItemPostgres\(id, patch, currentUser!, resourceRevisionFromPayload\(patch\)\)/i.test(api) &&
      /await deleteResourceItemPostgres\(id, currentUser!, resourceRevisionFromPayload\(body\)\);/i.test(api),
  ],
  [
    "Resource deletion removes only unreferenced owner-scoped output files",
    /async function deleteResourceItemPostgres[\s\S]*select id, kind, title, url, mime, size_bytes[\s\S]*from xh_assets where id = \$1 and owner_id = \$2/i.test(api) &&
      /async function deleteResourceItemPostgres[\s\S]*await client\.query\("begin"\)/i.test(api) &&
      /async function deleteResourceItemPostgres[\s\S]*metadata->>'fileUrl' = \$2[\s\S]*metadata->>'fileRel' = \$2[\s\S]*url = \$2/i.test(api) &&
      /async function removeResourcePhysicalFile[\s\S]*startsWith\("\/files\/output\/"\)[\s\S]*startsWith\("\/output\/"\)/i.test(api) &&
      /async function removeResourcePhysicalFile[\s\S]*filename\.includes\("\/"\)[\s\S]*filename\.includes\("\\\\"\)/i.test(api),
  ],
  [
    "Resource postgres upserts reject cross-owner conflicts",
    /async function writeResourceDb[\s\S]*RESOURCE_OWNERSHIP_MISMATCH/i.test(api) &&
      /async function upsertResourceCategoryPostgres[\s\S]*RESOURCE_OWNERSHIP_MISMATCH/i.test(api) &&
      /async function upsertResourceItemPostgres[\s\S]*RESOURCE_OWNERSHIP_MISMATCH/i.test(api),
  ],
  [
    "Provider and model admin routes avoid full admin-db rewrites on postgres hot paths",
    /insertProviderRecord: async \(provider\) => providerRepository\.insertProviderRecord/i.test(api) &&
      /updateProviderRecord: async \(providerId, transform\) => providerRepository\.updateProviderRecord/i.test(api) &&
      /deleteProviderRecord: providerRepository\.deleteProviderRecord/i.test(api) &&
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
    "Postgres runtime full-replace writes are unavailable",
    /async function writeAuthDb\(db: AuthDb\) \{\s*if \(usePostgresRepository\(\)\) \{\s*throw new Error\("writeAuthDb is unavailable in postgres mode/i.test(api) &&
      /async function writeAdminDb\(db: AdminDb\) \{\s*if \(usePostgresRepository\(\)\) \{\s*throw new Error\("writeAdminDb is unavailable in postgres mode/i.test(api),
  ],
  [
    "Direct postgres full-replace helpers are absent",
    !/function writeAuthDbPostgres|function writeAdminDbPostgres/i.test(api),
  ],
  [
    "Admin postgres cold bootstrap no longer uses destructive full replace",
    /await bootstrapDefaultAdminDbPostgres\(seeded\);/i.test(api) &&
      /async function bootstrapDefaultAdminDbPostgres\(db: AdminDb\)/i.test(api) &&
      /async function bootstrapDefaultAdminDbPostgres[\s\S]*on conflict \(id\) do nothing/i.test(api),
  ],
  [
    "Canvas and resource postgres reads honor one-time migration markers",
    /canvasPostgresMigrationMarkerPath/.test(api) &&
      /resourcePostgresMigrationMarkerPath/.test(api) &&
      /async function hasRepositoryMigrationMarker/.test(api) &&
      /await hasRepositoryMigrationMarker\(dirs\.canvasPostgresMigrationMarkerPath\)/.test(api) &&
      /await hasRepositoryMigrationMarker\(dirs\.resourcePostgresMigrationMarkerPath\)/.test(api),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
