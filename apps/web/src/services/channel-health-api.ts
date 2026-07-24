import type { ChannelFeedbackVote, ChannelHealthReport } from "@xinghuan/shared";

import { ApiError } from "./api";

const BASE = "/api";

export type ChannelHealthReadResult =
  | { kind: "fresh"; report: ChannelHealthReport; etag: string }
  | { kind: "not_modified"; etag: string };

export async function readChannelHealth(etag = ""): Promise<ChannelHealthReadResult> {
  const response = await fetch(`${BASE}/channel-health`, {
    credentials: "same-origin",
    headers: etag ? { "If-None-Match": etag } : undefined,
  });
  if (response.status === 304) return { kind: "not_modified", etag: response.headers.get("etag") || etag };
  const payload = await readPayload<ChannelHealthReport>(response);
  return { kind: "fresh", report: payload, etag: response.headers.get("etag") || "" };
}

export async function submitChannelFeedback(input: {
  providerId: string;
  modelId: string;
  vote: ChannelFeedbackVote;
}): Promise<{ report: ChannelHealthReport; etag: string }> {
  const response = await fetch(`${BASE}/channel-health/feedback`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return { report: await readPayload<ChannelHealthReport>(response), etag: response.headers.get("etag") || "" };
}

async function readPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok || payload?.success === false) throw new ApiError(response.status, payload?.error || `HTTP ${response.status}`, payload);
  return payload.data as T;
}
