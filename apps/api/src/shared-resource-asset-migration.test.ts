import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { materializeSharedResourceAssets } from "./shared-resource-asset-migration.js";

describe("shared resource asset migration", () => {
  it("materializes legacy public assets independently from user output retention", async () => {
    const dataDir = join(tmpdir(), `shared-resource-migration-${randomUUID()}`);
    const publisherId = "publisher-a";
    const outputDir = join(dataDir, "users", publisherId, "output");
    const adminDir = join(dataDir, "admin");
    await mkdir(outputDir, { recursive: true });
    await mkdir(adminDir, { recursive: true });
    await writeFile(join(outputDir, "result.png"), "public-asset", "utf8");
    await writeFile(join(adminDir, "shared-resource-library.json"), JSON.stringify({
      categories: [],
      items: [{
        id: "shared-image-1",
        kind: "image",
        fileUrl: "/files/output/result.png",
        publishedBy: publisherId,
      }],
    }), "utf8");

    const dryRun = await materializeSharedResourceAssets({ dataDir });
    expect(dryRun).toEqual(expect.objectContaining({ ok: true, readyForMigration: false, wouldCopy: 1, copied: 0 }));

    const applied = await materializeSharedResourceAssets({ dataDir, apply: true });
    expect(applied).toEqual(expect.objectContaining({ ok: true, readyForMigration: true, copied: 1, ready: 1 }));
    expect(await readFile(join(adminDir, "shared-assets", "shared-image-1.png"), "utf8")).toBe("public-asset");
    const catalog = JSON.parse(await readFile(join(adminDir, "shared-resource-library.json"), "utf8"));
    expect(catalog.items[0].sharedAssetKey).toBe("shared-image-1.png");
  });

  it("reports missing legacy files without writing a false ready state", async () => {
    const dataDir = join(tmpdir(), `shared-resource-migration-${randomUUID()}`);
    const adminDir = join(dataDir, "admin");
    await mkdir(adminDir, { recursive: true });
    await writeFile(join(adminDir, "shared-resource-library.json"), JSON.stringify({
      items: [{
        id: "shared-image-missing",
        kind: "image",
        fileUrl: "/files/input/missing.png",
        publishedBy: "publisher-a",
      }],
    }), "utf8");

    const report = await materializeSharedResourceAssets({ dataDir, apply: true });
    expect(report.ok).toBe(false);
    expect(report.missing).toEqual([{ id: "shared-image-missing", reason: "SOURCE_FILE_MISSING" }]);
  });
});
