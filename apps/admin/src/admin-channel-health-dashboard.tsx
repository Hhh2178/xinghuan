import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChannelHealthReportView } from "@xinghuan/ui";
import type { ChannelHealthCapability, ChannelHealthReport } from "@xinghuan/shared";

import { adminChannelHealthApi } from "./admin-api-client";
import { shouldRunChannelHealthAutoRefresh } from "./admin-channel-health-refresh";
import "./admin-channel-health-dashboard.css";

type FilterState = {
  capability: "" | ChannelHealthCapability;
  providerId: string;
  modelRecordId: string;
};

const INITIAL_FILTERS: FilterState = { capability: "", providerId: "", modelRecordId: "" };

export function AdminChannelHealthDashboard() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [report, setReport] = useState<ChannelHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const etagRef = useRef("");
  const reportRef = useRef<ChannelHealthReport | null>(null);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  const refresh = useCallback(async () => {
    if (!reportRef.current) setLoading(true);
    setRefreshing(Boolean(reportRef.current));
    try {
      const result = await adminChannelHealthApi.readReport({
        capability: filters.capability || undefined,
        providerId: filters.providerId || undefined,
        modelRecordId: filters.modelRecordId || undefined,
      }, etagRef.current);
      if (result.kind === "fresh") {
        setReport(result.report);
        etagRef.current = result.etag;
      }
      setError("");
      setStale(false);
      setLastLoadedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStale(Boolean(reportRef.current));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    etagRef.current = "";
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      if (shouldRunChannelHealthAutoRefresh({ enabled: autoRefresh, visibilityState: document.visibilityState })) void refresh();
    }, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  const providers = report?.providers || [];
  const selectedProvider = providers.find((provider) => provider.id === filters.providerId);
  const models = selectedProvider?.models || providers.flatMap((provider) => provider.models);

  function changeFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "capability" || key === "providerId") next.modelRecordId = "";
      return next;
    });
  }

  return (
    <section className="admin-channel-health" aria-label="渠道与模型健康度">
      <header className="api-card admin-channel-health__header">
        <div>
          <p>Provider / Model Reliability</p>
          <h2>渠道健康</h2>
          <span>近三天，每两小时仅统计已成功或失败的请求。</span>
        </div>
        <div className="admin-channel-health__actions">
          <span>{lastLoadedAt ? `更新于 ${new Date(lastLoadedAt).toLocaleString("zh-CN", { hour12: false })}` : "等待首次同步"}</span>
          <button type="button" className="starlight-button" onClick={() => void refresh()} disabled={loading || refreshing}>
            <RefreshCw size={15} className={refreshing ? "is-spinning" : undefined} />刷新状态
          </button>
        </div>
      </header>

      <section className="api-card admin-channel-health__filters" aria-label="渠道健康筛选">
        <label><span>能力</span><select value={filters.capability} onChange={(event) => changeFilter("capability", event.target.value as FilterState["capability"])}><option value="">全部能力</option><option value="image">图像</option><option value="video">视频</option><option value="audio">音频</option><option value="chat">LLM</option></select></label>
        <label><span>服务商</span><select value={filters.providerId} onChange={(event) => changeFilter("providerId", event.target.value)}><option value="">全部服务商</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label><span>模型</span><select value={filters.modelRecordId} onChange={(event) => changeFilter("modelRecordId", event.target.value)}><option value="">全部模型</option>{models.map((model) => <option key={model.modelRecordId} value={model.modelRecordId}>{model.displayName}</option>)}</select></label>
        <label className="admin-channel-health__auto"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /><span>每 5 分钟自动刷新</span><small>默认关闭</small></label>
      </section>

      {error ? <div className="admin-channel-health__error" role="alert">{stale ? "显示上次成功数据：" : ""}{error}</div> : null}
      {loading && !report ? <div className="starlight-page-loading">正在汇总渠道状态...</div> : null}
      {report ? <section className="admin-channel-health__report-shell" aria-label="渠道健康报告">
        <ChannelHealthReportView
          report={report}
          selectedCapability={filters.capability || "image"}
          onSelectedCapabilityChange={(capability) => changeFilter("capability", capability)}
          interactiveFeedback={false}
          surface="admin"
          className="admin-channel-health__report"
        />
      </section> : null}
    </section>
  );
}
