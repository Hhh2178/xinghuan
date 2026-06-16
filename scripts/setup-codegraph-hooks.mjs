import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const hooksPath = ".githooks";
const hookDirPath = resolve(projectRoot, hooksPath);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
  };
}

function fail(message) {
  console.error(`[setup-codegraph-hooks] ${message}`);
  process.exit(1);
}

function ensureOk(result, commandLabel) {
  if (result.ok) {
    return;
  }

  if (result.error && result.error.code === "ENOENT") {
    fail(`未找到命令 ${commandLabel}。请先确认 Git 和 Node 已安装。`);
  }

  const detail = (result.stderr || result.stdout || "").trim();
  fail(`${commandLabel} 执行失败${detail ? `\n${detail}` : ""}`);
}

if (!existsSync(hookDirPath)) {
  fail(`缺少 hooks 目录: ${hooksPath}`);
}

const firstAttempt = run("git", ["config", "--worktree", "core.hooksPath", hooksPath]);

if (
  !firstAttempt.ok &&
  (firstAttempt.stderr.includes("worktreeConfig") ||
    firstAttempt.stdout.includes("worktreeConfig"))
) {
  ensureOk(
    run("git", ["config", "extensions.worktreeConfig", "true"]),
    "git config extensions.worktreeConfig true",
  );
  ensureOk(
    run("git", ["config", "--worktree", "core.hooksPath", hooksPath]),
    "git config --worktree core.hooksPath .githooks",
  );
} else {
  ensureOk(firstAttempt, "git config --worktree core.hooksPath .githooks");
}

const verifyPath = run("git", ["config", "--worktree", "--get", "core.hooksPath"]);
ensureOk(verifyPath, "git config --worktree --get core.hooksPath");

const verifiedHooksPath = verifyPath.stdout.trim();
if (verifiedHooksPath !== hooksPath) {
  fail(`hooksPath 校验失败，当前值为: ${verifiedHooksPath || "<empty>"}`);
}

console.log(`[setup-codegraph-hooks] 已配置 worktree hooksPath = ${verifiedHooksPath}`);

const hookRunner = run(process.execPath, ["scripts/codegraph-hook.mjs", "setup"]);
ensureOk(hookRunner, "node scripts/codegraph-hook.mjs setup");

if (hookRunner.stdout.trim()) {
  process.stdout.write(hookRunner.stdout);
}

if (hookRunner.stderr.trim()) {
  process.stderr.write(hookRunner.stderr);
}
