import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { resizeOwnedImage } from "./worker-native-image-transform.js";

describe("worker native image transform", () => {
  it("resizes the current owner's output image and exposes a canvas-safe URL", async () => {
    const dataDir = join(tmpdir(), `xinghuan-resize-${randomUUID()}`);
    const outputDir = join(dataDir, "users", "owner_1", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "source.png"), await sharp({
      create: { width: 12, height: 8, channels: 4, background: "#336699" },
    }).png().toBuffer());

    const result = await resizeOwnedImage({
      dataDir,
      ownerId: "owner/1",
      imageUrl: "/files/output/source.png",
      width: 6,
      height: 6,
      fit: "contain",
    });

    expect(result.imageUrl).toMatch(/^\/files\/output\/canvas_resize_/);
    expect(result.width).toBe(6);
    expect(result.height).toBe(6);
  });

  it("rejects sources outside the current owner's input and output directories", async () => {
    await expect(resizeOwnedImage({
      dataDir: join(tmpdir(), `xinghuan-resize-${randomUUID()}`),
      ownerId: "owner-1",
      imageUrl: "/files/output/..%2Fother-owner.png",
      width: 6,
    })).rejects.toThrow("CANVAS_RUN_IMAGE_SOURCE_FORBIDDEN");
  });
});
