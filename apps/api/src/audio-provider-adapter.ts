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
    else if (/^[A-Za-z0-9+/=]+$/.test(item) && item.length > 100) audioDataUrls.push(`data:audio/wav;base64,${item}`);
    else if (/^https?:\/\//i.test(item)) audioUrls.push(item);
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
