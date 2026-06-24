import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, CloudUpload } from 'lucide-react';

import type { CloudUploadTargetConfig } from '../types/canvas';
import { CLOUD_UPLOAD_LABELS } from './apiSettingsHelpers';

interface CloudUploadSummaryView {
  totalCount: number;
  enabledCount: number;
  configuredCount: number;
  defaultLabel: string;
}

interface ApiSettingsCloudUploadSectionProps {
  open: boolean;
  isPixel: boolean;
  hintClassName: string;
  targets: CloudUploadTargetConfig[];
  activeTargetId?: string;
  summary: CloudUploadSummaryView;
  detailPanel: ReactNode;
  onToggle: () => void;
  onSelectTarget: (targetId: string) => void;
}

export default function ApiSettingsCloudUploadSection({
  open,
  isPixel,
  hintClassName,
  targets,
  activeTargetId,
  summary,
  detailPanel,
  onToggle,
  onSelectTarget,
}: ApiSettingsCloudUploadSectionProps) {
  return (
    <div className="t8-api-settings-divider pt-3 border-t">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-open={open}
        className={
          isPixel
            ? 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 px-btn'
            : 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition'
        }
      >
        <CloudUpload size={14} className="t8-api-settings-icon" />
        <span className="text-xs font-bold shrink-0">云端上传目标【可选】</span>
        <span className={`hidden sm:inline text-[11px] ${hintClassName}`}>素材右键上传到对象存储或网盘，不影响主流程</span>
        <span className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
          <span
            className="t8-api-settings-badge px-1.5 py-0.5 text-[10px] rounded border"
            data-tone={summary.enabledCount > 0 ? 'success' : 'muted'}
          >
            已启用 {summary.enabledCount}/{summary.totalCount || 4}
          </span>
          <span className={`text-[10px] ${hintClassName}`}>已配置 {summary.configuredCount}</span>
        </span>
        <span className={`flex items-center gap-1 text-[11px] ${hintClassName}`}>
          {open ? '收起' : '展开'}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {!open && (
        <div className={`text-[11px] mt-2 ${hintClassName}`}>
          未启用时右键菜单不会出现云端上传目标；已启用后可把图像 / 视频 / 音频复制到外部存储。
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <div className={`text-[11px] leading-relaxed ${hintClassName}`}>
            这里用于外部归档与分享。第一版腾讯云 COS 和阿里云 OSS 支持真实上传；百度网盘和夸克网盘先保留配置位，等稳定授权或 CLI 方案接入后会复用同一个入口。
            {summary.defaultLabel ? ` 当前默认目标：${summary.defaultLabel}。` : ''}
          </div>
          {targets.length === 0 ? (
            <div className={`text-xs ${hintClassName}`}>后端尚未返回云端上传目标，请先保存或刷新设置。</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-3 items-start">
              <div className={`space-y-2 min-w-0 ${isPixel ? '' : 'lg:sticky lg:top-0'}`}>
                {targets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => onSelectTarget(target.id)}
                    data-active={activeTargetId === target.id}
                    data-enabled={!!target.enabled}
                    className={
                      isPixel
                        ? 't8-api-settings-provider-card w-full !block text-left px-2 py-2 px-btn'
                        : 't8-api-settings-provider-card w-full block text-left px-2 py-2 rounded-md border text-xs transition'
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${target.enabled ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                      <span className="font-bold min-w-0 truncate">{target.label || CLOUD_UPLOAD_LABELS[target.provider] || target.id}</span>
                      <span className={`ml-auto text-[10px] shrink-0 ${target.enabled ? 'text-emerald-500' : hintClassName}`}>
                        {target.enabled ? '已启用' : '未启用'}
                      </span>
                    </div>
                    <div className={`mt-1 text-[10px] leading-snug ${hintClassName}`}>
                      {CLOUD_UPLOAD_LABELS[target.provider] || target.provider}
                      {target.isDefault ? ' · 默认' : ''}
                    </div>
                  </button>
                ))}
              </div>
              <div className="min-w-0">{detailPanel}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
