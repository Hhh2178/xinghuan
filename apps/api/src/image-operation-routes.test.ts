import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createImageOperationService } from "./image-operation-routes.js";

describe("image operation service", () => {
  it("resizes an image from the current user's input directory and registers the output", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-"));
    const inputDir = join(root, "input");
    const outputDir = join(root, "output");
    await mkdir(inputDir, { recursive: true });
    await sharp({ create: { width: 16, height: 8, channels: 3, background: "#ff0000" } })
      .png()
      .toFile(join(inputDir, "source.png"));
    const onSaved = vi.fn(async () => undefined);
    const service = createImageOperationService({ dirs: { inputDir, outputDir }, onSaved });

    const result = await service.resize({ imageUrl: "/files/input/source.png", width: 4, height: 4, fit: "cover" });

    const output = await readFile(join(outputDir, result.imageUrl.split("/").at(-1)!));
    await expect(sharp(output).metadata()).resolves.toMatchObject({ width: 4, height: 4, format: "png" });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("does not allow an input URL to escape the current user's storage roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-"));
    const service = createImageOperationService({
      dirs: { inputDir: join(root, "input"), outputDir: join(root, "output") },
    });

    await expect(service.resize({ imageUrl: "/files/input/../other/source.png", width: 4, height: 4 }))
      .rejects.toThrow("IMAGE_SOURCE_FORBIDDEN");
  });
});
