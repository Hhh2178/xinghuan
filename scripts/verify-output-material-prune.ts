import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  process.env.XINGHUAN_STORAGE_DRIVER = "file";
  delete process.env.XINGHUAN_DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { pruneOldOutputMaterials } = await import("./prune-old-output-materials.mjs");

  const now = Date.UTC(2026, 5, 6, 12, 0, 0);
  const dataDir = await mkdtemp(join(tmpdir(), "xinghuan-output-prune-"));
  const userDir = join(dataDir, "users", "usr-prune");
  const outputDir = join(userDir, "output");
  const resourceDir = join(userDir, "resources");
  await writeFile(join(outputDir, ".keep"), "", "utf-8").catch(() => undefined);
  await ensureDir(outputDir);
  await ensureDir(resourceDir);
  await ensureDir(join(dataDir, "admin"));
  await writeFile(
    join(dataDir, "admin", "admin.json"),
    JSON.stringify({ taskQueueSettings: { materialLifecycle: { outputRetentionDays: 15 } } }),
    "utf-8",
  );

  const oldExpiredFile = "old-expired.png";
  const oldFavoritedFile = "old-favorited.png";
  const oldManualFile = "old-manual.png";
  const oldCategorizedFile = "old-categorized.png";
  const recentFile = "recent.png";
  const sharedFile = "shared.png";

  await writeFile(join(outputDir, oldExpiredFile), "expired", "utf-8");
  await writeFile(join(outputDir, oldFavoritedFile), "favorited", "utf-8");
  await writeFile(join(outputDir, oldManualFile), "manual", "utf-8");
  await writeFile(join(outputDir, oldCategorizedFile), "categorized", "utf-8");
  await writeFile(join(outputDir, recentFile), "recent", "utf-8");
  await writeFile(join(outputDir, sharedFile), "shared", "utf-8");

  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const oldTime = now - fourteenDaysMs - 60_000;
  const recentTime = now - 2 * 24 * 60 * 60 * 1000;

  const resourceDbPath = join(resourceDir, "resource-library.json");
  await writeFile(
    resourceDbPath,
    JSON.stringify(
      {
        categories: [{ id: "cat-keep", kind: "image", name: "保留分类", createdAt: oldTime, updatedAt: oldTime }],
        items: [
          item("res-expired", oldExpiredFile, oldTime, { tags: ["task-output"], taskId: "task-expired" }),
          item("res-favorited", oldFavoritedFile, oldTime, { tags: ["task-output"], favorite: true, taskId: "task-favorited" }),
          item("res-manual", oldManualFile, oldTime, { tags: ["manual-upload"] }),
          item("res-categorized", oldCategorizedFile, oldTime, {
            tags: ["task-output"],
            categoryId: "cat-keep",
            taskId: "task-categorized",
          }),
          item("res-recent", recentFile, recentTime, { tags: ["task-output"], taskId: "task-recent" }),
          item("res-shared-expired", sharedFile, oldTime, { tags: ["task-output"], taskId: "task-shared-expired" }),
          item("res-shared-keep", sharedFile, recentTime, { tags: ["task-output"], taskId: "task-shared-keep" }),
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );

  const dryRun = await pruneOldOutputMaterials({ dataDir, now, retentionDays: 14, apply: false });
  assert(dryRun.deletedItemIds.includes("res-expired"), "dry run did not select expired task output");
  assert(!dryRun.deletedItemIds.includes("res-favorited"), "dry run selected favorited material");
  assert(!dryRun.deletedItemIds.includes("res-manual"), "dry run selected non-task-output material");
  assert(!dryRun.deletedItemIds.includes("res-categorized"), "dry run selected categorized material");
  assert(!dryRun.deletedItemIds.includes("res-recent"), "dry run selected recent material");

  const configuredDryRun = await pruneOldOutputMaterials({ dataDir, now, apply: false });
  assert(configuredDryRun.retentionDays === 15, "configured retention days were not loaded from admin settings");
  assert(configuredDryRun.retentionSource === "file", "configured retention source was not reported as file");

  const defaultDataDir = await mkdtemp(join(tmpdir(), "xinghuan-output-prune-default-"));
  const defaultDryRun = await pruneOldOutputMaterials({ dataDir: defaultDataDir, now, apply: false });
  assert(defaultDryRun.retentionDays === 3, "default retention days are not three days");
  assert(defaultDryRun.retentionSource === "environment-or-default", "default retention source was not reported");

  const applied = await pruneOldOutputMaterials({ dataDir, now, retentionDays: 14, apply: true });
  const after = JSON.parse(await readFile(resourceDbPath, "utf-8"));
  const remainingIds = new Set((after.items || []).map((entry: any) => entry.id));

  assert(applied.deletedItemIds.includes("res-expired"), "apply did not delete expired task output");
  assert(!remainingIds.has("res-expired"), "expired task output still exists in resource db");
  assert(remainingIds.has("res-favorited"), "favorited material was deleted");
  assert(remainingIds.has("res-manual"), "manual material was deleted");
  assert(remainingIds.has("res-categorized"), "categorized material was deleted");
  assert(remainingIds.has("res-recent"), "recent material was deleted");
  assert(remainingIds.has("res-shared-keep"), "shared keep material was deleted");
  assert(!applied.deletedFiles.includes(`/files/output/${sharedFile}`), "shared file should not have been unlinked");

  console.log(
    JSON.stringify(
      {
        ok: true,
        deletedItemIds: applied.deletedItemIds,
        deletedFiles: applied.deletedFiles,
        skipped: applied.skipped,
      },
      null,
      2,
    ),
  );
}

function item(id: string, filename: string, time: number, patch: Record<string, unknown> = {}) {
  return {
    id,
    kind: "image",
    title: id,
    url: `/files/output/${filename}`,
    sourceUrl: `/files/output/${filename}`,
    originalName: filename,
    fileUrl: `/files/output/${filename}`,
    fileRel: `/files/output/${filename}`,
    mime: "image/png",
    size: 7,
    categoryId: "",
    tags: [],
    favorite: false,
    createdAt: time,
    updatedAt: time,
    ...patch,
  };
}

async function ensureDir(path: string) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path, { recursive: true });
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
