import { readFile } from "node:fs/promises";

async function main() {
  const [image, video, seedance, audio, card, styles] = await Promise.all([
    readFile(new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url), "utf8").catch(() => ""),
    readFile(new URL("../apps/web/src/components/nodes/VideoNode.tsx", import.meta.url), "utf8").catch(() => ""),
    readFile(new URL("../apps/web/src/components/nodes/SeedanceNode.tsx", import.meta.url), "utf8").catch(() => ""),
    readFile(new URL("../apps/web/src/components/nodes/AudioNode.tsx", import.meta.url), "utf8").catch(() => ""),
    readFile(new URL("../apps/web/src/components/nodes/NodeRuntimeCard.tsx", import.meta.url), "utf8").catch(() => ""),
    readFile(new URL("../apps/web/src/styles/index.css", import.meta.url), "utf8").catch(() => ""),
  ]);

  const merged = `${image}\n${video}\n${seedance}\n${audio}`;
  const checks = [
    [
      "Generation nodes render shared runtime card component",
      merged.includes("NodeRuntimeCard"),
    ],
    [
      "Shared runtime card component exists with runtime styling",
      card.includes("node-runtime-card") &&
        styles.includes(".node-runtime-card {") &&
        styles.includes(".node-runtime-card__bar"),
    ],
    [
      "Generation nodes persist runtime timing metadata",
      merged.includes("startedAt") &&
        merged.includes("finishedAt"),
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
