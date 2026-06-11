import { readFile } from "node:fs/promises";

async function main() {
  const [imageSource, videoSource, audioSource, seedanceSource, presetImageSource, canvasSource, outputSource, generationServiceSource] = await Promise.all([
    readFile(new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/VideoNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/AudioNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/SeedanceNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/PresetImageNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/OutputNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/services/generation.ts", import.meta.url), "utf8"),
  ]);

  const checks = [
    [
      "Image node submits split image generations concurrently and streams partial results",
      imageSource.includes("const generationCount =") &&
        imageSource.includes("生成数量") &&
        imageSource.includes("runSingleImageGeneration") &&
        imageSource.includes("runConcurrentImageGenerations") &&
        imageSource.includes("Promise.allSettled") &&
        imageSource.includes("appendImageGenerationResult"),
    ],
    [
      "Video node submits split video generations concurrently and streams partial results",
      videoSource.includes("const generationCount =") &&
        videoSource.includes("生成数量") &&
        videoSource.includes("runConcurrentVideoGenerations") &&
        videoSource.includes("Promise.allSettled") &&
        videoSource.includes("appendVideoGenerationResult"),
    ],
    [
      "Audio node submits split audio generations concurrently and streams partial results",
      audioSource.includes("const generationCount =") &&
        audioSource.includes("生成数量") &&
        audioSource.includes("runConcurrentAudioGenerations") &&
        audioSource.includes("Promise.allSettled") &&
        audioSource.includes("aggregatedAudioUrls") &&
        audioSource.includes("aggregatedTracks"),
    ],
    [
      "Seedance node submits split video generations concurrently and streams partial results",
      seedanceSource.includes("const generationCount =") &&
        seedanceSource.includes("生成数量") &&
        seedanceSource.includes("runConcurrentSeedanceGenerations") &&
        seedanceSource.includes("Promise.allSettled") &&
        seedanceSource.includes("appendSeedanceGenerationResult"),
    ],
    [
      "Preset image node exposes generation count and loops split image submissions",
      presetImageSource.includes("const generationCount =") &&
        presetImageSource.includes("生成数量") &&
        presetImageSource.includes("for (let batchIndex = 0; batchIndex < generationCount; batchIndex += 1)") &&
        presetImageSource.includes("const total = promptTemplates.length * generationCount"),
    ],
    [
      "Canvas auto output creates one adaptive output node per generation node instead of one node per generated item",
      canvasSource.includes("groupOutputMode: 'collection'") &&
        canvasSource.includes("const existingCollectionOutput") &&
        !canvasSource.includes("data: { pickKind: item.kind, pickIndex: item.kindIndex }"),
    ],
    [
      "Output node uses adaptive contain grids for multi image and video collections",
      outputSource.includes("buildMediaGridStyle") &&
        outputSource.includes("buildMediaFrameStyle") &&
        outputSource.includes("objectFit: 'contain'") &&
        outputSource.includes("gridTemplateColumns"),
    ],
    [
      "Generation service exposes cancel helpers for upstream-capable task cancellation",
      generationServiceSource.includes("cancelGenerationTask") &&
        generationServiceSource.includes("/api/proxy/generation/cancel"),
    ],
    [
      "Running generation UI keeps stop controls in compact node headers only",
      imageSource.includes('title="终止当前生成任务"') &&
        videoSource.includes('title="终止当前生成任务"') &&
        audioSource.includes('title="终止当前生成任务"') &&
        seedanceSource.includes('title="终止当前生成任务"') &&
        !videoSource.includes("停止({progress") &&
        !seedanceSource.includes("停止({progress") &&
        !audioSource.includes("<Square size={11} /> 停止"),
    ],
    [
      "Generation count controls avoid explanatory implementation copy in node UI",
      !videoSource.includes("自动拆单") &&
        !videoSource.includes("聚合回当前节点") &&
        !presetImageSource.includes("自动拆单") &&
        !presetImageSource.includes("聚合回当前节点"),
    ],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
