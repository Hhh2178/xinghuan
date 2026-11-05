import { describe, expect, it } from "vitest";
import { buildApimartImageRequest } from "./worker-provider-utils.js";

describe("APIMart GPT Image 2.6 request contract", () => {
  const base = { model: "gpt-image-2.6-flare", prompt: "test", n: 1, size: "auto" };

  it("passes image references and documented editing parameters", () => {
    expect(buildApimartImageRequest(base, {
      images: ["https://example.test/ref.png"], resolution: "2k", quality: "high", complexity: "low",
      mask_url: "https://example.test/mask.png", output_format: "png",
    })).toMatchObject({ image_urls: ["https://example.test/ref.png"], resolution: "2k", quality: "high", complexity: "low", mask_url: "https://example.test/mask.png" });
  });

  it("passes valid GIF settings and rejects reference images or an oversized sheet", () => {
    expect(buildApimartImageRequest(base, { output_format: "gif", frame_count: 9, frame_duration_ms: 200, size: "512x512" }))
      .toMatchObject({ output_format: "gif", frame_count: 9, frame_duration_ms: 200, size: "512x512" });
    expect(() => buildApimartImageRequest(base, { output_format: "gif", images: ["https://example.test/a.png"] })).toThrow();
    expect(() => buildApimartImageRequest(base, { output_format: "gif", frame_count: 2, size: "1024x1024" })).toThrow();
  });

  it("requires an SVG writer and one output", () => {
    expect(buildApimartImageRequest(base, { output_format: "svg", svg: { model: "gpt-5.4-mini" } })).toMatchObject({ svg: { model: "gpt-5.4-mini" } });
    expect(() => buildApimartImageRequest(base, { output_format: "svg" })).toThrow();
    expect(() => buildApimartImageRequest({ ...base, n: 2 }, { output_format: "svg", svg: { model: "writer" } })).toThrow();
  });

  it("rejects invalid combinations instead of silently forwarding them", () => {
    expect(() => buildApimartImageRequest(base, { quality: "ultra" })).toThrow();
    expect(() => buildApimartImageRequest(base, { output_format: "png", output_compression: 20 })).toThrow();
    expect(() => buildApimartImageRequest(base, { mask_url: "https://example.test/mask.png" })).toThrow();
  });
});
