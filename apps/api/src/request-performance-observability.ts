import { performance } from "node:perf_hooks";

export interface RequestPerformanceSample {
  routeId: string;
  durationMs: number;
  dbDurationMs: number;
  dbQueryCount: number;
  responseBytes: number;
  cacheState: "none" | "hit" | "miss" | "revalidated";
  statusCode: number;
}

export interface RequestPerformanceTracker {
  finish(input?: Partial<Omit<RequestPerformanceSample, "routeId" | "durationMs">>): RequestPerformanceSample;
}

export interface RequestPerformanceSnapshot {
  generatedAt: number;
  sampleCount: number;
  routes: Record<string, {
    count: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    responseBytesP95: number;
    errorRate: number;
  }>;
}

const DEFAULT_SAMPLE: Omit<RequestPerformanceSample, "routeId" | "durationMs"> = {
  dbDurationMs: 0,
  dbQueryCount: 0,
  responseBytes: 0,
  cacheState: "none",
  statusCode: 200,
};

export function createRequestPerformanceObservability(options: { maxSamples?: number } = {}) {
  const maxSamples = Math.max(100, Math.min(10_000, Math.trunc(options.maxSamples ?? 2_000)));
  const samples: RequestPerformanceSample[] = [];

  return {
    start(routeId: string): RequestPerformanceTracker {
      const normalizedRouteId = normalizeRouteId(routeId);
      const startedAt = performance.now();
      let finished = false;
      let completed: RequestPerformanceSample | undefined;
      return {
        finish(input = {}) {
          if (finished) {
            return completed || {
              routeId: normalizedRouteId,
              durationMs: 0,
              ...DEFAULT_SAMPLE,
            };
          }
          finished = true;
          const sample: RequestPerformanceSample = {
            routeId: normalizedRouteId,
            durationMs: roundDuration(performance.now() - startedAt),
            ...DEFAULT_SAMPLE,
            ...input,
          };
          completed = sample;
          samples.push(sample);
          if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples);
          return sample;
        },
      };
    },
    snapshot(): RequestPerformanceSnapshot {
      const grouped = new Map<string, RequestPerformanceSample[]>();
      for (const sample of samples) {
        const list = grouped.get(sample.routeId) || [];
        list.push(sample);
        grouped.set(sample.routeId, list);
      }
      const routes: RequestPerformanceSnapshot["routes"] = {};
      for (const [routeId, routeSamples] of grouped) {
        const durations = routeSamples.map((item) => item.durationMs).sort((a, b) => a - b);
        const responseBytes = routeSamples.map((item) => item.responseBytes).sort((a, b) => a - b);
        routes[routeId] = {
          count: routeSamples.length,
          p50Ms: percentile(durations, 0.5),
          p95Ms: percentile(durations, 0.95),
          p99Ms: percentile(durations, 0.99),
          responseBytesP95: percentile(responseBytes, 0.95),
          errorRate: routeSamples.filter((item) => item.statusCode >= 500).length / routeSamples.length,
        };
      }
      return { generatedAt: Date.now(), sampleCount: samples.length, routes };
    },
  };
}

export function normalizeRouteId(value: unknown) {
  const normalized = String(value || "unknown").trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-");
  return normalized
    .replace(/\/(?:\d+|[a-f0-9]{8,}|(?:task|user|provider|canvas|resource|run|group|session|model|job|artifact|catalog)-[a-z0-9_-]+)(?=\/|$)/g, "/:id")
    .slice(0, 120) || "unknown";
}

export function responseByteLength(payload: unknown) {
  return Buffer.byteLength(JSON.stringify(payload));
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)] || 0;
}

function roundDuration(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}
