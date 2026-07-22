import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
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

  it("rejects a truncated image without registering or persisting an output", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-invalid-"));
    const inputDir = join(root, "input");
    const outputDir = join(root, "output");
    await mkdir(inputDir, { recursive: true });
    await writeFile(join(inputDir, "truncated.png"), Buffer.from([137, 80, 78, 71, 13, 10]));
    const onSaved = vi.fn(async () => undefined);
    const service = createImageOperationService({ dirs: { inputDir, outputDir }, onSaved });

    await expect(service.resize({ imageUrl: "/files/input/truncated.png", width: 4, height: 4 }))
      .rejects.toThrow();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("clamps crop coordinates and dimensions to the decoded image bounds", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-crop-"));
    const inputDir = join(root, "input");
    const outputDir = join(root, "output");
    await mkdir(inputDir, { recursive: true });
    await sharp({ create: { width: 10, height: 6, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } })
      .png()
      .toFile(join(inputDir, "source.png"));
    const service = createImageOperationService({ dirs: { inputDir, outputDir } });

    const result = await service.crop({ imageUrl: "/files/input/source.png", x: 8, y: 4, w: 999, h: 999 });

    const output = await readFile(join(outputDir, result.imageUrl.split("/").at(-1)!));
    await expect(sharp(output).metadata()).resolves.toMatchObject({ width: 2, height: 2, format: "png", hasAlpha: true });
  });

  it("caps upscale requests at 8x and preserves the registered scale", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-upscale-"));
    const inputDir = join(root, "input");
    const outputDir = join(root, "output");
    await mkdir(inputDir, { recursive: true });
    await sharp({ create: { width: 3, height: 2, channels: 3, background: "#336699" } })
      .png()
      .toFile(join(inputDir, "source.png"));
    const service = createImageOperationService({ dirs: { inputDir, outputDir } });

    const result = await service.upscale({ imageUrl: "/files/input/source.png", scale: 99 });

    expect(result.scale).toBe(8);
    const output = await readFile(join(outputDir, result.imageUrl.split("/").at(-1)!));
    await expect(sharp(output).metadata()).resolves.toMatchObject({ width: 24, height: 16, format: "png" });
  });

  it("combines unequal images in horizontal and vertical layouts", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-combine-"));
    const inputDir = join(root, "input");
    const outputDir = join(root, "output");
    await mkdir(inputDir, { recursive: true });
    await sharp({ create: { width: 4, height: 2, channels: 3, background: "#ff0000" } }).png().toFile(join(inputDir, "a.png"));
    await sharp({ create: { width: 2, height: 5, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0.5 } } }).png().toFile(join(inputDir, "b.png"));
    const service = createImageOperationService({ dirs: { inputDir, outputDir } });
    const imageUrls = ["/files/input/a.png", "/files/input/b.png"];

    const horizontal = await service.combine({ imageUrls, direction: "horizontal" });
    const vertical = await service.combine({ imageUrls, direction: "vertical" });

    const horizontalOutput = await readFile(join(outputDir, horizontal.imageUrl.split("/").at(-1)!));
    const verticalOutput = await readFile(join(outputDir, vertical.imageUrl.split("/").at(-1)!));
    await expect(sharp(horizontalOutput).metadata()).resolves.toMatchObject({ width: 6, height: 5, format: "png", hasAlpha: true });
    await expect(sharp(verticalOutput).metadata()).resolves.toMatchObject({ width: 4, height: 7, format: "png", hasAlpha: true });
  });

  it("rejects combine requests outside the supported 2 to 20 image range", async () => {
    const root = await mkdtemp(join(tmpdir(), "xinghuan-image-op-count-"));
    const service = createImageOperationService({ dirs: { inputDir: join(root, "input"), outputDir: join(root, "output") } });

    await expect(service.combine({ imageUrls: ["/files/input/one.png"] })).rejects.toThrow("IMAGE_COUNT_OUT_OF_RANGE");
    await expect(service.combine({ imageUrls: Array.from({ length: 21 }, (_, index) => `/files/input/${index}.png`) }))
      .rejects.toThrow("IMAGE_COUNT_OUT_OF_RANGE");
  });
});
