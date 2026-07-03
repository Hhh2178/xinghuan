import assert from "node:assert/strict";
import {
  buildComfyuiExecutionPrompt,
  extractComfyuiResultAssets,
} from "../apps/api/src/comfyui-execution.ts";

const workflowJson = {
  "10": {
    class_type: "CLIPTextEncode",
    inputs: {
      text: "old prompt",
    },
  },
  "11": {
    class_type: "KSampler",
    inputs: {
      seed: 123,
      steps: 20,
    },
  },
  "12": {
    class_type: "LoadImage",
    inputs: {
      image: "old.png",
    },
  },
};

const promptResult = buildComfyuiExecutionPrompt({
  workflowJson,
  exposedFields: [
    {
      key: "10.text",
      nodeId: "10",
      fieldName: "text",
      label: "Prompt",
      source: "prompt",
      kind: "textarea",
    },
    {
      key: "11.seed",
      nodeId: "11",
      fieldName: "seed",
      label: "Seed",
      source: "seed",
      kind: "number",
    },
    {
      key: "12.image",
      nodeId: "12",
      fieldName: "image",
      label: "Image 1",
      source: "image1",
      kind: "image",
    },
  ],
  defaultValues: {
    "11.seed": 456,
  },
  userParams: {
    "10.text": "new prompt",
  },
  mediaInputs: {
    images: ["uploaded-image.png"],
  },
});

assert.equal(
  promptResult["10"]?.inputs?.text,
  "new prompt",
  "prompt field should use user param override",
);
assert.equal(
  promptResult["11"]?.inputs?.seed,
  456,
  "seed field should fall back to default values",
);
assert.equal(
  promptResult["12"]?.inputs?.image,
  "uploaded-image.png",
  "image field should use prepared media input",
);

const historyAssets = extractComfyuiResultAssets({
  outputs: {
    "31": {
      images: [
        { filename: "a.png", subfolder: "", type: "output" },
      ],
    },
    "32": {
      gifs: [
        { filename: "b.mp4", subfolder: "videos", type: "output", format: "video/mp4" },
      ],
    },
    "33": {
      audio: [
        { filename: "c.wav", subfolder: "audio", type: "output" },
      ],
    },
    "34": {
      text: [
        "done",
      ],
    },
  },
});

assert.equal(historyAssets.images.length, 1, "should collect image outputs");
assert.equal(historyAssets.videos.length, 1, "should collect video outputs from gifs bucket");
assert.equal(historyAssets.audios.length, 1, "should collect audio outputs");
assert.deepEqual(historyAssets.texts, ["done"], "should collect text outputs");

console.log("comfyui execution helpers: ok");
