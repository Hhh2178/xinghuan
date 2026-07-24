import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import sharp from "sharp";

type Fit = "cover" | "contain" | "fill" | "inside" | "outside";

export async function resizeOwnedImage(options: {
  dataDir: string;
  ownerId: string;
  imageUrl: string;
  width?: unknown;
  height?: unknown;
  fit?: unknown;
}) {
  const width = integer(options.width, 0, 0, 8192) || undefined;
  const height = integer(options.height, 0, 0, 8192) || undefined;
  if (!width && !height) throw new Error("CANVAS_RUN_IMAGE_SIZE_REQUIRED");
  const ownerDir = resolve(options.dataDir, "users", safeOwnerSegment(options.ownerId));
  const inputDir = resolve(ownerDir, "input");
  const outputDir = resolve(ownerDir, "output");
  const source = await readFile(resolveOwnedImagePath(options.imageUrl, inputDir, outputDir)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error("CANVAS_RUN_IMAGE_SOURCE_NOT_FOUND");
    throw error;
  });
  const output = await sharp(source).resize(width, height, { fit: normalizeFit(options.fit), withoutEnlargement: false }).png({ compressionLevel: 6 }).toBuffer();
  await mkdir(outputDir, { recursive: true });
  const filename = `canvas_resize_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  await writeFile(resolve(outputDir, filename), output);
  const metadata = await sharp(output).metadata();
  const imageUrl = `/files/output/${filename}`;
  return { imageUrl, imageUrls: [imageUrl], images: [imageUrl], width: metadata.width || 0, height: metadata.height || 0, fit: normalizeFit(options.fit) };
}

function resolveOwnedImagePath(value: string, inputDir: string, outputDir: string) {
  let pathname = value.split(/[?#]/, 1)[0];
  if (/^https?:\/\//i.test(value)) {
    try { pathname = new URL(value).pathname; } catch { throw new Error("CANVAS_RUN_IMAGE_SOURCE_FORBIDDEN"); }
  }
  let decoded = "";
  try { decoded = decodeURIComponent(pathname); } catch { throw new Error("CANVAS_RUN_IMAGE_SOURCE_FORBIDDEN"); }
  const roots = [["/files/input/", inputDir], ["/input/", inputDir], ["/files/output/", outputDir], ["/output/", outputDir]] as const;
  for (const [prefix, root] of roots) {
    if (!decoded.startsWith(prefix)) continue;
    const tail = decoded.slice(prefix.length).replace(/^[/\\]+/, "");
    if (tail) return assertInside(root, resolve(root, tail));
  }
  throw new Error("CANVAS_RUN_IMAGE_SOURCE_FORBIDDEN");
}

function assertInside(root: string, candidate: string) {
  const tail = relative(resolve(root), resolve(candidate));
  if (tail && !tail.startsWith(`..${sep}`) && tail !== ".." && !isAbsolute(tail)) return resolve(candidate);
  throw new Error("CANVAS_RUN_IMAGE_SOURCE_FORBIDDEN");
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalizeFit(value: unknown): Fit {
  return value === "cover" || value === "contain" || value === "fill" || value === "outside" ? value : "inside";
}

function safeOwnerSegment(value: string) {
  return String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
}
