import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { materializeTaskOutputs } from "../apps/worker/src/output-materials.js";

const png1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "xinghuan-worker-output-"));
  const storage = storageContext();
  const ownerId = await resolveVerifyOwnerId(storage);
  const task = {
    id: `task-${Date.now()}`,
    ownerId,
    title: "Worker 输出素材落库验证",
    providerId: "provider-test",
    providerName: "Provider Test",
    modelRecordId: "model-record-test",
    providerModelId: "model-test",
    modelDisplayName: "Model Test",
    payload: {
      sourceNodeId: "node-output-test",
      sourceCanvasId: "canvas-output-test",
    },
  };
  const result = {
    imageUrls: [png1x1],
  };

  const materialized = await materializeTaskOutputs({
    dataDir,
    task,
    result,
  });
  const duplicated = await materializeTaskOutputs({
    dataDir,
    task,
    result,
  });

  assert(materialized.resourceItems.length === 1, "resource item count mismatch");
  assert(materialized.resourceItems[0]?.fileUrl?.startsWith("/files/output/"), "resource fileUrl was not materialized");
  assert(materialized.resourceItems[0]?.taskId === task.id, "resource taskId mismatch");
  assert(materialized.resourceItems[0]?.sourceNodeId === task.payload.sourceNodeId, "resource sourceNodeId mismatch");
  assert(materialized.resourceItems[0]?.sourceCanvasId === task.payload.sourceCanvasId, "resource sourceCanvasId mismatch");
  assert(duplicated.resourceItems.length === 1, "duplicate materialization did not return single resource item");

  const outputPath = join(dataDir, "users", task.ownerId, materialized.resourceItems[0].fileUrl.replace(/^\/files\//, ""));
  await readFile(outputPath);

  if (storage.driver === "postgres") {
    await assertPostgresResource(storage.databaseUrl, task.ownerId, task.id, duplicated.resourceItems[0].id);
  } else {
    const resourceDbPath = join(dataDir, "users", task.ownerId, "resources", "resource-library.json");
    const db = JSON.parse(await readFile(resourceDbPath, "utf-8"));
    assert(Array.isArray(db.items) && db.items.length === 1, "resource db dedupe failed");
    assert(db.items[0]?.id === duplicated.resourceItems[0]?.id, "resource db item id mismatch");
  }

  console.log(JSON.stringify({
    ok: true,
    dataDir,
    storageDriver: storage.driver,
    ownerId: task.ownerId,
    resourceItemId: materialized.resourceItems[0].id,
    fileUrl: materialized.resourceItems[0].fileUrl,
    outputPath,
  }, null, 2));
}

function storageContext() {
  const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
  const driver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" && databaseUrl ? "postgres" : "file";
  return { driver, databaseUrl };
}

async function resolveVerifyOwnerId(storage: ReturnType<typeof storageContext>) {
  if (storage.driver !== "postgres") return "usr-test";

  const pool = await createPool(storage.databaseUrl);
  try {
    const preferredEmail = String(process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "").trim();
    if (preferredEmail) {
      const preferred = await pool.query(
        "select id from xh_users where email = $1 and coalesce(disabled, false) = false limit 1",
        [preferredEmail],
      );
      const id = String(preferred.rows[0]?.id || "").trim();
      if (id) return id;
    }

    const fallback = await pool.query(
      "select id from xh_users where coalesce(disabled, false) = false order by created_at asc limit 1",
    );
    const id = String(fallback.rows[0]?.id || "").trim();
    if (!id) throw new Error("POSTGRES_VERIFY_USER_NOT_FOUND");
    return id;
  } finally {
    await pool.end();
  }
}

async function assertPostgresResource(databaseUrl: string, ownerId: string, taskId: string, expectedId: string) {
  const pool = await createPool(databaseUrl);
  try {
    const result = await pool.query(
      "select id from xh_assets where owner_id = $1 and metadata ->> 'taskId' = $2 order by created_at desc",
      [ownerId, taskId],
    );
    assert(result.rows.length === 1, "postgres resource db dedupe failed");
    assert(String(result.rows[0]?.id || "") === expectedId, "postgres resource db item id mismatch");
  } finally {
    await pool.end();
  }
}

async function createPool(databaseUrl: string) {
  const pg = await import("pg");
  const { Pool } = pg.default || pg;
  return new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3000,
    max: 1,
  });
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
