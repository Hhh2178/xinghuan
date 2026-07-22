export interface AuditConflictCounts {
  totalLast24h: number;
  totalLast7d: number;
  totalLast30d: number;
  distinctTargetsLast24h: number;
  distinctActorsLast24h: number;
  canvasRevisionLast24h: number;
  resourceRevisionLast24h: number;
  adminSettingsRevisionLast24h: number;
}

export function decorateAuditConflictSummary(conflicts: AuditConflictCounts) {
  const total7dDailyAverageBaseline = round(conflicts.totalLast7d / 7);
  const total30dDailyAverageBaseline = round(conflicts.totalLast30d / 30);
  const baselineCount = Math.max(total7dDailyAverageBaseline, total30dDailyAverageBaseline);
  const warningThresholdCount = Math.max(5, round(baselineCount * 1.25));
  const criticalThresholdCount = Math.max(20, round(baselineCount * 2));
  const health = evaluateConflictHealth({
    ...conflicts,
    baselineCount,
    warningThresholdCount,
    criticalThresholdCount,
  });

  return {
    ...conflicts,
    health,
    trend: {
      total7dDailyAverageBaseline,
      total30dDailyAverageBaseline,
      total24hVs7dDailyAverage: round(conflicts.totalLast24h - total7dDailyAverageBaseline),
      total24hVs30dDailyAverage: round(conflicts.totalLast24h - total30dDailyAverageBaseline),
    },
  };
}

function evaluateConflictHealth(input: AuditConflictCounts & {
  baselineCount: number;
  warningThresholdCount: number;
  criticalThresholdCount: number;
}) {
  const shared = {
    baselineCount: input.baselineCount,
    warningThresholdCount: input.warningThresholdCount,
    criticalThresholdCount: input.criticalThresholdCount,
  };
  if (input.totalLast24h === 0) {
    return {
      ...shared,
      status: "healthy" as const,
      reason: "no_conflicts" as const,
      summary: "24h 内未观察到 revision conflict",
    };
  }
  if (
    input.totalLast24h >= input.criticalThresholdCount
    && input.distinctTargetsLast24h >= 3
  ) {
    return {
      ...shared,
      status: "critical" as const,
      reason: "baseline_regression" as const,
      summary: `24h 有 ${input.totalLast24h} 次 revision conflict，达到严重阈值 ${input.criticalThresholdCount} 次，影响 ${input.distinctTargetsLast24h} 个对象`,
    };
  }
  return {
    ...shared,
    status: "warning" as const,
    reason: input.totalLast24h >= input.warningThresholdCount ? "above_baseline" as const : "conflicts_observed" as const,
    summary: `24h 有 ${input.totalLast24h} 次 revision conflict，影响 ${input.distinctTargetsLast24h} 个对象；7d 日均 ${round(input.totalLast7d / 7)} 次`,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
