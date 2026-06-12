import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { materializeTaskOutputs } from "../apps/worker/src/output-materials.js";

const png1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";
const videoBytes = Buffer.from("00000018667479706d703432000000006d703432", "hex");
const wav1x1 =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

async function main() {
  const mediaServer = await startMockMediaServer();
  const image = await verifyMaterialization({
    title: "Worker 图像输出素材落库验证",
    result: { imageUrls: [png1x1] },
    expectedKind: "image",
  });
  const video = await verifyMaterialization({
    title: "Worker 视频输出素材落库验证",
    result: { videoUrls: [`${mediaServer.origin}/demo.mp4`] },
    expectedKind: "video",
  });
  const audio = await verifyMaterialization({
    title: "Worker 音频输出素材落库验证",
    result: { audioUrls: [wav1x1] },
    expectedKind: "audio",
  });

  mediaServer.server.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        image,
        video,
        audio,
      },
      null,
      2,
    ),
  );
}

async function verifyMaterialization({
  title,
  result,
  expectedKind,
}: {
  title: string;
  result: Record<string, unknown>;
  expectedKind: "image" | "video" | "audio";
}) {
  const dataDir = await mkdtemp(join(tmpdir(), "xinghuan-worker-output-"));
  const storage = storageContext();
  const ownerId = await resolveVerifyOwnerId(storage);
  const task = {
    id: `task-${Date.now()}-${expectedKind}`,
    ownerId,
    title,
    providerId: "provider-test",
    providerName: "Provider Test",
    modelRecordId: "model-record-test",
    providerModelId: "model-test",
    modelDisplayName: "Model Test",
    payload: {
      sourceNodeId: `node-output-test-${expectedKind}`,
      sourceCanvasId: `canvas-output-test-${expectedKind}`,
    },
  };

  const materialized = await materializeTaskOutputs({ dataDir, task, result });
  const duplicated = await materializeTaskOutputs({ dataDir, task, result });

  assert(materialized.resourceItems.length === 1, `${expectedKind} resource item count mismatch`);
  assert(materialized.resourceItems[0]?.kind === expectedKind, `${expectedKind} resource kind mismatch`);
  assert(materialized.resourceItems[0]?.taskId === task.id, `${expectedKind} resource taskId mismatch`);
  assert(materialized.resourceItems[0]?.sourceNodeId === task.payload.sourceNodeId, `${expectedKind} resource sourceNodeId mismatch`);
  assert(materialized.resourceItems[0]?.sourceCanvasId === task.payload.sourceCanvasId, `${expectedKind} resource sourceCanvasId mismatch`);
  assert(duplicated.resourceItems.length === 1, `${expectedKind} duplicate materialization did not return single resource item`);

  if (expectedKind === "image") {
    assert(materialized.resourceItems[0]?.fileUrl?.startsWith("/files/output/"), "image resource fileUrl was not materialized");
    const outputPath = join(dataDir, "users", task.ownerId, materialized.resourceItems[0].fileUrl.replace(/^\/files\//, ""));
    await readFile(outputPath);
  } else if (expectedKind === "video") {
    assert(materialized.resourceItems[0]?.fileUrl?.startsWith("/files/output/"), "video resource fileUrl was not materialized");
    assert(/^https?:\/\//i.test(materialized.resourceItems[0]?.url || ""), "video resource url mismatch");
    assert(materialized.resourceItems[0]?.sourceUrl === materialized.resourceItems[0]?.url, "video resource sourceUrl mismatch");
    const outputPath = join(dataDir, "users", task.ownerId, materialized.resourceItems[0].fileUrl.replace(/^\/files\//, ""));
    await readFile(outputPath);
  } else {
    assert(materialized.resourceItems[0]?.fileUrl?.startsWith("/files/output/"), "audio resource fileUrl was not materialized");
    assert(/^data:audio\//i.test(materialized.resourceItems[0]?.url || ""), "audio resource url mismatch");
    assert(materialized.resourceItems[0]?.sourceUrl === materialized.resourceItems[0]?.url, "audio resource sourceUrl mismatch");
    const outputPath = join(dataDir, "users", task.ownerId, materialized.resourceItems[0].fileUrl.replace(/^\/files\//, ""));
    await readFile(outputPath);
  }

  if (storage.driver === "postgres") {
    await assertPostgresResource(storage.databaseUrl, task.ownerId, task.id, duplicated.resourceItems[0].id);
  } else {
    const resourceDbPath = join(dataDir, "users", task.ownerId, "resources", "resource-library.json");
    const db = JSON.parse(await readFile(resourceDbPath, "utf-8"));
    assert(Array.isArray(db.items) && db.items.length === 1, `${expectedKind} resource db dedupe failed`);
    assert(db.items[0]?.id === duplicated.resourceItems[0]?.id, `${expectedKind} resource db item id mismatch`);
  }

  return {
    dataDir,
    storageDriver: storage.driver,
    ownerId: task.ownerId,
    resourceItemId: materialized.resourceItems[0].id,
    kind: materialized.resourceItems[0].kind,
  };
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

async function startMockMediaServer() {
  return await new Promise<{ server: import("node:http").Server; origin: string }>((resolve) => {
    const server = createServer((request, response) => {
      if (request.url === "/demo.mp4") {
        response.writeHead(200, { "content-type": "video/mp4" });
        response.end(videoBytes);
        return;
      }
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("MOCK_MEDIA_SERVER_START_FAILED");
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
