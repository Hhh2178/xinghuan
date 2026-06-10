import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile(new URL("../apps/web/src/components/LoginGate.tsx", import.meta.url), "utf8");
  const checks = [
    [
      "Login gate does not prefill bootstrap admin email",
      !source.includes("useState('admin@xinghuan.local')"),
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
