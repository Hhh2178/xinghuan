import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ServerCog } from 'lucide-react';

import type { AdvancedProviderConfig } from '../types/canvas';
import { ADVANCED_PROVIDER_GUIDES, ADVANCED_PROVIDER_LABELS } from './apiSettingsHelpers';

interface AdvancedProviderSummaryView {
  enabledCount: number;
  configuredKeyCount: number;
  comfyuiConfigured: boolean;
  jimengConfigured: boolean;
}

interface ApiSettingsAdvancedProvidersSectionProps {
  open: boolean;
  isPixel: boolean;
  hintClassName: string;
  providers: AdvancedProviderConfig[];
  activeProviderId?: string;
  summary: AdvancedProviderSummaryView;
  detailPanel: ReactNode;
  onToggle: () => void;
  onSelectProvider: (providerId: string) => void;
}

export default function ApiSettingsAdvancedProvidersSection({
  open,
  isPixel,
  hintClassName,
  providers,
  activeProviderId,
  summary,
  detailPanel,
  onToggle,
  onSelectProvider,
}: ApiSettingsAdvancedProvidersSectionProps) {
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
        <ServerCog size={14} className="t8-api-settings-icon" />
        <span className="text-xs font-bold shrink-0">扩展 API 平台【高级/可选】</span>
        <span className={`hidden sm:inline text-[11px] ${hintClassName}`}>给高级用户接入第三方平台，默认不影响主流程</span>
        <span className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
          <span
            className="t8-api-settings-badge px-1.5 py-0.5 text-[10px] rounded border"
            data-tone={summary.enabledCount > 0 ? 'success' : 'muted'}
          >
            已启用 {summary.enabledCount}/{providers.length || 5}
          </span>
          <span className={`text-[10px] ${hintClassName}`}>密钥 {summary.configuredKeyCount}</span>
        </span>
        <span className={`flex items-center gap-1 text-[11px] ${hintClassName}`}>
          {open ? '收起' : '展开'}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {!open && (
        <div className={`text-[11px] mt-2 ${hintClassName}`}>
          未配置或未启用时不会影响贞贞工坊、RunningHub、LLM 独立 Key 等主流程。
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <div className={`text-[11px] leading-relaxed ${hintClassName}`}>
            这里不是必填项。它只用于 ModelScope、火山引擎、本地 ComfyUI、即梦 CLI 和 OpenAI 兼容接口；平台开启后，还需要在具体节点的“高级来源”里选择它才会生效。
            当前状态：已启用 {summary.enabledCount} 个，已配置密钥 {summary.configuredKeyCount} 个，ComfyUI {summary.comfyuiConfigured ? '已填写地址' : '未填写地址'}，即梦 CLI {summary.jimengConfigured ? '已填写路径' : '未填写路径'}。
          </div>
          {providers.length === 0 ? (
            <div className={`text-xs ${hintClassName}`}>后端尚未返回扩展平台卡片，请先保存或刷新设置。</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-3 items-start">
              <div className={`space-y-2 min-w-0 ${isPixel ? '' : 'lg:sticky lg:top-0'}`}>
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => onSelectProvider(provider.id)}
                    data-active={activeProviderId === provider.id}
                    data-enabled={!!provider.enabled}
                    className={
                      isPixel
                        ? 't8-api-settings-provider-card w-full !block text-left px-2 py-2 px-btn'
                        : 't8-api-settings-provider-card w-full block text-left px-2 py-2 rounded-md border text-xs transition'
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${provider.enabled ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                      <span className="font-bold min-w-0 truncate">{ADVANCED_PROVIDER_LABELS[provider.protocol] || provider.label || provider.id}</span>
                      <span className={`ml-auto text-[10px] shrink-0 ${provider.enabled ? 'text-emerald-500' : hintClassName}`}>
                        {provider.enabled ? '已启用' : '未启用'}
                      </span>
                    </div>
                    <div className={`mt-1 text-[10px] leading-snug ${hintClassName}`}>
                      {ADVANCED_PROVIDER_GUIDES[provider.protocol]?.nodeScopes.join(' / ') || provider.protocol}
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
