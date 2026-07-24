import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelFeedbackVote, ChannelHealthReport } from "@xinghuan/shared";

import { readChannelHealth, submitChannelFeedback } from "../../services/channel-health-api";
import { manualRefreshCoolingDown, msUntilNextWholeHour, shouldRefreshOnVisibility } from "./channel-health-refresh";

export function useChannelHealth(open: boolean) {
  const [report, setReport] = useState<ChannelHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(0);
  const [manualCooldownUntil, setManualCooldownUntil] = useState(0);
  const [votingModelKey, setVotingModelKey] = useState("");
  const etagRef = useRef("");
  const lastManualAtRef = useRef(0);
  const reportRef = useRef<ChannelHealthReport | null>(null);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  const refresh = useCallback(async (manual = false) => {
    const currentNow = Date.now();
    if (manual && manualRefreshCoolingDown({ lastManualAt: lastManualAtRef.current, now: currentNow })) return false;
    if (manual) {
      lastManualAtRef.current = currentNow;
      setManualCooldownUntil(currentNow + 10_000);
      window.setTimeout(() => setManualCooldownUntil(0), 10_000);
    }
    if (!reportRef.current) setLoading(true);
    setRefreshing(Boolean(reportRef.current));
    try {
      const result = await readChannelHealth(etagRef.current);
      if (result.kind === "fresh") {
        setReport(result.report);
        etagRef.current = result.etag;
      }
      setError("");
      setStale(false);
      setLastLoadedAt(Date.now());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStale(Boolean(reportRef.current));
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const vote = useCallback(async (providerId: string, modelId: string, nextVote: ChannelFeedbackVote) => {
    const key = `${providerId}::${modelId}`;
    setVotingModelKey(key);
    try {
      const result = await submitChannelFeedback({ providerId, modelId, vote: nextVote });
      setReport(result.report);
      etagRef.current = result.etag;
      setError("");
      setStale(false);
      setLastLoadedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setVotingModelKey("");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") await refresh();
        schedule();
      }, msUntilNextWholeHour(Date.now()));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && shouldRefreshOnVisibility({ lastLoadedAt, now: Date.now() })) void refresh();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [lastLoadedAt, open, refresh]);

  return { report, loading, refreshing, error, stale, lastLoadedAt, manualCooldownUntil, votingModelKey, refresh, vote };
}
