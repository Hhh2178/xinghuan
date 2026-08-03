export interface AssistantContextAttachment {
  kind?: string;
  payload?: Record<string, unknown>;
}

export type AssistantModelContent = string | Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "auto" } }
>;

export function buildAssistantUserMessageContent(prompt: string, attachments: AssistantContextAttachment[]): AssistantModelContent {
  const imageParts = attachments
    .filter((item) => item.kind === "image")
    .map((item) => {
      const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
      return typeof payload.url === "string" && payload.url.trim()
        ? payload.url.trim()
        : typeof payload.sourceUrl === "string" && payload.sourceUrl.trim()
          ? payload.sourceUrl.trim()
          : "";
    })
    .filter((url) => /^(data:image\/|https?:\/\/|\/files\/|\/input\/|\/output\/)/i.test(url))
    .slice(0, 4)
    .map((url) => ({ type: "image_url" as const, image_url: { url, detail: "auto" as const } }));

  return imageParts.length > 0 ? [{ type: "text", text: prompt }, ...imageParts] : prompt;
}
