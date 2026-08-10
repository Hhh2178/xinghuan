export type ProviderPublicOriginEnvironment = "local" | "gray" | "production";

export class ProviderPublicOriginError extends Error {
  constructor(message = "LLM_MEDIA_PUBLIC_ORIGIN_INVALID") {
    super(message);
  }
}

export function resolveProviderPublicOrigin(input: {
  environment: ProviderPublicOriginEnvironment;
  configuredOrigin?: string;
  requestOrigin?: string;
}) {
  const configured = normalizeOrigin(input.configuredOrigin);
  if (input.environment !== "local") {
    if (!configured || !configured.startsWith("https://")) throw new ProviderPublicOriginError();
    return configured;
  }
  if (configured) return configured;
  const requestOrigin = normalizeOrigin(input.requestOrigin);
  if (!requestOrigin) throw new ProviderPublicOriginError();
  return requestOrigin;
}

function normalizeOrigin(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return "";
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "";
  if (parsed.pathname !== "/" && parsed.pathname !== "") return "";
  if (parsed.search || parsed.hash) return "";
  return parsed.origin;
}
