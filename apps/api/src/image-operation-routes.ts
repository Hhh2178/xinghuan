import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import sharp from "sharp";

type ImageOperationUser = { id: string };
type UserImageDirs = { inputDir: string; outputDir: string };
type JsonBodyReader = (request: IncomingMessage) => Promise<Record<string, unknown>>;
type JsonSender = (response: ServerResponse, payload: unknown, statusCode?: number) => void;
type SavedImage = { filename: string; url: string; size: number; mime: "image/png" };

export interface ImageOperationRouteDependencies {
  readJsonBody: JsonBodyReader;
  sendJson: JsonSender;
  userDataDirs: (user: ImageOperationUser) => UserImageDirs;
  registerOutput: (user: ImageOperationUser, saved: SavedImage, sourceUrl?: string) => Promise<unknown>;
}

class ImageOperationError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function assertInside(root: string, candidate: string) {
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  const tail = relative(normalizedRoot, normalizedCandidate);
  if (tail === "" || (!tail.startsWith(`..${sep}`) && tail !== ".." && !isAbsolute(tail))) {
    return normalizedCandidate;
  }
  throw new ImageOperationError(403, "IMAGE_SOURCE_FORBIDDEN");
}

function localImagePath(imageUrl: string, dirs: UserImageDirs) {
  let pathname = imageUrl.split(/[?#]/, 1)[0];
  if (/^https?:\/\//i.test(imageUrl)) {
    try {
      pathname = new URL(imageUrl).pathname;
    } catch {
      throw new ImageOperationError(400, "INVALID_IMAGE_URL");
    }
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new ImageOperationError(400, "INVALID_IMAGE_URL");
  }
  const roots = [
    ["/files/input/", dirs.inputDir],
    ["/input/", dirs.inputDir],
    ["/files/output/", dirs.outputDir],
    ["/output/", dirs.outputDir],
  ] as const;
  for (const [prefix, root] of roots) {
    if (!decoded.startsWith(prefix)) continue;
    const tail = decoded.slice(prefix.length).replace(/^[/\\]+/, "");
    if (!tail) throw new ImageOperationError(404, "IMAGE_SOURCE_NOT_FOUND");
    return assertInside(root, resolve(root, tail));
  }
  throw new ImageOperationError(400, "UNSUPPORTED_IMAGE_SOURCE");
}

async function readImage(imageUrl: unknown, dirs: UserImageDirs) {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    throw new ImageOperationError(400, "IMAGE_URL_REQUIRED");
  }
  const value = imageUrl.trim();
  const data = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (data) return Buffer.from(data[1], "base64");
  try {
    return await readFile(localImagePath(value, dirs));
  } catch (error) {
    if (error instanceof ImageOperationError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ImageOperationError(404, "IMAGE_SOURCE_NOT_FOUND");
    }
    throw error;
  }
}

function normalizeFit(value: unknown): "cover" | "contain" | "fill" | "inside" | "outside" {
  return value === "cover" || value === "contain" || value === "fill" || value === "outside" ? value : "inside";
}

export function createImageOperationService(options: {
  dirs: UserImageDirs;
  onSaved?: (saved: SavedImage, sourceUrl?: string) => Promise<unknown>;
}) {
  const save = async (buffer: Buffer, sourceUrl = "") => {
    await mkdir(options.dirs.outputDir, { recursive: true });
    const filename = `image_op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    await writeFile(resolve(options.dirs.outputDir, filename), buffer);
    const saved: SavedImage = { filename, url: `/files/output/${filename}`, size: buffer.length, mime: "image/png" };
    await options.onSaved?.(saved, sourceUrl);
    return saved.url;
  };

  const load = (value: unknown) => readImage(value, options.dirs);

  return {
    async resize(body: Record<string, unknown>) {
      const width = integer(body.width, 0, 0, 8192) || undefined;
      const height = integer(body.height, 0, 0, 8192) || undefined;
      if (!width && !height) throw new ImageOperationError(400, "IMAGE_SIZE_REQUIRED");
      const sourceUrl = String(body.imageUrl || "");
      const output = await sharp(await load(body.imageUrl))
        .resize(width, height, { fit: normalizeFit(body.fit), withoutEnlargement: false })
        .png({ compressionLevel: 6 })
        .toBuffer();
      return { imageUrl: await save(output, sourceUrl) };
    },

    async upscale(body: Record<string, unknown>) {
      const scale = Math.max(1, Math.min(8, Number(body.scale) || 2));
      const sourceUrl = String(body.imageUrl || "");
      const input = await load(body.imageUrl);
      const metadata = await sharp(input).metadata();
      if (!metadata.width || !metadata.height) throw new ImageOperationError(400, "INVALID_IMAGE_DIMENSIONS");
      const output = await sharp(input)
        .resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale), { kernel: "lanczos3" })
        .png({ compressionLevel: 6 })
        .toBuffer();
      return { imageUrl: await save(output, sourceUrl), scale };
    },

    async crop(body: Record<string, unknown>) {
      const sourceUrl = String(body.imageUrl || "");
      const input = await load(body.imageUrl);
      const metadata = await sharp(input).metadata();
      if (!metadata.width || !metadata.height) throw new ImageOperationError(400, "INVALID_IMAGE_DIMENSIONS");
      const left = integer(body.x, 0, 0, metadata.width - 1);
      const top = integer(body.y, 0, 0, metadata.height - 1);
      const width = integer(body.w, metadata.width - left, 1, metadata.width - left);
      const height = integer(body.h, metadata.height - top, 1, metadata.height - top);
      const output = await sharp(input).extract({ left, top, width, height }).png({ compressionLevel: 6 }).toBuffer();
      return { imageUrl: await save(output, sourceUrl) };
    },

    async combine(body: Record<string, unknown>) {
      const urls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
      if (urls.length < 2 || urls.length > 20) throw new ImageOperationError(400, "IMAGE_COUNT_OUT_OF_RANGE");
      const inputs = await Promise.all(urls.map(load));
      const metadata = await Promise.all(inputs.map((input) => sharp(input).metadata()));
      if (metadata.some((item) => !item.width || !item.height)) throw new ImageOperationError(400, "INVALID_IMAGE_DIMENSIONS");
      const vertical = body.direction === "vertical";
      const width = vertical ? Math.max(...metadata.map((item) => item.width!)) : metadata.reduce((sum, item) => sum + item.width!, 0);
      const height = vertical ? metadata.reduce((sum, item) => sum + item.height!, 0) : Math.max(...metadata.map((item) => item.height!));
      let offset = 0;
      const layers = await Promise.all(inputs.map(async (input, index) => {
        const item = metadata[index];
        const layer = { input: await sharp(input).png().toBuffer(), left: vertical ? 0 : offset, top: vertical ? offset : 0 };
        offset += vertical ? item.height! : item.width!;
        return layer;
      }));
      const output = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(layers)
        .png({ compressionLevel: 6 })
        .toBuffer();
      return { imageUrl: await save(output, String(urls[0] || "")) };
    },
  };
}

const OPERATIONS = new Set(["resize", "upscale", "crop", "combine"]);

export async function handleImageOperationRoutes(args: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  currentUser: ImageOperationUser;
  deps: ImageOperationRouteDependencies;
}) {
  const match = /^\/api\/image\/([^/]+)$/.exec(args.url.pathname);
  if (!match || !OPERATIONS.has(match[1])) return false;
  if (args.request.method !== "POST") {
    args.deps.sendJson(args.response, { success: false, error: "METHOD_NOT_ALLOWED" }, 405);
    return true;
  }
  try {
    const body = await args.deps.readJsonBody(args.request);
    const service = createImageOperationService({
      dirs: args.deps.userDataDirs(args.currentUser),
      onSaved: (saved, sourceUrl) => args.deps.registerOutput(args.currentUser, saved, sourceUrl),
    });
    const operation = match[1] as keyof typeof service;
    args.deps.sendJson(args.response, { success: true, data: await service[operation](body) });
  } catch (error) {
    const statusCode = error instanceof ImageOperationError ? error.statusCode : 500;
    const message = error instanceof ImageOperationError ? error.message : "IMAGE_OPERATION_FAILED";
    args.deps.sendJson(args.response, { success: false, error: message }, statusCode);
  }
  return true;
}
