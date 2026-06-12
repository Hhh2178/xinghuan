export interface AudioProviderPayloadInput {
  modelId: string;
  text: string;
  stylePrompt?: string;
  voice?: string;
  audioFormat?: string;
  mode?: string;
  sampleDataUrl?: string;
}

export interface AudioProviderResult {
  audioDataUrls: string[];
  audioUrls: string[];
  text: string;
  raw: unknown;
}

export function createOpenAiAudioChatPayload(input: AudioProviderPayloadInput) {
  const audioFormat = safeAudioFormat(input.audioFormat);
  const mode = String(input.mode || "tts").trim().toLowerCase();
  if (mode === "voice_design" && !String(input.stylePrompt || "").trim()) {
    throw new Error("音色定制需要填写音色描述");
  }
  const audio: { format: string; voice?: string } = { format: audioFormat };
  if (mode === "voice_clone") {
    audio.voice = requireVoiceCloneSample(input.sampleDataUrl);
  } else if (mode !== "voice_design") {
    audio.voice = String(input.voice || "mimo_default").trim();
  }
  return {
    model: input.modelId,
    messages: [
      { role: "user", content: String(input.stylePrompt || "").trim() },
      { role: "assistant", content: String(input.text || "").trim() },
    ],
    audio,
  };
}

function requireVoiceCloneSample(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("音色克隆需要参考音频样本");
  if (!/^data:audio\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+$/i.test(raw)) {
    throw new Error("音色克隆参考音频必须是完整的 DataURL");
  }
  return raw.replace(/\s+/g, "");
}

export function extractAudioProviderResult(raw: unknown): AudioProviderResult {
  const audioDataUrls: string[] = [];
  const audioUrls: string[] = [];
  const text = readStringAtPath(raw, "choices.0.message.content") || readStringAtPath(raw, "text");
  const candidates = [
    readStringAtPath(raw, "choices.0.message.audio.data"),
    readStringAtPath(raw, "choices.0.message.audio.url"),
    readStringAtPath(raw, "audio.data"),
    readStringAtPath(raw, "audio.url"),
    readStringAtPath(raw, "data.audio"),
    readStringAtPath(raw, "data.url"),
    readStringAtPath(raw, "url"),
  ].filter(Boolean);
  for (const item of candidates) {
    if (/^data:audio\//i.test(item)) audioDataUrls.push(item);
    else if (/^https?:\/\//i.test(item)) audioUrls.push(item);
    else {
      const inferredMime = inferAudioMimeFromBase64(item);
      if (inferredMime) audioDataUrls.push(`data:${inferredMime};base64,${normalizeBase64(item)}`);
    }
  }
  return { audioDataUrls, audioUrls, text, raw };
}

function safeAudioFormat(value: unknown) {
  const text = String(value || "wav").trim().toLowerCase();
  return ["wav", "mp3", "pcm16"].includes(text) ? text : "wav";
}

function readStringAtPath(source: unknown, path: string): string {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current == null) return "";
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(current)) return "";
      current = current[Number(part)];
      continue;
    }
    if (typeof current !== "object" || Array.isArray(current)) return "";
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current.trim() : "";
}

function normalizeBase64(value: string) {
  return value.replace(/\s+/g, "");
}

function inferAudioMimeFromBase64(value: string) {
  const normalized = normalizeBase64(value);
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized) || normalized.length <= 100) return "";
  try {
    const buffer = Buffer.from(normalized, "base64");
    if (buffer.length < 4) return "";
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") {
      return "audio/wav";
    }
    if (buffer.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg";
    if (buffer.subarray(0, 3).toString("ascii") === "ID3") return "audio/mpeg";
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "audio/mpeg";
    if (buffer.subarray(4, 8).toString("ascii") === "ftyp") return "audio/mp4";
    return "";
  } catch {
    return "";
  }
}
