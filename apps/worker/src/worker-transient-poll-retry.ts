export interface TransientPollRetryEvent {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  reason: "http" | "network";
  statusCode?: number;
  error: string;
}

export interface PollResponseWithRetry {
  response: Response;
  text: string;
  retryCount: number;
}

interface FetchPollResponseWithRetryOptions {
  request: () => Promise<Response>;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  deadlineAt?: number;
  random?: () => number;
  now?: () => number;
  wait?: (delayMs: number) => Promise<void>;
  onRetry?: (event: TransientPollRetryEvent) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 1500;
const DEFAULT_MAX_DELAY_MS = 15000;

export async function fetchPollResponseWithRetry(
  options: FetchPollResponseWithRetryOptions,
): Promise<PollResponseWithRetry> {
  const maxRetries = clampInteger(options.maxRetries, 0, 8, DEFAULT_MAX_RETRIES);
  const baseDelayMs = clampInteger(options.baseDelayMs, 0, 30000, DEFAULT_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, clampInteger(options.maxDelayMs, 0, 60000, DEFAULT_MAX_DELAY_MS));
  const random = options.random || Math.random;
  const now = options.now || Date.now;
  const wait = options.wait || waitFor;
  let retryCount = 0;

  for (;;) {
    let response: Response;
    let text: string;
    try {
      response = await options.request();
      text = await response.text();
    } catch (error) {
      if (retryCount >= maxRetries) throw error;
      const nextAttempt = retryCount + 1;
      const delayMs = retryDelayMs({
        attempt: nextAttempt,
        baseDelayMs,
        maxDelayMs,
        random,
      });
      if (!hasRetryBudget(options.deadlineAt, delayMs, now)) throw error;
      retryCount = nextAttempt;
      await options.onRetry?.({
        attempt: retryCount,
        maxRetries,
        delayMs,
        reason: "network",
        error: safeErrorText(error),
      });
      await wait(delayMs);
      continue;
    }
    if (!isTransientPollStatus(response.status) || retryCount >= maxRetries) {
      return { response, text, retryCount };
    }
    const nextAttempt = retryCount + 1;
    const delayMs = retryDelayMs({
      attempt: nextAttempt,
      baseDelayMs,
      maxDelayMs,
      random,
      retryAfter: response.headers.get("retry-after"),
    });
    if (!hasRetryBudget(options.deadlineAt, delayMs, now)) {
      return { response, text, retryCount };
    }
    retryCount = nextAttempt;
    await options.onRetry?.({
      attempt: retryCount,
      maxRetries,
      delayMs,
      reason: "http",
      statusCode: response.status,
      error: `HTTP ${response.status}`,
    });
    await wait(delayMs);
  }
}

function hasRetryBudget(deadlineAt: number | undefined, delayMs: number, now: () => number) {
  return !Number.isFinite(deadlineAt) || now() + delayMs <= Number(deadlineAt);
}

export function isTransientPollStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function retryDelayMs(input: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  random: () => number;
  retryAfter?: string | null;
}) {
  const retryAfterMs = parseRetryAfterMs(input.retryAfter);
  if (typeof retryAfterMs === "number") return Math.min(input.maxDelayMs, retryAfterMs);
  const exponential = Math.min(input.maxDelayMs, input.baseDelayMs * (2 ** Math.max(0, input.attempt - 1)));
  const randomValue = Math.max(0, Math.min(1, Number(input.random()) || 0));
  const jittered = exponential * (0.8 + randomValue * 0.4);
  return Math.min(input.maxDelayMs, Math.max(0, Math.round(jittered)));
}

function parseRetryAfterMs(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function safeErrorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "network error"))
    .replace(/(https?:\/\/[^\s?#]+(?:\/[^\s?#]*)?)\?[^\s]*/gi, "$1?[redacted]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, "$1[redacted]")
    .replace(/\b((?:api[_-]?key|token|secret|sig)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 300);
}

function waitFor(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
