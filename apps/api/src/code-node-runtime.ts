import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_CODE_BYTES = 64 * 1024;
const MAX_CONCURRENT_EXECUTIONS = Math.max(1, Math.min(8, Number(process.env.CODE_NODE_MAX_CONCURRENCY) || 2));
let activeExecutions = 0;

const PYTHON_WRAPPER = String.raw`
import ast, json, math, re, statistics, datetime, sys

payload = json.loads(sys.stdin.read())
code = payload.get("code", "")
input_data = payload.get("input", {})

try:
    import resource
except ImportError:
    resource = None

if resource is not None:
    for limit_name, limit_value in (
        ("RLIMIT_CPU", 6),
        ("RLIMIT_AS", 256 * 1024 * 1024),
        ("RLIMIT_FSIZE", 1024 * 1024),
        ("RLIMIT_NOFILE", 16),
    ):
        limit_kind = getattr(resource, limit_name, None)
        if limit_kind is not None:
            try:
                resource.setrlimit(limit_kind, (limit_value, limit_value))
            except (ValueError, OSError):
                pass

blocked_nodes = (ast.Import, ast.ImportFrom, ast.Global, ast.Nonlocal)
blocked_names = {
    "__import__", "open", "eval", "exec", "compile", "input", "breakpoint",
    "globals", "locals", "vars", "dir", "getattr", "setattr", "delattr",
    "help", "memoryview", "exit", "quit"
}

tree = ast.parse(code, mode="exec")
for node in ast.walk(tree):
    if isinstance(node, blocked_nodes):
        raise ValueError("CODE_NODE_IMPORT_NOT_ALLOWED")
    if isinstance(node, ast.Name) and node.id in blocked_names:
        raise ValueError("CODE_NODE_NAME_NOT_ALLOWED:" + node.id)
    if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
        raise ValueError("CODE_NODE_PRIVATE_ATTRIBUTE_NOT_ALLOWED")

safe_builtins = {
    "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
    "enumerate": enumerate, "filter": filter, "float": float, "int": int,
    "len": len, "list": list, "map": map, "max": max, "min": min,
    "range": range, "reversed": reversed, "round": round, "set": set,
    "sorted": sorted, "str": str, "sum": sum, "tuple": tuple, "zip": zip,
    "Exception": Exception, "ValueError": ValueError, "TypeError": TypeError,
}
scope = {
    "__builtins__": safe_builtins,
    "input_data": input_data,
    "result": None,
    "json": json,
    "math": math,
    "re": re,
    "statistics": statistics,
    "datetime": datetime,
}
exec(compile(tree, "<code-node>", "exec"), scope, scope)
print(json.dumps({"ok": True, "result": scope.get("result")}, ensure_ascii=False, default=str))
`;

export interface CodeNodeExecutionInput {
  code: string;
  input: unknown;
}

export interface CodeNodeExecutionResult {
  result: unknown;
  durationMs: number;
}

export async function executeCodeNode(
  input: CodeNodeExecutionInput,
  options: { timeoutMs?: number; pythonBin?: string } = {},
): Promise<CodeNodeExecutionResult> {
  const code = String(input.code || "");
  if (!code.trim()) throw new Error("CODE_NODE_EMPTY_CODE");
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) throw new Error("CODE_NODE_CODE_TOO_LARGE");

  const timeoutMs = Math.max(100, Math.min(30_000, options.timeoutMs || DEFAULT_TIMEOUT_MS));
  const pythonBin = options.pythonBin || process.env.XINGHUAN_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  const startedAt = Date.now();

  if (activeExecutions >= MAX_CONCURRENT_EXECUTIONS) throw new Error("CODE_NODE_BUSY");
  activeExecutions += 1;

  try {
    const payload = JSON.stringify({ code, input: input.input ?? null });
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(pythonBin, ["-I", "-S", "-c", PYTHON_WRAPPER], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: {
          PATH: process.env.PATH || "",
          SYSTEMROOT: process.env.SYSTEMROOT || "",
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
      });
      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (error) reject(error);
        else resolve(stdout.toString("utf8").trim());
      };
      const append = (current: Buffer, chunk: Buffer) => {
        const next = Buffer.concat([current, chunk]);
        if (next.length > MAX_OUTPUT_BYTES) {
          child.kill();
          finish(new Error("CODE_NODE_OUTPUT_TOO_LARGE"));
        }
        return next;
      };
      child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
      child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
      child.once("error", (error) => finish(new Error(`CODE_NODE_PYTHON_UNAVAILABLE:${error.message}`)));
      child.once("close", (codeValue) => {
        if (codeValue !== 0) {
          const detail = stderr.toString("utf8").trim().split(/\r?\n/).slice(-1)[0] || `exit ${codeValue}`;
          finish(new Error(`CODE_NODE_EXECUTION_FAILED:${detail}`));
          return;
        }
        finish();
      });
      timer = setTimeout(() => {
        child.kill();
        finish(new Error("CODE_NODE_TIMEOUT"));
      }, timeoutMs);
      child.stdin.end(payload);
    });

    let parsed: { ok?: boolean; result?: unknown };
    try {
      parsed = JSON.parse(output);
    } catch {
      throw new Error("CODE_NODE_INVALID_RUNTIME_OUTPUT");
    }
    if (!parsed.ok) throw new Error("CODE_NODE_EXECUTION_FAILED");
    return { result: parsed.result, durationMs: Date.now() - startedAt };
  } finally {
    activeExecutions -= 1;
  }
}
