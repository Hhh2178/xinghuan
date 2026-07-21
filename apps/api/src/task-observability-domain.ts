export type TaskObservabilityHealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface TaskObservabilityCounts {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  failedLast1h: number;
  failedLast24h: number;
  finalizedLast24h: number;
  failedLast7d: number;
  finalizedLast7d: number;
  failedLast30d: number;
  finalizedLast30d: number;
}

export type SystemHealthRangeKey = "1h" | "24h" | "7d" | "30d";

export function normalizeSystemHealthRange(value: unknown) {
  const key: SystemHealthRangeKey = value === "1h" || value === "7d" || value === "30d" ? value : "24h";
  const config = {
    "1h": { bucket: "minute" as const, durationMs: 60 * 60 * 1000 },
    "24h": { bucket: "hour" as const, durationMs: 24 * 60 * 60 * 1000 },
    "7d": { bucket: "day" as const, durationMs: 7 * 24 * 60 * 60 * 1000 },
    "30d": { bucket: "day" as const, durationMs: 30 * 24 * 60 * 60 * 1000 },
  }[key];
  return { key, ...config };
}

export function evaluateQueueConsistency(input: { databaseQueued: number; redisQueued: number }) {
  const databaseQueued = Math.max(0, Math.round(Number(input.databaseQueued) || 0));
  const redisQueued = Math.max(0, Math.round(Number(input.redisQueued) || 0));
  const mismatch = Math.abs(databaseQueued - redisQueued);
  if (databaseQueued > 0 && redisQueued === 0) {
    return {
      databaseQueued,
      mismatch,
      redisQueued,
      status: "warning" as const,
      summary: `数据库有 ${databaseQueued} 条 queued 任务，但 Redis 队列为空`,
    };
  }
  if (mismatch > 0) {
    return {
      databaseQueued,
      mismatch,
      redisQueued,
      status: "warning" as const,
      summary: `数据库 queued 与 Redis 队列相差 ${mismatch} 条`,
    };
  }
  return {
    databaseQueued,
    mismatch: 0,
    redisQueued,
    status: "healthy" as const,
    summary: "数据库 queued 与 Redis 队列一致",
  };
}

export function decorateTaskObservabilitySummary(summary: TaskObservabilityCounts) {
  const failureRate24hPercent = percent(summary.failedLast24h, summary.finalizedLast24h);
  const failureRate7dPercent = percent(summary.failedLast7d, summary.finalizedLast7d);
  const failureRate30dPercent = percent(summary.failedLast30d, summary.finalizedLast30d);
  const failed24hDailyAverageBaseline = Math.round(summary.failedLast7d / 7);
  const failed30dDailyAverageBaseline = Math.round(summary.failedLast30d / 30);
  const failed7dDailyAverage = Math.round(summary.failedLast7d / 7);
  const criticalThresholdPercent = Math.max(20, round(failureRate7dPercent * 2));
  const warningThresholdPercent = Math.max(5, round(failureRate7dPercent * 1.25));
  const health = taskHealth({
    failedLast24h: summary.failedLast24h,
    failureRate24hPercent,
    sampleSize: summary.finalizedLast24h,
    warningThresholdPercent,
    criticalThresholdPercent,
  });

  return {
    ...summary,
    health: {
      ...health,
      baselinePercent: failureRate7dPercent,
      failureRatePercent: failureRate24hPercent,
      sampleSize: summary.finalizedLast24h,
    },
    trend: {
      failed24hDailyAverageBaseline,
      failed30dDailyAverageBaseline,
      failed24hVs7dDailyAverage: summary.failedLast24h - failed24hDailyAverageBaseline,
      failed24hVs30dDailyAverage: summary.failedLast24h - failed30dDailyAverageBaseline,
      failed7dDailyAverage,
      failed7dVs30dDailyAverage: failed7dDailyAverage - failed30dDailyAverageBaseline,
      failureRate24hPercent,
      failureRate7dPercent,
      failureRate30dPercent,
    },
  };
}

function taskHealth(input: {
  failedLast24h: number;
  failureRate24hPercent: number;
  sampleSize: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
}) {
  if (input.sampleSize < 10) {
    return {
      status: "unknown" as const,
      summary: `24h 已完成样本仅 ${input.sampleSize} 条，暂不足以判断任务健康`,
      reason: "insufficient_sample",
      thresholdPercent: input.warningThresholdPercent,
    };
  }
  if (input.failedLast24h === 0) {
    return {
      status: "healthy" as const,
      summary: "24h 任务失败率为 0%",
      reason: "within_target",
      thresholdPercent: input.warningThresholdPercent,
    };
  }
  if (input.failedLast24h >= 5 && input.failureRate24hPercent >= input.criticalThresholdPercent) {
    return {
      status: "critical" as const,
      summary: `24h 任务失败率 ${input.failureRate24hPercent}%，达到严重阈值 ${input.criticalThresholdPercent}%`,
      reason: "failure_rate_critical",
      thresholdPercent: input.criticalThresholdPercent,
    };
  }
  return {
    status: "warning" as const,
    summary: `24h 有 ${input.failedLast24h} 条失败任务，失败率 ${input.failureRate24hPercent}%`,
    reason: input.failureRate24hPercent >= input.warningThresholdPercent ? "failure_rate_warning" : "failures_observed",
    thresholdPercent: input.warningThresholdPercent,
  };
}

function percent(part: number, total: number) {
  return total > 0 ? round((part / total) * 100) : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
