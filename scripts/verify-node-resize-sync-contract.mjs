import { readFile } from "node:fs/promises";

const nodeFiles = [
  "OutputNode.tsx",
  "UploadNode.tsx",
  "ImageNode.tsx",
  "VideoNode.tsx",
  "SeedanceNode.tsx",
  "AudioNode.tsx",
];

async function main() {
  const hookSource = await readFile(
    new URL("../apps/web/src/components/nodes/useSyncNodeInternalsOnResize.ts", import.meta.url),
    "utf8",
  );
  const checks = [
    [
      "Shared resize sync hook observes real DOM size changes",
      hookSource.includes("useUpdateNodeInternals") &&
        hookSource.includes("ResizeObserver") &&
        hookSource.includes("requestAnimationFrame") &&
        hookSource.includes("second"),
    ],
  ];

  for (const file of nodeFiles) {
    const source = await readFile(
      new URL(`../apps/web/src/components/nodes/${file}`, import.meta.url),
      "utf8",
    );
    checks.push([
      `${file} wires root ref to resize sync hook`,
      source.includes("useSyncNodeInternalsOnResize") &&
        source.includes("rootRef") &&
        source.includes("ref={rootRef}"),
    ]);
  }

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
