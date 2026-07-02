export interface ComfyuiProbeResult {
  health: "online" | "offline" | "degraded";
  capabilities: string[];
  objectInfo?: Record<string, unknown>;
  systemStats?: Record<string, unknown>;
  queue?: Record<string, unknown>;
  error?: string;
}

function joinComfyuiUrl(baseUrl: string, pathname: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ""), normalizedBase).toString();
}

async function fetchJson(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
) {
  const response = await fetch(joinComfyuiUrl(baseUrl, pathname), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`ComfyUI ${pathname} 请求失败: ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export async function fetchComfyuiObjectInfo(baseUrl: string) {
  return fetchJson(baseUrl, "/object_info");
}

export async function fetchComfyuiSystemStats(baseUrl: string) {
  return fetchJson(baseUrl, "/system_stats");
}

export async function fetchComfyuiQueue(baseUrl: string) {
  return fetchJson(baseUrl, "/queue");
}

export async function submitComfyuiPrompt(
  baseUrl: string,
  prompt: Record<string, unknown>,
) {
  return fetchJson(baseUrl, "/prompt", {
    method: "POST",
    body: JSON.stringify(prompt),
  });
}

function hasNodeClass(classNames: string[], matcher: RegExp) {
  return classNames.some((name) => matcher.test(name));
}

export function inferComfyuiCapabilities(objectInfo: Record<string, unknown>) {
  const classNames = Object.keys(objectInfo || {});
  const capabilities = ["workflow", "image.generate"];
  if (hasNodeClass(classNames, /(video|vhs|wan|savevideo)/i))
    capabilities.push("video.generate");
  if (hasNodeClass(classNames, /(audio|saveaudio)/i))
    capabilities.push("audio.generate");
  if (hasNodeClass(classNames, /(loadimage|imageinput)/i))
    capabilities.push("image.input");
  if (hasNodeClass(classNames, /(loadvideo|videoinput|vhs)/i))
    capabilities.push("video.input");
  if (hasNodeClass(classNames, /(loadaudio|audioinput)/i))
    capabilities.push("audio.input");
  return Array.from(new Set(capabilities));
}

export async function probeComfyuiInstance(
  baseUrl: string,
): Promise<ComfyuiProbeResult> {
  try {
    const [objectInfo, systemStats, queue] = await Promise.all([
      fetchComfyuiObjectInfo(baseUrl),
      fetchComfyuiSystemStats(baseUrl),
      fetchComfyuiQueue(baseUrl),
    ]);
    return {
      health: "online",
      capabilities: inferComfyuiCapabilities(objectInfo),
      objectInfo,
      systemStats,
      queue,
    };
  } catch (error) {
    return {
      health: "degraded",
      capabilities: ["workflow"],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
