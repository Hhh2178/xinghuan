import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const args = process.argv.slice(2);
const isWindows = process.platform === "win32";

if (args.length === 0) {
  console.error("Usage: node scripts/run-codegraph.mjs <status|sync|init ...>");
  process.exit(1);
}

const command = isWindows ? "codegraph.cmd" : "codegraph";
const result = spawnSync(command, args, {
  cwd: projectRoot,
  encoding: "utf8",
  shell: isWindows,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
