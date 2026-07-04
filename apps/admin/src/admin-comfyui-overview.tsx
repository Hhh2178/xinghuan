import { Activity, Plus, RefreshCw, Settings, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { adminComfyuiApi } from "./admin-api-client";
import { AdminWorkspaceBand } from "./admin-common-components";
import type { ComfyuiConnectionTestResult, ComfyuiInstanceHealth, ComfyuiInstanceRecord } from "./admin-types";

interface ComfyuiOverviewProps {
  onSelectInstance: (instanceId: string) => void;
}

function formatLastSeen(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 300_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return `${Math.floor(diff / 86400_000)} 天前`;
}

function formatVRAM(vramFree?: number, vramTotal?: number): string {
  if (!vramTotal) return "未知";
  const freeGB = ((vramFree || 0) / 1024 / 1024 / 1024).toFixed(1);
  const totalGB = (vramTotal / 1024 / 1024 / 1024).toFixed(1);
  return `${freeGB}GB / ${totalGB}GB`;
}

function getStatusColor(health: ComfyuiInstanceHealth): string {
  switch (health) {
    case "online":
      return "var(--starlight-success)";
    case "degraded":
      return "var(--starlight-warning)";
    case "offline":
      return "var(--starlight-danger)";
    default:
      return "var(--starlight-muted)";
  }
}

function getStatusText(health: ComfyuiInstanceHealth): string {
  switch (health) {
    case "online":
      return "在线";
    case "degraded":
      return "降级";
    case "offline":
      return "离线";
    default:
      return "未知";
  }
}

function resolveDisplayHealth(
  instance: ComfyuiInstanceRecord,
  testResult?: ComfyuiConnectionTestResult,
): ComfyuiInstanceHealth {
  if (testResult && !testResult.success && instance.health === "online") return "degraded";
  return instance.health;
}

export function AdminComfyuiOverview({ onSelectInstance }: ComfyuiOverviewProps) {
  const [instances, setInstances] = useState<ComfyuiInstanceRecord[]>([]);
  const [sharedWorkflows, setSharedWorkflows] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [testingInstances, setTestingInstances] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, ComfyuiConnectionTestResult>>(new Map());

  async function loadInstances() {
    setLoading(true);
    setMessage("");
    try {
      const result = await adminComfyuiApi.listInstances();
      setInstances(result.instances);
      setSharedWorkflows(result.sharedWorkflows.length);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function testConnection(instanceId: string) {
    setTestingInstances((prev) => new Set(prev).add(instanceId));
    setMessage("");
    try {
      const result = await adminComfyuiApi.testConnection(instanceId);
      setTestResults((prev) => new Map(prev).set(instanceId, result));
      if (!result.success) {
        setMessage(`连接测试失败: ${result.error || "未知错误"}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setTestResults((prev) =>
        new Map(prev).set(instanceId, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setTestingInstances((prev) => {
        const next = new Set(prev);
        next.delete(instanceId);
        return next;
      });
    }
  }

  useEffect(() => {
    void loadInstances();
  }, []);

  const onlineCount = instances.filter((item) => resolveDisplayHealth(item, testResults.get(item.id)) === "online").length;
  const offlineCount = instances.filter((item) => resolveDisplayHealth(item, testResults.get(item.id)) === "offline").length;

  return (
    <section className="admin-comfyui-overview-page">
      <AdminWorkspaceBand
        className="admin-comfyui-band"
        kicker="ComfyUI Instance Pool"
        title="ComfyUI 实例池管理"
        description="管理多台 ComfyUI 机器、测试连通性、查看实时状态、配置工作流。"
        currentLabel={`${instances.length} 台机器`}
        currentDescription={`${onlineCount} 在线 · ${offlineCount} 离线 · ${sharedWorkflows} 个共享工作流`}
        actions={
          <div className="admin-comfyui-band__actions">
            <button type="button" onClick={() => void loadInstances()} disabled={loading}>
              <RefreshCw aria-hidden="true" />
              刷新
            </button>
            <button type="button" onClick={() => onSelectInstance("new")} disabled={loading}>
              <Plus aria-hidden="true" />
              新增实例
            </button>
          </div>
        }
        footer={null}
      />

      {message ? <div className="error-banner">{message}</div> : null}

      <div className="admin-comfyui-metrics">
        <div className="metric-card">
          <div className="metric-card__label">总实例数</div>
          <div className="metric-card__value">{instances.length}</div>
        </div>
        <div className="metric-card metric-card--success">
          <div className="metric-card__label">在线</div>
          <div className="metric-card__value">{onlineCount}</div>
        </div>
        <div className="metric-card metric-card--danger">
          <div className="metric-card__label">离线</div>
          <div className="metric-card__value">{offlineCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__label">共享工作流</div>
          <div className="metric-card__value">{sharedWorkflows}</div>
        </div>
      </div>

      <div className="admin-comfyui-instance-grid">
        {instances.length === 0 && !loading ? (
          <div className="empty-state">
            <p>还没有 ComfyUI 实例</p>
            <button type="button" onClick={() => onSelectInstance("new")}>
              <Plus aria-hidden="true" />
              新增第一台机器
            </button>
          </div>
        ) : null}

        {instances.map((instance) => {
          const testResult = testResults.get(instance.id);
          const isTesting = testingInstances.has(instance.id);
          const gpu = testResult?.systemStats?.devices?.[0];
          const queue = testResult?.queueInfo;
          const effectiveHealth = resolveDisplayHealth(instance, testResult);

          return (
            <article key={instance.id} className="admin-comfyui-instance-card" data-health={effectiveHealth}>
              <header className="admin-comfyui-instance-card__header">
                <div className="admin-comfyui-instance-card__title">
                  <span className="status-indicator" style={{ backgroundColor: getStatusColor(effectiveHealth) }} />
                  <h3>{instance.name}</h3>
                  <span className="status-badge">{getStatusText(effectiveHealth)}</span>
                </div>
                <div className="admin-comfyui-instance-card__meta">
                  {testResult?.success && testResult.latency ? (
                    <span className="latency">{testResult.latency}ms</span>
                  ) : null}
                  <span className="last-seen">{formatLastSeen(instance.lastSeenAt)}</span>
                </div>
              </header>

              <div className="admin-comfyui-instance-card__body">
                <div className="info-row">
                  <span className="info-label">执行地址:</span>
                  <span className="info-value">{instance.baseUrl}</span>
                </div>
                {instance.reportedBaseUrl ? (
                  <div className="info-row">
                    <span className="info-label">机器 ComfyUI:</span>
                    <span className="info-value">{instance.reportedBaseUrl}</span>
                  </div>
                ) : null}
                {instance.tailscaleAddress ? (
                  <div className="info-row">
                    <span className="info-label">Tailscale:</span>
                    <span className="info-value">{instance.tailscaleAddress}</span>
                  </div>
                ) : null}
                <div className="info-row">
                  <span className="info-label">能力:</span>
                  <span className="info-value">{instance.capabilities.join(", ") || "未配置"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">并发:</span>
                  <span className="info-value">{instance.concurrency}</span>
                </div>

                {testResult?.success && gpu ? (
                  <>
                    <div className="info-row">
                      <span className="info-label">GPU:</span>
                      <span className="info-value">{gpu.name || "未知"}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">VRAM:</span>
                      <span className="info-value">{formatVRAM(gpu.vram_free, gpu.vram_total)}</span>
                    </div>
                    {queue ? (
                      <div className="info-row">
                        <span className="info-label">队列:</span>
                        <span className="info-value">
                          {queue.running || 0} 运行中 · {queue.pending || 0} 等待中
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {testResult && !testResult.success ? (
                  <div className="connection-error">
                    <strong>连接失败</strong>
                    <p>{testResult.error}</p>
                  </div>
                ) : null}
              </div>

              <footer className="admin-comfyui-instance-card__footer">
                <button type="button" onClick={() => void testConnection(instance.id)} disabled={isTesting}>
                  <Zap aria-hidden="true" />
                  {isTesting ? "测试中..." : "测试连接"}
                </button>
                <button type="button" onClick={() => onSelectInstance(instance.id)}>
                  <Settings aria-hidden="true" />
                  管理
                </button>
                <button type="button" onClick={() => onSelectInstance(instance.id)}>
                  <Activity aria-hidden="true" />
                  详情
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
