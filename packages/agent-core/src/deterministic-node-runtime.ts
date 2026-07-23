import { splitText, type TextSplitOptions } from "@xinghuan/shared";

export const NATIVE_DETERMINISTIC_NODE_TYPES = new Set([
  "text",
  "upload",
  "material-set",
  "pick-from-set",
  "relay",
  "output",
  "text-split",
  "workflow-input",
  "workflow-output",
]);

type OutputBinding = Record<string, unknown>;

export function executeDeterministicNode(input: {
  nodeType: string;
  configuration: Record<string, unknown>;
  upstreamOutputs: OutputBinding[];
}): OutputBinding {
  const payload = record(input.configuration.executionPayload);
  if (input.nodeType === "text") return textNodeOutput(payload);
  if (input.nodeType === "upload") return uploadNodeOutput(payload);
  if (input.nodeType === "material-set") return materialSetNodeOutput(payload, input.upstreamOutputs);
  if (input.nodeType === "pick-from-set") return pickFromSetNodeOutput(payload, input.upstreamOutputs);
  if (input.nodeType === "text-split") return textSplitNodeOutput(payload, input.upstreamOutputs);
  if (input.nodeType === "relay" || input.nodeType === "output" || input.nodeType === "workflow-input" || input.nodeType === "workflow-output") {
    return mergeOutputBindings([...input.upstreamOutputs, payload]);
  }
  throw new Error(`CANVAS_RUN_DETERMINISTIC_NODE_UNSUPPORTED:${input.nodeType}`);
}

export function mergeOutputBindings(outputs: OutputBinding[]) {
  const images = values(outputs, ["imageUrl", "imageUrls", "images", "urls", "generatedImages"]);
  const videos = values(outputs, ["videoUrl", "videoUrls", "videos"]);
  const audios = values(outputs, ["audioUrl", "audioUrls", "audios"]);
  const texts = values(outputs, ["outputText", "content", "reply", "prompt", "text", "textSegments", "segments", "texts"]);
  const result: OutputBinding = {};
  if (images.length) {
    result.imageUrl = images[0];
    result.imageUrls = images;
    result.images = images;
  }
  if (videos.length) {
    result.videoUrl = videos[0];
    result.videoUrls = videos;
    result.videos = videos;
  }
  if (audios.length) {
    result.audioUrl = audios[0];
    result.audioUrls = audios;
    result.audios = audios;
  }
  if (texts.length) {
    result.text = texts.join("\n\n");
    result.prompt = result.text;
    result.outputText = result.text;
    result.textSegments = texts;
  }
  return result;
}

function textNodeOutput(payload: OutputBinding) {
  const text = firstText(payload, ["prompt", "text", "outputText"]);
  if (!text) throw new Error("TEXT_EMPTY");
  return { text, prompt: text, outputText: text, textSegments: [text] };
}

function uploadNodeOutput(payload: OutputBinding) {
  const output = mergeOutputBindings([payload]);
  if (!hasMaterial(output)) throw new Error("UPLOAD_EMPTY");
  return output;
}

function materialSetNodeOutput(payload: OutputBinding, upstreamOutputs: OutputBinding[]) {
  const kind = materialKind(payload.materialSetKind);
  const configuredItems = Array.isArray(payload.materialSetItems) ? payload.materialSetItems : [];
  const valuesForKind = kind ? materialValues(configuredItems, kind) : [];
  const merged = mergeOutputBindings([...upstreamOutputs, payload]);
  const resolvedKind = kind || firstAvailableKind(merged);
  if (!resolvedKind) throw new Error("MATERIAL_SET_EMPTY");
  const selected = valuesForKind.length > 0 ? valuesForKind : valuesForKindFromOutput(merged, resolvedKind);
  if (selected.length === 0) throw new Error("MATERIAL_SET_EMPTY");
  return materialSetOutput(resolvedKind, selected);
}

function pickFromSetNodeOutput(payload: OutputBinding, upstreamOutputs: OutputBinding[]) {
  const kind = materialKind(payload.pickKind) || "image";
  const index = boundedIndex(payload.pickIndex);
  const merged = mergeOutputBindings([...upstreamOutputs, payload]);
  const candidates = valuesForKindFromOutput(merged, kind);
  if (candidates.length === 0) throw new Error("SET_EMPTY");
  if (index > candidates.length) throw new Error("SET_INDEX_OUT_OF_RANGE");
  const value = candidates[index - 1];
  if (kind === "text") return { pickedKind: kind, pickedIndex: index, pickedValue: value, text: value, prompt: value, outputText: value, textSegments: [value] };
  if (kind === "image") return { pickedKind: kind, pickedIndex: index, pickedValue: value, imageUrl: value, imageUrls: [value], images: [value] };
  if (kind === "video") return { pickedKind: kind, pickedIndex: index, pickedValue: value, videoUrl: value, videoUrls: [value], videos: [value] };
  return { pickedKind: kind, pickedIndex: index, pickedValue: value, audioUrl: value, audioUrls: [value], audios: [value] };
}

function textSplitNodeOutput(payload: OutputBinding, upstreamOutputs: OutputBinding[]) {
  const overrides = Array.isArray(payload.segmentsOverride)
    ? payload.segmentsOverride.map(asText).filter(Boolean)
    : [];
  const preferUpstream = payload.preferUpstream !== false;
  const upstreamText = upstreamOutputs.map(firstTextOutput).filter(Boolean).join("\n\n");
  const configuredText = firstText(payload, ["sourceText", "prompt", "text", "outputText"]);
  const source = preferUpstream && upstreamText ? upstreamText : configuredText || upstreamText;
  if (!source && overrides.length === 0) throw new Error("TEXT_EMPTY");
  const segments = overrides.length > 0 ? overrides : splitText(source, textSplitOptions(payload));
  if (segments.length === 0) throw new Error("TEXT_EMPTY");
  const text = segments.join("\n\n");
  return { text, prompt: text, outputText: text, textSegments: segments, segments };
}

function textSplitOptions(payload: OutputBinding): TextSplitOptions {
  return {
    mode: textSplitMode(payload.splitMode),
    delimiter: asText(payload.delimiter),
    chunkSize: boundedNumber(payload.chunkSize, 1, 5_000),
    regexPattern: asText(payload.regexPattern),
    regexFlags: asText(payload.regexFlags),
    regexStrategy: payload.regexStrategy === "match" ? "match" : "split",
    removeEmpty: payload.removeEmpty !== false,
    trim: payload.trim !== false,
    normalizeSpaces: payload.normalizeSpaces === true,
    stripNumbering: payload.stripNumbering === true,
    prefix: asText(payload.prefix),
    suffix: asText(payload.suffix),
  };
}

function textSplitMode(value: unknown): TextSplitOptions["mode"] {
  return ["paragraph", "line", "custom", "storyboard", "regex", "markdown-heading", "numbered", "char-chunk"].includes(String(value))
    ? String(value) as TextSplitOptions["mode"]
    : "line";
}

function firstTextOutput(output: OutputBinding) {
  return firstText(output, ["outputText", "content", "reply", "prompt", "text"]);
}

function materialSetOutput(kind: MaterialKind, values: string[]) {
  const items = values.map((value, index) => ({ id: `run-${kind}-${index + 1}`, kind, ...(kind === "text" ? { text: value } : { url: value }) }));
  if (kind === "text") return { materialSetKind: kind, materialSetItems: items, text: values.join("\n\n"), prompt: values.join("\n\n"), outputText: values.join("\n\n"), textSegments: values };
  if (kind === "image") return { materialSetKind: kind, materialSetItems: items, imageUrl: values[0], imageUrls: values, images: values, urls: values };
  if (kind === "video") return { materialSetKind: kind, materialSetItems: items, videoUrl: values[0], videoUrls: values, videos: values };
  return { materialSetKind: kind, materialSetItems: items, audioUrl: values[0], audioUrls: values, audios: values };
}

function materialValues(items: unknown[], kind: MaterialKind) {
  return items.flatMap((item) => {
    const value = record(item);
    if (materialKind(value.kind) !== kind) return [];
    const text = kind === "text" ? asText(value.text || value.url) : asText(value.url);
    return text ? [text] : [];
  });
}

function firstAvailableKind(output: OutputBinding): MaterialKind | null {
  return (["image", "video", "audio", "text"] as const).find((kind) => valuesForKindFromOutput(output, kind).length > 0) || null;
}

function valuesForKindFromOutput(output: OutputBinding, kind: MaterialKind) {
  if (kind === "image") return values([output], ["imageUrl", "imageUrls", "images", "urls", "generatedImages"]);
  if (kind === "video") return values([output], ["videoUrl", "videoUrls", "videos"]);
  if (kind === "audio") return values([output], ["audioUrl", "audioUrls", "audios"]);
  return values([output], ["outputText", "content", "reply", "prompt", "text", "textSegments", "segments", "texts"]);
}

function values(outputs: OutputBinding[], keys: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const output of outputs) {
    for (const key of keys) {
      const raw = output[key];
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        const text = asText(value);
        if (text && !seen.has(text)) {
          seen.add(text);
          result.push(text);
        }
      }
    }
  }
  return result;
}

function hasMaterial(output: OutputBinding) {
  return Object.keys(output).length > 0;
}

function firstText(value: OutputBinding, keys: string[]) {
  return values([value], keys)[0] || "";
}

function boundedIndex(value: unknown) {
  const index = Number(value);
  return Number.isFinite(index) ? Math.max(1, Math.min(10_000, Math.floor(index))) : 1;
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : undefined;
}

type MaterialKind = "text" | "image" | "video" | "audio";
function materialKind(value: unknown): MaterialKind | null {
  return value === "text" || value === "image" || value === "video" || value === "audio" ? value : null;
}

function record(value: unknown): OutputBinding {
  return value && typeof value === "object" && !Array.isArray(value) ? value as OutputBinding : {};
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 2_000_000) : "";
}
