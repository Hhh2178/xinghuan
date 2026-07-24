import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const operationsByPath = new Map<string, Promise<void>>();

export async function readSerializedJson(path: string): Promise<unknown> {
  return enqueue(path, async () => JSON.parse(await readFile(path, "utf8")));
}

export async function writeSerializedJson(path: string, value: unknown): Promise<void> {
  await enqueue(path, async () => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  });
}

export function fileErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

async function enqueue<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = operationsByPath.get(path) || Promise.resolve();
  const current = previous.then(operation, operation);
  const settled = current.then(() => undefined, () => undefined);
  operationsByPath.set(path, settled);
  try {
    return await current;
  } finally {
    if (operationsByPath.get(path) === settled) operationsByPath.delete(path);
  }
}
