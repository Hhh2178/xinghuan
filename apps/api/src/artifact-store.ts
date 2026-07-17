import { stat, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";

export interface ArtifactStore {
  resolveOwned(ownerId: string, storageKey: string): Promise<{ absolutePath: string; size: number } | null>;
  deleteOwned(ownerId: string, storageKey: string): Promise<boolean>;
}

export function createLocalArtifactStore(deps: { outputDir: (ownerId: string) => string }): ArtifactStore {
  function resolvePath(ownerId: string, storageKey: string) {
    const filename = String(storageKey || "").trim();
    if (!filename || /[\\/]/.test(filename) || filename.includes("..")) return "";
    const root = resolve(deps.outputDir(ownerId));
    const absolutePath = resolve(root, filename);
    return absolutePath.startsWith(`${root}${sep}`) ? absolutePath : "";
  }

  async function resolveOwned(ownerId: string, storageKey: string) {
    const absolutePath = resolvePath(ownerId, storageKey);
    if (!absolutePath) return null;
    const info = await stat(absolutePath).catch(() => null);
    return info?.isFile() ? { absolutePath, size: info.size } : null;
  }

  async function deleteOwned(ownerId: string, storageKey: string) {
    const absolutePath = resolvePath(ownerId, storageKey);
    if (!absolutePath) return false;
    return unlink(absolutePath).then(() => true).catch(() => false);
  }

  return { resolveOwned, deleteOwned };
}
