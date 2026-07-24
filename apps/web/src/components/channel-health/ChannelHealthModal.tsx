import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { ChannelHealthReportView } from "@xinghuan/ui";

import { useThemeStore } from "../../stores/theme";
import { useChannelHealth } from "./useChannelHealth";
import "./channel-health.css";

export default function ChannelHealthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, style } = useThemeStore();
  const [selectedCapability, setSelectedCapability] = useState<"image" | "video" | "audio" | "chat">("image");
  const [query, setQuery] = useState("");
  const channelHealth = useChannelHealth(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const refreshDisabled = channelHealth.refreshing || Date.now() < channelHealth.manualCooldownUntil;
  const updatedLabel = channelHealth.lastLoadedAt
    ? `更新于 ${new Date(channelHealth.lastLoadedAt).toLocaleTimeString("zh-CN", { hour12: false })}`
    : "等待首次更新";

  return (
    <div className={`xh-channel-health-modal ${theme === "dark" ? "is-dark" : "is-light"} ${style === "pixel" ? "is-pixel" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="xh-channel-health-modal__panel" role="dialog" aria-modal="true" aria-label="渠道状态">
        <header className="xh-channel-health-modal__header">
          <div><strong>渠道状态</strong><span>{channelHealth.stale ? "数据可能已过期" : updatedLabel}</span></div>
          <div className="xh-channel-health-modal__actions">
            <button type="button" className="t8-mini-icon-button" title="刷新渠道状态" aria-label="刷新渠道状态" disabled={refreshDisabled} onClick={() => void channelHealth.refresh(true)}><RefreshCw size={16} className={channelHealth.refreshing ? "is-spinning" : ""} /></button>
            <button type="button" className="t8-mini-icon-button" title="关闭渠道状态" aria-label="关闭渠道状态" onClick={onClose}><X size={17} /></button>
          </div>
        </header>
        {channelHealth.error ? <div className="xh-channel-health-modal__error">{channelHealth.error}</div> : null}
        {channelHealth.loading && !channelHealth.report ? <div className="xh-channel-health-modal__loading">加载渠道状态</div> : null}
        {channelHealth.report ? <ChannelHealthReportView
          report={channelHealth.report}
          selectedCapability={selectedCapability}
          onSelectedCapabilityChange={setSelectedCapability}
          query={query}
          onQueryChange={setQuery}
          interactiveFeedback
          votingModelKey={channelHealth.votingModelKey}
          onVote={channelHealth.vote}
        /> : null}
      </section>
    </div>
  );
}
