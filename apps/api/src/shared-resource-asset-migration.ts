import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { safeUserId } from "./api-sanitizers.js";

type SharedResourceItem = {
  id?: string;
  kind?: string;
  fileUrl?: string;
  fileRel?: string;
  url?: string;
  publishedBy?: string;
  sharedAssetKey?: string;
  [key: string]: unknown;
};

type SharedResourceCatalog = {
  categories?: unknown[];
  items?: SharedResourceItem[];
};

export type SharedResourceFileReference = {
  bucket: "input" | "output";
  filename: string;
};

export function parseSharedResourceFileReference(value: unknown): SharedResourceFileReference | null {
  const raw = typeof value === "string" ? value.trim() : "";
  const prefixes = [
    { prefix: "/files/input/", bucket: "input" as const },
    { prefix: "/files/output/", bucket: "output" as const },
    { prefix: "/input/", bucket: "input" as const },
    { prefix: "/output/", bucket: "output" as const },
  ];
  const matched = prefixes.find((candidate) => raw.startsWith(candidate.prefix));
  if (!matched) return null;
  let filename = "";
  try {
    filename = decodeURIComponent(raw.slice(matched.prefix.length));
  } catch {
    return null;
  }
  if (!filename || basename(filename) !== filename || filename === "." || filename === "..") return null;
  return { bucket: matched.bucket, filename };
}

export function sharedResourceAssetKey(itemId: string, filename: string) {
  const extensionIndex = filename.lastIndexOf(".");
  const extension = extensionIndex >= 0 ? filename.slice(extensionIndex) : ".bin";
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
  return `${itemId}${safeExtension}`;
}

export async function materializeSharedResourceAssets(options: {
  dataDir: string;
  apply?: boolean;
}) {
  const apply = options.apply === true;
  const adminDir = join(options.dataDir, "admin");
  const catalogPath = join(adminDir, "shared-resource-library.json");
  const assetDir = join(adminDir, "shared-assets");
  const catalog = await readCatalog(catalogPath);
  const items = Array.isArray(catalog.items) ? catalog.items : [];
  const missing: Array<{ id: string; reason: string }> = [];
  let candidates = 0;
  let ready = 0;
  let copied = 0;
  let wouldCopy = 0;
  let changed = false;

  for (const item of items) {
    const id = text(item.id);
    const reference = parseSharedResourceFileReference(item.fileUrl || item.fileRel || item.url);
    if (!id || !reference) continue;
    candidates += 1;
    const existingKey = safeAssetKey(item.sharedAssetKey);
    if (existingKey && await isFile(join(assetDir, existingKey))) {
      ready += 1;
      continue;
    }
    const publishedBy = text(item.publishedBy);
    if (!publishedBy) {
      missing.push({ id, reason: "PUBLISHER_MISSING" });
      continue;
    }
    const sourcePath = join(options.dataDir, "users", safeUserId(publishedBy), reference.bucket, reference.filename);
    if (!await isFile(sourcePath)) {
      missing.push({ id, reason: "SOURCE_FILE_MISSING" });
      continue;
    }
    const assetKey = existingKey || sharedResourceAssetKey(id, reference.filename);
    wouldCopy += 1;
    if (!apply) continue;
    await mkdir(assetDir, { recursive: true });
    await copyFile(sourcePath, join(assetDir, assetKey));
    item.sharedAssetKey = assetKey;
    copied += 1;
    ready += 1;
    changed = true;
  }

  if (apply && changed) {
    const temporaryPath = `${catalogPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporaryPath, `${JSON.stringify({ ...catalog, items }, null, 2)}\n`, "utf8");
    await rename(temporaryPath, catalogPath);
  }

  return {
    ok: missing.length === 0,
    readyForMigration: missing.length === 0 && (apply || wouldCopy === 0),
    apply,
    catalogPath,
    assetDir,
    totalItems: items.length,
    candidates,
    ready,
    copied,
    wouldCopy,
    missing,
  };
}

async function readCatalog(path: string): Promise<SharedResourceCatalog> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as SharedResourceCatalog;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { categories: [], items: [] };
    throw error;
  }
}

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function safeAssetKey(value: unknown) {
  const candidate = text(value);
  return candidate && basename(candidate) === candidate ? candidate : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
