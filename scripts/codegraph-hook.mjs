import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const codegraphDbPath = resolve(projectRoot, ".codegraph", "codegraph.db");
const hookEvent = process.argv[2] ?? "manual";
const strictMode = process.env.CODEGRAPH_HOOK_STRICT === "1";

function log(message) {
  console.log(`[codegraph-hook] ${message}`);
}

function warn(message) {
  console.warn(`[codegraph-hook] ${message}`);
}

function getCodegraphCommand() {
  return "codegraph";
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });

  if (result.error && result.error.code === "ENOENT") {
    return {
      ok: false,
      missing: true,
      error: result.error,
    };
  }

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
  };
}

function finishFailure(message) {
  warn(message);
  process.exit(strictMode ? 1 : 0);
}

function runCodegraph(args) {
  const command = getCodegraphCommand();
  const result = runCommand(command, args);

  if (result.missing) {
    finishFailure(
      "未找到 CodeGraph CLI，跳过自动同步。请先安装 CodeGraph，再执行 `npm run setup:codegraph-hooks`。",
    );
    return null;
  }

  if (!result.ok) {
    const detail = (result.stderr || result.stdout || "").trim();
    finishFailure(
      `命令失败: ${command} ${args.join(" ")}${detail ? `\n${detail}` : ""}`,
    );
    return null;
  }

  if (result.stdout.trim()) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr.trim()) {
    process.stderr.write(result.stderr);
  }

  return result;
}

const needsInit = !existsSync(codegraphDbPath);
const commandArgs = needsInit ? ["init", "-i"] : ["sync"];

log(
  `${hookEvent}: ${needsInit ? "未发现索引，执行 codegraph init -i" : "执行 codegraph sync"}`,
);

runCodegraph(commandArgs);
