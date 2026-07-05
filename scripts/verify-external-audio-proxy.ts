import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createOpenAiAudioChatPayload,
  extractAudioProviderResult,
} from "../apps/api/src/audio-provider-adapter.js";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const externalProxySource = readFileSync(join(root, "apps", "api", "src", "external-proxy.ts"), "utf8");
const generationSource = readFileSync(join(root, "apps", "web", "src", "services", "generation.ts"), "utf8");
const audioNodeSource = readFileSync(join(root, "apps", "web", "src", "components", "nodes", "AudioNode.tsx"), "utf8");
const apiSource = readFileSync(join(root, "apps", "web", "src", "services", "api.ts"), "utf8");

const sampleAudio = `data:audio/wav;base64,${Buffer.from("fake wav bytes").toString("base64")}`;
const ttsPayload = createOpenAiAudioChatPayload({
  modelId: "mimo-v2.5-tts",
  text: "星幻画布音频链路验证",
  stylePrompt: "自然、清晰、稳定",
  voice: "mimo_default",
  audioFormat: "wav",
  mode: "tts",
});
const clonePayload = createOpenAiAudioChatPayload({
  modelId: "mimo-v2.5-tts-voiceclone",
  text: "克隆音色验证",
  stylePrompt: "保留原始音色",
  sampleDataUrl: sampleAudio,
  audioFormat: "mp3",
  mode: "voice_clone",
});
const voiceDesignPayload = createOpenAiAudioChatPayload({
  modelId: "mimo-v2.5-tts-voicedesign",
  text: "音色定制验证",
  stylePrompt: "清亮、轻快、略带气声的少女感声音",
  voice: "mimo_default",
  audioFormat: "wav",
  mode: "voice_design",
});
const parsedInline = extractAudioProviderResult({
  choices: [
    {
      message: {
        content: "ok",
        audio: { data: sampleAudio },
      },
    },
  ],
});
const parsedRemote = extractAudioProviderResult({ data: { url: "https://example.com/audio.wav" } });

const checks = [
  {
    name: "MiMo TTS payload follows OpenAI audio chat shape",
    pass:
      ttsPayload.model === "mimo-v2.5-tts" &&
      ttsPayload.audio.format === "wav" &&
      ttsPayload.audio.voice === "mimo_default" &&
      ttsPayload.messages[0]?.role === "user" &&
      ttsPayload.messages[1]?.role === "assistant",
  },
  {
    name: "MiMo voice clone payload keeps full data url sample for clone model",
    pass:
      clonePayload.model === "mimo-v2.5-tts-voiceclone" &&
      clonePayload.audio.format === "mp3" &&
      clonePayload.audio.voice === sampleAudio,
  },
  {
    name: "MiMo voice design payload omits unsupported audio voice",
    pass:
      voiceDesignPayload.model === "mimo-v2.5-tts-voicedesign" &&
      voiceDesignPayload.audio.format === "wav" &&
      !("voice" in voiceDesignPayload.audio),
  },
  {
    name: "external proxy preserves full voice clone data URLs",
    pass:
      externalProxySource.includes("readAudioSampleDataUrl") &&
      !externalProxySource.includes("deps.safeText(body.sampleDataUrl"),
  },
  {
    name: "audio parser extracts inline data URLs and remote URLs",
    pass:
      parsedInline.audioDataUrls[0] === sampleAudio &&
      parsedInline.text === "ok" &&
      parsedRemote.audioUrls[0] === "https://example.com/audio.wav",
  },
  {
    name: "server exposes external audio route and storage helpers",
    pass:
      serverSource.includes('/api/proxy/external/audio') &&
      serverSource.includes("saveRemoteAudioToOutput") &&
      serverSource.includes("saveBase64AudioFile"),
  },
  {
    name: "external proxy registers generateExternalAudioProxy",
    pass:
      externalProxySource.includes("generateExternalAudioProxy") &&
      externalProxySource.includes("createOpenAiAudioChatPayload") &&
      externalProxySource.includes("extractAudioProviderResult"),
  },
  {
    name: "web generation service exposes generateExternalAudio",
    pass:
      generationSource.includes("GenerateExternalAudioRequest") &&
      generationSource.includes("generateExternalAudio") &&
      generationSource.includes('/api/proxy/external/audio'),
  },
  {
    name: "public model catalog exposes audio models to canvas",
    pass: apiSource.includes("audioModels: PublicModelRecord[]") && apiSource.includes("'audio'"),
  },
  {
    name: "audio node supports provider TTS and voice clone modes",
    pass:
      audioNodeSource.includes("Provider 语音") &&
      (audioNodeSource.includes("generateExternalAudio") || audioNodeSource.includes("submitExternalAudioTask")) &&
      audioNodeSource.includes("providerAudioMode") &&
      audioNodeSource.includes("voice_clone") &&
      audioNodeSource.includes("voice_design"),
  },
  {
    name: "audio node keeps legacy Suno mode isolated",
    pass:
      audioNodeSource.includes("Legacy Suno") &&
      audioNodeSource.includes("audioEngine === 'suno'") &&
      audioNodeSource.includes("submitAudio"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("External audio proxy contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
