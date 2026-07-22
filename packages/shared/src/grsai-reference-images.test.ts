import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { prepareGrsaiReferenceImages, prepareInlineImageReferences } from "./grsai-reference-images";

describe("grsai reference images", () => {
  it("inlines safe local input image references and preserves remote references", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user/with unsafe chars";
    const safeOwnerId = "user_with_unsafe_chars";
    const imageDir = join(dataDir, "users", safeOwnerId, "input");
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "sample.png"), Buffer.from([137, 80, 78, 71]));

    const prepared = await prepareGrsaiReferenceImages({
      dataDir,
      ownerId,
      values: ["input/sample.png", "https://example.test/image.png"],
    });

    expect(prepared[0]).toBe("data:image/png;base64,iVBORw==");
    expect(prepared[1]).toBe("https://example.test/image.png");
  });

  it("inlines signed provider-file URLs for the same owner and rejects unrelated remote URLs", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-admin";
    const imageDir = join(dataDir, "users", ownerId, "input");
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "one.png"), Buffer.from([137, 80, 78, 71]));

    const prepared = await prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: ["https://files.example.test/api/provider-files/gray/user-admin/input/one.png?exp=1&sig=hidden"],
    });
    expect(prepared).toEqual(["data:image/png;base64,iVBORw=="]);

    await expect(prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: ["https://unrelated.example.test/image.png"],
    })).rejects.toThrow("不是当前账号的本地素材");
  });

  it("optionally matches the Grok plugin JPEG 1024/85 preprocessing contract", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-grok";
    const imageDir = join(dataDir, "users", ownerId, "input");
    await mkdir(imageDir, { recursive: true });
    const source = await sharp({
      create: { width: 941, height: 1672, channels: 3, background: { r: 44, g: 88, b: 132 } },
    }).png().toBuffer();
    await writeFile(join(imageDir, "portrait.png"), source);

    const prepared = await prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: ["input/portrait.png", `data:image/png;base64,${source.toString("base64")}`],
      processing: { format: "jpeg", maxDimension: 1024, quality: 85 },
    });

    expect(prepared[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(prepared[1]).toMatch(/^data:image\/jpeg;base64,/);
    const output = Buffer.from(prepared[0].split(",")[1], "base64");
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(576);
    expect(metadata.height).toBe(1024);
    expect(output.byteLength).toBeLessThan(source.byteLength);
    expect(Buffer.from(prepared[1].split(",")[1], "base64").byteLength).toBe(output.byteLength);
  });

  it("rejects truncated image bytes when preprocessing is enabled", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-invalid-image";
    const imageDir = join(dataDir, "users", ownerId, "input");
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "broken.png"), Buffer.from([137, 80, 78, 71, 13, 10]));

    await expect(prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: ["input/broken.png"],
      processing: { format: "jpeg", maxDimension: 1024, quality: 85 },
    })).rejects.toThrow();
  });

  it("enforces per-image and aggregate byte limits before sending provider payloads", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-size-limits";
    const source = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 12, g: 34, b: 56 } },
    }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${source.toString("base64")}`;

    await expect(prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: [dataUrl],
      maxBytesPerImage: source.byteLength - 1,
    })).rejects.toThrow("单图大小限制");

    await expect(prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: [dataUrl, dataUrl],
      maxBytesPerImage: source.byteLength,
      maxTotalBytes: source.byteLength * 2 - 1,
    })).rejects.toThrow("总大小超过");
  });

  it("flattens transparent input to JPEG without enlarging a small image", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-alpha";
    const source = await sharp({
      create: { width: 32, height: 16, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.25 } },
    }).png().toBuffer();

    const prepared = await prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: [`data:image/png;base64,${source.toString("base64")}`],
      processing: { format: "jpeg", maxDimension: 1024, quality: 90 },
    });

    const output = Buffer.from(prepared[0].split(",")[1], "base64");
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      format: "jpeg",
      width: 32,
      height: 16,
      hasAlpha: false,
    });
  });

  it("limits provider references to the configured count", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-reference-limit";
    const source = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${source.toString("base64")}`;

    const prepared = await prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: Array.from({ length: 20 }, () => dataUrl),
      limit: 99,
    });

    expect(prepared).toHaveLength(16);
  });
});
