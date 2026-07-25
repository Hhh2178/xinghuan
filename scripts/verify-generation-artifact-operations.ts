import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { migrateGenerationLibraryArtifacts } from "./migrate-generation-library-artifacts.mjs";
import { reconcileGenerationArtifacts } from "./reconcile-generation-artifacts.mjs";

async function main() {
  const migration = await verifyMigration();
  const reconciliation = await verifyReconciliation();
  const postgresAssetProtection = await verifyPostgresAssetProtection();
  console.log(JSON.stringify({ ok: true, migration, reconciliation, postgresAssetProtection }, null, 2));
}

async function verifyMigration() {
  const dataDir = await mkdtemp(join(tmpdir(), "generation-artifact-migration-"));
  const validPath = join(dataDir, "users", "owner-valid", "resources", "generation-library.json");
  const corruptPath = join(dataDir, "users", "owner-corrupt", "resources", "generation-library.json");
  await mkdir(dirname(validPath), { recursive: true });
  await mkdir(dirname(corruptPath), { recursive: true });
  await writeFile(validPath, JSON.stringify({ items: [{
    id: "legacy-one",
    kind: "image",
    title: "Legacy",
    fileUrl: "/files/output/legacy.png",
    createdAt: 1_000,
    expiresAt: 999_999_999_999,
  }] }), "utf8");
  await writeFile(corruptPath, "{broken", "utf8");

  const writes: unknown[][] = [];
  const pool = {
    async query(sql: string, values: unknown[] = []) {
      if (sql.startsWith("select id from xh_users")) return { rows: [{ id: values[0] }] };
      if (sql.startsWith("insert into xh_generation_artifacts")) writes.push(values);
      return { rows: [] };
    },
  };
  const dryRun = await migrateGenerationLibraryArtifacts({ dataDir, databaseUrl: "test", apply: false, pool });
  assert(dryRun.validItems === 1, "migration dry-run did not find valid legacy item");
  assert(dryRun.corruptFiles.length === 1, "migration did not report corrupt JSON");
  assert(writes.length === 0, "migration dry-run wrote database rows");

  const applied = await migrateGenerationLibraryArtifacts({ dataDir, databaseUrl: "test", apply: true, pool });
  assert(applied.insertedOrUpdated === 1 && writes.length === 1, "migration apply did not upsert valid item");
  assert(await readFile(corruptPath, "utf8") === "{broken", "migration overwrote corrupt JSON");
  return { validItems: applied.validItems, corruptFiles: applied.corruptFiles.length, writes: writes.length };
}

async function verifyReconciliation() {
  const dataDir = await mkdtemp(join(tmpdir(), "generation-artifact-reconcile-"));
  const ownerId = "owner-a";
  const outputDir = join(dataDir, "users", ownerId, "output");
  const inputDir = join(dataDir, "users", ownerId, "input");
  const dbPath = join(dataDir, "users", ownerId, "resources", "generation-library.json");
  const uploadManifestPath = join(dataDir, "users", ownerId, "resources", "ephemeral-uploads.json");
  await mkdir(outputDir, { recursive: true });
  await mkdir(inputDir, { recursive: true });
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(join(outputDir, "expired.png"), "expired", "utf8");
  await writeFile(join(outputDir, "promoted.png"), "promoted", "utf8");
  await writeFile(join(outputDir, "retry.png"), "retry", "utf8");
  await writeFile(join(outputDir, "deleted.png"), "deleted", "utf8");
  await writeFile(join(outputDir, "orphan.png"), "orphan", "utf8");
  await writeFile(join(inputDir, "expired-input.png"), "expired input", "utf8");
  await writeFile(join(inputDir, "recent-input.png"), "recent input", "utf8");
  await writeFile(uploadManifestPath, JSON.stringify({ items: [
    { id: "upload-expired", ownerId, kind: "image", storageKey: "expired-input.png", fileUrl: "/files/input/expired-input.png", status: "active", createdAt: 1_000, updatedAt: 1_000, expiresAt: 1_000 },
  ] }), "utf8");
  await writeFile(dbPath, JSON.stringify({ items: [
    artifact("expired", "expired.png", 1_000),
    { ...artifact("promoted", "promoted.png", 1_000), status: "promoted", promotedAssetId: "asset-promoted" },
    { ...artifact("retry", "retry.png", 1_000), status: "expired" },
    { ...artifact("deleted", "deleted.png", 9_999_999), status: "deleted" },
    artifact("missing", "missing.png", 9_999_999),
  ] }, null, 2), "utf8");

  const before = await readFile(dbPath, "utf8");
  const dryRun = await reconcileGenerationArtifacts({ dataDir, storageDriver: "file", now: 5_000, apply: false });
  assert(dryRun.candidates.length === 6, "reconciliation dry-run candidate count mismatch");
  assert(dryRun.orphanFiles.includes("/files/output/orphan.png"), "reconciliation did not report orphan output");
  assert(dryRun.candidates.some((candidate: any) => candidate.fileUrl === "/files/input/expired-input.png"), "reconciliation did not find expired input upload");
  assert(await readFile(dbPath, "utf8") === before, "reconciliation dry-run mutated metadata");
  assert(await exists(join(outputDir, "expired.png")), "reconciliation dry-run deleted file");

  const applied = await reconcileGenerationArtifacts({ dataDir, storageDriver: "file", now: 5_000, apply: true });
  const after = JSON.parse(await readFile(dbPath, "utf8"));
  assert(after.items.find((item: any) => item.id === "expired")?.status === "expired", "expired state not applied");
  assert(after.items.find((item: any) => item.id === "promoted")?.status === "expired", "promoted expiry state not applied");
  assert(after.items.find((item: any) => item.id === "missing")?.status === "missing", "missing state not applied");
  assert(!(await exists(join(outputDir, "expired.png"))), "unpromoted expired file was not deleted");
  assert(!(await exists(join(outputDir, "retry.png"))), "previously expired file deletion was not retried");
  assert(!(await exists(join(outputDir, "deleted.png"))), "deleted artifact file deletion was not retried");
  assert(await exists(join(outputDir, "promoted.png")), "promoted file was deleted");
  assert(await exists(join(outputDir, "orphan.png")), "orphan report deleted an unregistered output");
  assert(!(await exists(join(inputDir, "expired-input.png"))), "expired input upload was not deleted");
  assert(await exists(join(inputDir, "recent-input.png")), "recent input orphan was deleted before grace period");
  return { candidates: applied.candidates.length, updated: applied.updatedIds.length, deletedFiles: applied.deletedFiles.length, orphanFiles: applied.orphanFiles.length };
}

async function verifyPostgresAssetProtection() {
  const dataDir = await mkdtemp(join(tmpdir(), "generation-artifact-postgres-protection-"));
  const ownerId = "owner-protected";
  const outputDir = join(dataDir, "users", ownerId, "output");
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "shared.png"), "protected", "utf8");

  let writes = 0;
  const pool = {
    async query(sql: string) {
      if (sql.includes("from xh_generation_artifacts")) {
        return { rows: [{
          id: "artifact-protected",
          owner_id: ownerId,
          status: "deleted",
          file_url: "/files/output/shared.png",
          storage_key: "shared.png",
          promoted_asset_id: null,
          expires_at: new Date(1_000),
          created_at: new Date(1_000),
        }] };
      }
      if (sql.includes("from xh_assets")) return { rows: [{ count: 1 }] };
      if (sql.startsWith("update xh_generation_artifacts")) writes += 1;
      return { rows: [] };
    },
  };

  const dryRun = await reconcileGenerationArtifacts({ dataDir, storageDriver: "postgres", databaseUrl: "test", now: 5_000, apply: false, pool });
  const applied = await reconcileGenerationArtifacts({ dataDir, storageDriver: "postgres", databaseUrl: "test", now: 5_000, apply: true, pool });
  assert(dryRun.candidates.length === 0 && applied.candidates.length === 0, "asset-protected binary remained a deletion candidate");
  assert(dryRun.protectedFiles.includes("/files/output/shared.png"), "asset-protected binary was not reported");
  assert(writes === 0, "asset-protected reconciliation wrote artifact metadata");
  assert(await exists(join(outputDir, "shared.png")), "asset-protected reconciliation deleted the binary");
  return { protectedFiles: applied.protectedFiles.length, writes };
}

function artifact(id: string, storageKey: string, expiresAt: number) {
  return {
    id,
    kind: "image",
    status: "active",
    title: id,
    storageKey,
    url: `/files/output/${storageKey}`,
    fileUrl: `/files/output/${storageKey}`,
    createdAt: 1_000,
    updatedAt: 1_000,
    expiresAt,
  };
}

async function exists(path: string) {
  return stat(path).then((info) => info.isFile()).catch(() => false);
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
