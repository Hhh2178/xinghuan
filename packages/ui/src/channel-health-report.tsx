import { Activity, AudioLines, Image, MessageSquareText, ThumbsDown, ThumbsUp, Video } from "lucide-react";
import type { ChangeEvent } from "react";

import type {
  ChannelFeedbackVote,
  ChannelHealthCapability,
  ChannelHealthModel,
  ChannelHealthReport,
  ChannelHealthState,
} from "@xinghuan/shared";

const CAPABILITIES: Array<{ id: ChannelHealthCapability; label: string; Icon: typeof Image }> = [
  { id: "image", label: "图像", Icon: Image },
  { id: "video", label: "视频", Icon: Video },
  { id: "audio", label: "音频", Icon: AudioLines },
  { id: "chat", label: "LLM", Icon: MessageSquareText },
];

export interface ChannelHealthReportViewProps {
  report: ChannelHealthReport;
  selectedCapability: ChannelHealthCapability;
  onSelectedCapabilityChange?: (capability: ChannelHealthCapability) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  interactiveFeedback?: boolean;
  votingModelKey?: string;
  onVote?: (providerId: string, modelRecordId: string, vote: ChannelFeedbackVote) => void;
  surface?: "member" | "admin";
  className?: string;
}

export function ChannelHealthReportView({
  report,
  selectedCapability,
  onSelectedCapabilityChange,
  query = "",
  onQueryChange,
  interactiveFeedback = false,
  votingModelKey = "",
  onVote,
  surface = "member",
  className,
}: ChannelHealthReportViewProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const capabilityCounts = new Map<ChannelHealthCapability, number>(CAPABILITIES.map(({ id }) => [id, 0]));
  for (const provider of report.providers) {
    for (const model of provider.models) capabilityCounts.set(model.capability, (capabilityCounts.get(model.capability) || 0) + 1);
  }
  const providers = report.providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.capability === selectedCapability && matchesQuery(provider.name, model, normalizedQuery)),
    }))
    .filter((provider) => provider.models.length > 0);

  return (
    <div className={["xh-channel-health", `xh-channel-health--${surface}`, className].filter(Boolean).join(" ")} data-channel-health-surface={surface}>
      <aside className="xh-channel-health__rail" aria-label="渠道类型">
        <div className="xh-channel-health__rail-title"><Activity size={17} />渠道状态</div>
        <div className="xh-channel-health__tabs">
          {CAPABILITIES.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={id === selectedCapability ? "is-active" : ""} aria-pressed={id === selectedCapability} onClick={() => onSelectedCapabilityChange?.(id)}>
              <Icon size={15} /><span>{label}</span><em>{capabilityCounts.get(id) || 0}</em>
            </button>
          ))}
        </div>
        <div className="xh-channel-health__legend">
          <span data-state="healthy">畅通</span><span data-state="degraded">轻微波动</span><span data-state="unhealthy">异常</span><span data-state="insufficient_sample">样本不足</span>
        </div>
      </aside>
      <section className="xh-channel-health__main">
        <header className="xh-channel-health__search">
          <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange?.(event.target.value)} placeholder="搜索服务商或模型" aria-label="搜索服务商或模型" />
        </header>
        <div className="xh-channel-health__providers">
          {providers.map((provider) => (
            <section className="xh-channel-health__provider" key={provider.id} data-state={provider.state} data-channel-provider-name={provider.name} aria-label={`${provider.name} 渠道状态`}>
              <header className="xh-channel-health__provider-header"><strong title={provider.name}>{provider.name}</strong><span>{providerStateLabel(provider.state)}</span></header>
              <div className="xh-channel-health__models" role="table" aria-label={`${provider.name} 模型状态`}>
                <div className="xh-channel-health__columns" role="row">
                  <span role="columnheader" data-channel-column="identity">模型 / 状态</span>
                  <span role="columnheader" data-channel-column="rate">成功率 / 请求数</span>
                  <span role="columnheader" data-channel-column="trend">近 72 小时走向</span>
                  <span role="columnheader" data-channel-column="feedback">用户反馈</span>
                </div>
                {provider.models.map((model) => <ChannelHealthModelRow key={model.modelRecordId} model={model} report={report} interactiveFeedback={interactiveFeedback} voting={votingModelKey === modelKey(model)} onVote={onVote} />)}
              </div>
            </section>
          ))}
          {!providers.length ? <div className="xh-channel-health__empty">暂无匹配渠道</div> : null}
        </div>
      </section>
    </div>
  );
}

function ChannelHealthModelRow({ model, report, interactiveFeedback, voting, onVote }: {
  model: ChannelHealthModel;
  report: ChannelHealthReport;
  interactiveFeedback: boolean;
  voting: boolean;
  onVote?: (providerId: string, modelRecordId: string, vote: ChannelFeedbackVote) => void;
}) {
  const bucketByStart = new Map(model.buckets.map((bucket) => [bucket.startAt, bucket]));
  const positions = Array.from({ length: report.bucketCount }, (_, index) => {
    const startAt = report.windowStartAt + index * report.bucketHours * 60 * 60 * 1000;
    return bucketByStart.get(startAt) || null;
  });
  const segments = trendSegments(positions);
  const feedback = model.feedback;

  return (
    <article className="xh-channel-health__model" data-state={model.state} data-provider-id={model.providerId} data-model-record-id={model.modelRecordId} role="row">
      <div className="xh-channel-health__identity" data-channel-cell="identity" role="cell"><span className="xh-channel-health__state-dot" aria-hidden="true" /><strong title={model.displayName}>{model.displayName}</strong><small>{modelStateLabel(model.state)}</small></div>
      <div className="xh-channel-health__rate" data-channel-cell="rate" role="cell"><strong>{model.successRate === null ? "--" : percent(model.successRate)}</strong><span>成功 {model.succeeded} · 失败 {model.failed}</span></div>
      <div className="xh-channel-health__trend" data-channel-cell="trend" role="cell">
        <svg viewBox="0 0 360 64" role="img" aria-label={`${model.displayName} 成功率走向`} preserveAspectRatio="none">
          {segments.map((segment, index) => <path data-trend-segment={index} key={`${segment}-${index}`} d={segment} />)}
        </svg>
        <div className="xh-channel-health__axis"><span>72小时前</span><span>现在</span></div>
        <div className="xh-channel-health__buckets">
          {positions.map((bucket, index) => <span key={index} data-channel-bucket={index} data-empty={bucket ? "false" : "true"} data-state={bucketState(bucket)} title={bucket ? `${percent(bucket.successRate)} · 成功 ${bucket.succeeded} · 失败 ${bucket.failed}` : "没有已结束请求"} />)}
        </div>
      </div>
      <div className="xh-channel-health__feedback" data-channel-cell="feedback" role="cell">
        <div><span>{feedback.window === "24h" ? "近24小时" : "近3天回溯"}</span><strong>{feedback.total ? `${percent(feedback.upRate || 0)} 赞` : "近3天暂无评价"}</strong></div>
        <div className="xh-channel-health__feedback-bar" aria-hidden="true"><i style={{ width: `${Math.round((feedback.upRate || 0) * 100)}%` }} /></div>
        {interactiveFeedback ? (
          <div className="xh-channel-health__vote-actions">
            <button type="button" aria-label={`赞 ${model.displayName}`} disabled={voting || !onVote} data-selected={feedback.viewerVote === "up" ? "true" : "false"} onClick={() => onVote?.(model.providerId, model.modelRecordId, "up")}><ThumbsUp size={13} />赞 {feedback.up}</button>
            <button type="button" aria-label={`踩 ${model.displayName}`} disabled={voting || !onVote} data-selected={feedback.viewerVote === "down" ? "true" : "false"} onClick={() => onVote?.(model.providerId, model.modelRecordId, "down")}><ThumbsDown size={13} />踩 {feedback.down}</button>
          </div>
        ) : <div className="xh-channel-health__feedback-counts">赞 {feedback.up} · 踩 {feedback.down}</div>}
      </div>
    </article>
  );
}

function matchesQuery(providerName: string, model: ChannelHealthModel, query: string): boolean {
  if (!query) return true;
  return [providerName, model.displayName, model.nativeModelId].some((value) => value.toLowerCase().includes(query));
}

function trendSegments(positions: Array<ChannelHealthModel["buckets"][number] | null>): string[] {
  const width = 360;
  const height = 64;
  const points = positions.length - 1 || 1;
  const segments: string[] = [];
  let path = "";
  positions.forEach((bucket, index) => {
    if (!bucket || !bucket.sufficientSample) {
      if (path) segments.push(path);
      path = "";
      return;
    }
    const x = (index / points) * width;
    const y = 8 + (1 - bucket.successRate) * (height - 16);
    path += path ? ` L ${x.toFixed(2)} ${y.toFixed(2)}` : `M ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  if (path) segments.push(path);
  return segments;
}

function bucketState(bucket: ChannelHealthModel["buckets"][number] | null): ChannelHealthState | "empty" {
  if (!bucket) return "empty";
  if (!bucket.sufficientSample) return "insufficient_sample";
  if (bucket.successRate >= 0.95) return "healthy";
  if (bucket.successRate >= 0.8) return "degraded";
  return "unhealthy";
}

function modelStateLabel(state: ChannelHealthState): string {
  return ({ healthy: "畅通", degraded: "轻微波动", unhealthy: "异常", insufficient_sample: "样本不足", no_recent_requests: "暂无近期请求" } as const)[state];
}

function providerStateLabel(state: ChannelHealthState): string {
  return ({ healthy: "整体畅通", degraded: "存在波动", unhealthy: "存在异常", insufficient_sample: "样本不足", no_recent_requests: "暂无近期请求" } as const)[state];
}

function percent(value: number): string {
  return `${(value * 100).toFixed(value * 100 >= 10 ? 0 : 1)}%`;
}

function modelKey(model: ChannelHealthModel): string {
  return `${model.providerId}::${model.modelRecordId}`;
}
