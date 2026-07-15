import assert from "node:assert/strict";
import {
  legacyMultiImageFromReferenceLimit,
  readVideoReferenceImageMax,
  readVideoReferenceImageTransport,
  syncVideoReferenceImageSchema,
  syncVideoReferenceImageTransport,
} from "../apps/admin/src/admin-model-editor-video-reference.ts";

assert.equal(readVideoReferenceImageMax({ referenceImages: { max: 9 } }), 9);
assert.equal(readVideoReferenceImageMax({ referenceImages: { max: 30 } }), 16);
assert.equal(readVideoReferenceImageMax({}, 4), 4);

assert.deepEqual(syncVideoReferenceImageSchema({ duration: { default: 15 } }, true, 7), {
  duration: { default: 15 },
  referenceImages: { type: "image[]", max: 7 },
});
assert.deepEqual(syncVideoReferenceImageSchema({
  referenceImages: { type: "image[]", max: 9, formats: ["png"] },
  duration: { default: 15 },
}, false, 9), {
  duration: { default: 15 },
});

assert.equal(legacyMultiImageFromReferenceLimit(true, 1), false);
assert.equal(legacyMultiImageFromReferenceLimit(true, 2), true);
assert.equal(legacyMultiImageFromReferenceLimit(false, 9), false);
assert.equal(readVideoReferenceImageTransport({}), "url");
assert.equal(readVideoReferenceImageTransport({ referenceImageTransport: "data_url" }), "data_url");
assert.deepEqual(syncVideoReferenceImageTransport({ mode: "async_video_task" }, true, "data_url"), {
  mode: "async_video_task",
  referenceImageTransport: "data_url",
});
assert.deepEqual(syncVideoReferenceImageTransport({ referenceImageTransport: "data_url" }, true, "url"), {});
assert.deepEqual(syncVideoReferenceImageTransport({ referenceImageTransport: "data_url" }, false, "data_url"), {});

console.log(JSON.stringify({ ok: true }, null, 2));
