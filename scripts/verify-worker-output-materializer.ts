import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  attachOutputFetchContext,
  materializeTaskOutputs,
} from "../apps/worker/src/output-materials.js";

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
  const privateVideoResult = attachOutputFetchContext(
    { videoUrls: [`${mediaServer.origin}/private.mp4`] },
    {
      origin: mediaServer.origin,
      headers: { authorization: "Bearer private-video-key" },
    },
  );
  assert(!JSON.stringify(privateVideoResult).includes("private-video-key"), "output fetch credentials leaked into JSON");
  const privateVideo = await verifyMaterialization({
    title: "Worker 鉴权视频输出素材落库验证",
    result: privateVideoResult,
    expectedKind: "video",
  });
  const audio = await verifyMaterialization({
    title: "Worker 音频输出素材落库验证",
    result: { audioUrls: [wav1x1] },
    expectedKind: "audio",
  });
  const mixedRetry = await verifyMixedMediaRetryIdentity(mediaServer.origin);

  mediaServer.server.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        image,
        video,
        privateVideo,
        audio,
        mixedRetry,
      },
      null,
      2,
    ),
  );
}

async function verifyMixedMediaRetryIdentity(origin: string) {
  if (storageContext().driver === "postgres") return { skipped: "covered by file adapter without creating production task rows" };
  const dataDir = await mkdtemp(join(tmpdir(), "xinghuan-worker-mixed-retry-"));
  const task = {
    id: "task-mixed-retry",
    ownerId: "usr-mixed-retry",
    title: "Mixed retry",
    providerId: "provider-test",
    providerName: "Provider Test",
    modelRecordId: "model-record-test",
    providerModelId: "model-test",
    modelDisplayName: "Model Test",
    payload: {},
  };
  const first = await materializeTaskOutputs({ dataDir, task, result: { imageUrls: [png1x1], videoUrls: [`${origin}/demo.mp4`] } });
  const second = await materializeTaskOutputs({ dataDir, task, result: { videoUrls: [`${origin}/demo.mp4`] } });
  const firstVideo = first.artifacts.find((item) => item.kind === "video");
  const secondVideo = second.artifacts.find((item) => item.kind === "video");
  assert(firstVideo?.id === secondVideo?.id, "mixed-media retry changed the stable video artifact ID");
  assert(second.resultPatch.generationArtifactIds[0] === secondVideo?.id, "task result references a non-canonical artifact ID");
  return { videoArtifactId: secondVideo?.id };
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

  assert(materialized.artifacts.length === 1, `${expectedKind} artifact count mismatch`);
  assert(materialized.artifacts[0]?.kind === expectedKind, `${expectedKind} artifact kind mismatch`);
  assert(materialized.artifacts[0]?.taskId === task.id, `${expectedKind} artifact taskId mismatch`);
  assert(materialized.artifacts[0]?.sourceNodeId === task.payload.sourceNodeId, `${expectedKind} artifact sourceNodeId mismatch`);
  assert(materialized.artifacts[0]?.sourceCanvasId === task.payload.sourceCanvasId, `${expectedKind} artifact sourceCanvasId mismatch`);
  assert(duplicated.artifacts.length === 1, `${expectedKind} duplicate materialization did not return single artifact`);

  if (expectedKind === "image") {
    assert(materialized.artifacts[0]?.fileUrl?.startsWith("/files/output/"), "image artifact fileUrl was not materialized");
    const outputPath = join(dataDir, "users", task.ownerId, materialized.artifacts[0].fileUrl.replace(/^\/files\//, ""));
    await readFile(outputPath);
  } else if (expectedKind === "video") {
    assert(materialized.artifacts[0]?.fileUrl?.startsWith("/files/output/"), "video artifact fileUrl was not materialized");
    assert(/^https?:\/\//i.test(materialized.artifacts[0]?.url || ""), "video artifact url mismatch");
    assert(materialized.artifacts[0]?.sourceUrl === materialized.artifacts[0]?.url, "video artifact sourceUrl mismatch");
    const outputPath = join(dataDir, "users", task.ownerId, materialized.artifacts[0].fileUrl.replace(/^\/files\//, ""));
    await readFile(outputPath);
  } else {
    assert(materialized.artifacts[0]?.fileUrl?.startsWith("/files/output/"), "audio artifact fileUrl was not materialized");
    assert(/^data:audio\//i.test(materialized.artifacts[0]?.url || ""), "audio artifact url mismatch");
    assert(materialized.artifacts[0]?.sourceUrl === materialized.artifacts[0]?.url, "audio artifact sourceUrl mismatch");
    const outputPath = join(dataDir, "users", task.ownerId, materialized.artifacts[0].fileUrl.replace(/^\/files\//, ""));
    await readFile(outputPath);
  }

  if (storage.driver === "postgres") {
    await assertPostgresArtifact(storage.databaseUrl, task.ownerId, task.id, duplicated.artifacts[0].id);
  } else {
    const generationDbPath = join(dataDir, "users", task.ownerId, "resources", "generation-library.json");
    const db = JSON.parse(await readFile(generationDbPath, "utf-8"));
    assert(Array.isArray(db.items) && db.items.length === 1, `${expectedKind} generation db dedupe failed`);
    assert(db.items[0]?.id === duplicated.artifacts[0]?.id, `${expectedKind} generation db item id mismatch`);
  }

  return {
    dataDir,
    storageDriver: storage.driver,
    ownerId: task.ownerId,
    generationArtifactId: materialized.artifacts[0].id,
    kind: materialized.artifacts[0].kind,
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

async function assertPostgresArtifact(databaseUrl: string, ownerId: string, taskId: string, expectedId: string) {
  const pool = await createPool(databaseUrl);
  try {
    const result = await pool.query(
      "select id from xh_generation_artifacts where owner_id = $1 and source_task_id = $2 order by created_at desc",
      [ownerId, taskId],
    );
    assert(result.rows.length === 1, "postgres generation artifact dedupe failed");
    assert(String(result.rows[0]?.id || "") === expectedId, "postgres generation artifact id mismatch");
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
      if (request.url === "/private.mp4") {
        if (request.headers.authorization !== "Bearer private-video-key") {
          response.writeHead(401, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
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
