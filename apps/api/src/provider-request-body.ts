export function isMultipartRequestBodyMode(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "multipart"
    || normalized === "multipart_form_data"
    || normalized === "multipart/form-data";
}

export async function buildProviderMultipartRequestBody(
  payload: Record<string, unknown>,
  fileFieldNamesValue: unknown,
) {
  const form = new FormData();
  const fileFieldNames = new Set(normalizeStringList(fileFieldNamesValue));
  for (const [key, value] of Object.entries(payload || {})) {
    if (value === undefined || value === null) continue;
    if (fileFieldNames.has(key)) {
      await appendMultipartFileField(form, key, value);
      continue;
    }
    appendScalarField(form, key, value);
  }
  return form;
}

async function appendMultipartFileField(form: FormData, field: string, value: unknown) {
  const entries = Array.isArray(value) ? value : [value];
  let ordinal = 0;
  for (const entry of entries) {
    const source = String(entry || "").trim();
    if (!source) continue;
    ordinal += 1;
    const file = await readMultipartFile(source, field, ordinal);
    form.append(field, file.blob, file.filename);
  }
}

async function readMultipartFile(source: string, field: string, ordinal: number) {
  if (/^data:/i.test(source)) {
    return dataUrlFile(source, field, ordinal);
  }
  const response = await fetch(source, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`素材下载失败 ${response.status}: ${source}`);
  const mime = safeMimeType(response.headers.get("content-type"));
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    blob: new Blob([buffer], { type: mime || "application/octet-stream" }),
    filename: inferFilename(source, mime, field, ordinal),
  };
}

function dataUrlFile(source: string, field: string, ordinal: number) {
  const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (!match) throw new Error(`不支持的数据 URL: ${field}`);
  const mime = safeMimeType(match[1]) || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = isBase64 ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return {
    blob: new Blob([payload], { type: mime }),
    filename: inferFilename("", mime, field, ordinal),
  };
}

function appendScalarField(form: FormData, field: string, value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) appendScalarField(form, field, item);
    return;
  }
  if (typeof value === "string") {
    if (value.trim()) form.append(field, value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    form.append(field, String(value));
    return;
  }
  if (value && typeof value === "object") {
    form.append(field, JSON.stringify(value));
  }
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = String(item || "").trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function safeMimeType(value: string | null) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function inferFilename(source: string, mime: string, field: string, ordinal: number) {
  const extension = extensionFromMime(mime);
  try {
    const url = new URL(source);
    const fromPath = decodeURIComponent(url.pathname.split("/").pop() || "").trim();
    if (fromPath && /\.[a-z0-9]{2,8}$/i.test(fromPath)) return fromPath;
  } catch {
    // ignore malformed URL here; the fetch step already validated it
  }
  return `${field}-${ordinal}.${extension}`;
}

function extensionFromMime(mime: string) {
  const lookup: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "application/octet-stream": "bin",
  };
  return lookup[mime] || "bin";
}
