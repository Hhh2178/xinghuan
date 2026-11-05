import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("APIMart image requests use the documented image_urls array", () => {
  const source = readFileSync(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
  const functionText = source.match(/function applyImageReferencePayload\([\s\S]*?\n\}/)?.[0];
  assert.ok(functionText, "image reference mapper must exist");
  const js = functionText.replace(/: Record<string, unknown>/g, "").replace(/: string\[\]/g, "").replace(/: boolean/g, "").replace(/: string/g, "");
  const apply = new Function(`${js}; return applyImageReferencePayload;`)();
  const body = {};
  const images = ["https://example.test/one.png", "https://example.test/two.png"];
  apply(body, images, false, "apimart");
  assert.deepEqual(body.image_urls, images);
  assert.equal(body.image, undefined);
});
