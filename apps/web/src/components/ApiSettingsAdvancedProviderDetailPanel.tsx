import { ExternalLink, Info, TestTube2 } from 'lucide-react';

import type { AdvancedProviderConfig } from '../types/canvas';
import { parseAdvancedProviderModelText, stringifyAdvancedProviderModels } from '../utils/advancedProviders';
import {
  ADVANCED_PROVIDER_GUIDES,
  ADVANCED_PROVIDER_LABELS,
  JIMENG_CLI_INSTALL_COMMAND,
  MODELSCOPE_TOKEN_URLS,
  type AdvancedProviderComfyDraft,
} from './apiSettingsHelpers';
import ApiSettingsComfyWorkflowPanel from './ApiSettingsComfyWorkflowPanel';
import ApiSettingsFormBlock from './ApiSettingsFormBlock';
import ApiSettingsModelscopeLoraPanel from './ApiSettingsModelscopeLoraPanel';

interface AdvancedProviderTestStatus {
  loading?: boolean;
  ok?: boolean;
  message?: string;
}

interface ApiSettingsAdvancedProviderDetailPanelProps {
  provider: AdvancedProviderConfig;
  isPixel: boolean;
  inputClassName: string;
  labelClassName: string;
  hintClassName: string;
  linkButtonClassName: string;
  linkAltButtonClassName: string;
  testStatus?: AdvancedProviderTestStatus;
  comfyDraft?: AdvancedProviderComfyDraft;
  onUpdateProvider: (id: string, patch: Partial<AdvancedProviderConfig>) => void;
  onUpdateProviderNested: (
    id: string,
    key: 'modelscopeConfig' | 'volcengineConfig' | 'comfyuiConfig' | 'jimengConfig',
    patch: Record<string, any>,
  ) => void;
  onTestProvider: (provider: AdvancedProviderConfig) => void;
  onOpenExternal: (url: string) => void;
  onSetComfyDraft: (providerId: string, patch: AdvancedProviderComfyDraft) => void;
  onSetProviderTestStatus: (providerId: string, next: AdvancedProviderTestStatus) => void;
}

export default function ApiSettingsAdvancedProviderDetailPanel({
  provider,
  isPixel,
  inputClassName,
  labelClassName,
  hintClassName,
  linkButtonClassName,
  linkAltButtonClassName,
  testStatus,
  comfyDraft,
  onUpdateProvider,
  onUpdateProviderNested,
  onTestProvider,
  onOpenExternal,
  onSetComfyDraft,
  onSetProviderTestStatus,
}: ApiSettingsAdvancedProviderDetailPanelProps) {
  const protocolLabel = ADVANCED_PROVIDER_LABELS[provider.protocol] || provider.protocol;
  const guide = ADVANCED_PROVIDER_GUIDES[provider.protocol];
  const isComfy = provider.protocol === 'comfyui';
  const isJimeng = provider.protocol === 'jimeng-cli';
  const isVolc = provider.protocol === 'volcengine';
  const isModelScope = provider.protocol === 'modelscope';
  const sectionCls = isPixel
    ? 't8-api-settings-provider-panel border p-3 space-y-4 min-w-0'
    : 't8-api-settings-provider-panel border rounded-xl p-3 sm:p-4 space-y-4 min-w-0';
  const formBlockCls = isPixel
    ? 't8-api-settings-section border p-3 space-y-3'
    : 't8-api-settings-section rounded-lg border p-3 space-y-3';
  const fieldInputCls = `${inputClassName.replace('flex-1 ', '')} w-full min-w-0`;
  const textareaCls = `${fieldInputCls} min-h-[76px] resize-y font-mono text-xs leading-relaxed`;
  const guideBoxCls = isPixel
    ? 't8-api-settings-guide border p-3 text-[11px] leading-relaxed'
    : 't8-api-settings-guide rounded-lg border p-3 text-[11px] leading-relaxed';
  const smallPillCls = isPixel
    ? 't8-api-settings-pill inline-flex items-center px-1.5 py-0.5 border text-[10px] font-bold'
    : 't8-api-settings-pill inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] font-semibold';

  return (
    <div className={sectionCls}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-black ${labelClassName}`}>{provider.label || protocolLabel}</span>
            <span className={smallPillCls}>{protocolLabel}</span>
            <span className={provider.enabled ? 'text-[11px] font-bold text-emerald-500' : `text-[11px] font-bold ${hintClassName}`}>
              {provider.enabled ? '已启用' : '未启用'}
            </span>
          </div>
          <p className={`mt-1 text-[11px] leading-relaxed ${hintClassName}`}>{guide?.subtitle}</p>
        </div>
        <label className={`flex items-center gap-2 text-xs font-bold shrink-0 ${labelClassName}`}>
          <input
            type="checkbox"
            checked={!!provider.enabled}
            onChange={(event) => onUpdateProvider(provider.id, { enabled: event.target.checked })}
          />
          在节点中显示
        </label>
        <button
          type="button"
          onClick={() => onTestProvider(provider)}
          disabled={!!testStatus?.loading}
          className={
            isPixel
              ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0'
              : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0 inline-flex items-center gap-1'
          }
        >
          <TestTube2 size={12} />
          {testStatus?.loading ? '测试中...' : '测试连接'}
        </button>
      </div>

      {testStatus?.message && (
        <div className={testStatus.ok ? 'text-[11px] text-emerald-500' : 'text-[11px] text-red-400'}>
          {testStatus.message}
        </div>
      )}

      <div className={guideBoxCls}>
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold">这是什么？</div>
            <p>{guide?.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(guide?.nodeScopes || []).map((scope) => (
                <span key={scope} className={smallPillCls}>{scope}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ApiSettingsFormBlock
        className={formBlockCls}
        labelClassName={labelClassName}
        hintClassName={hintClassName}
        title="1. 基础信息"
        note="显示名称只影响下拉菜单里的名字；关闭“在节点中显示”后，这个平台不会出现在图像 / 视频 / LLM 节点的高级来源里。"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={`text-[11px] ${labelClassName}`}>显示名称</span>
            <input
              value={provider.label || ''}
              onChange={(event) => onUpdateProvider(provider.id, { label: event.target.value })}
              className={fieldInputCls}
              placeholder={protocolLabel}
            />
          </label>
          {!isJimeng && (
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>{isComfy ? '默认实例地址' : 'Base URL'}</span>
              <input
                value={provider.baseUrl || ''}
                onChange={(event) => onUpdateProvider(provider.id, { baseUrl: event.target.value })}
                className={fieldInputCls}
                placeholder={guide?.baseUrlPlaceholder || 'https://api.example.com/v1'}
              />
            </label>
          )}
        </div>
      </ApiSettingsFormBlock>

      {!isComfy && !isJimeng && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="2. 连接密钥"
          note={guide?.connectionHint}
        >
          <label className="space-y-1 block">
            <span className={`text-[11px] ${labelClassName}`}>{guide?.keyLabel || 'API Key / Token'}</span>
            <input
              type="password"
              value={provider.apiKey || ''}
              onChange={(event) => onUpdateProvider(provider.id, { apiKey: event.target.value })}
              className={fieldInputCls}
              placeholder={provider.hasApiKey || provider.apiKey ? '留空或保留 **** 表示不覆盖后端密钥' : '请输入 API Key'}
            />
          </label>
          {isModelScope && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenExternal(MODELSCOPE_TOKEN_URLS.cn)}
                className={linkButtonClassName}
                title="打开 ModelScope 国内站 Token 页面"
              >
                <ExternalLink size={11} /> 获取 Token · 国内
              </button>
              <button
                type="button"
                onClick={() => onOpenExternal(MODELSCOPE_TOKEN_URLS.intl)}
                className={linkAltButtonClassName}
                title="打开 ModelScope 国际站 Token 页面"
              >
                <ExternalLink size={11} /> 获取 Token · 国外
              </button>
            </div>
          )}
        </ApiSettingsFormBlock>
      )}

      {isVolc && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="3. 火山高级项（可选）"
          note="普通 Ark / Seedream / Seedance 调用通常只需要上面的 API Key。只有需要素材上传或特定项目隔离时，再补充这些字段。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Project</span>
              <input
                value={provider.volcengineConfig?.project || ''}
                onChange={(event) => onUpdateProviderNested(provider.id, 'volcengineConfig', { project: event.target.value })}
                className={fieldInputCls}
                placeholder="可选，例如 default"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>Region</span>
              <input
                value={provider.volcengineConfig?.region || ''}
                onChange={(event) => onUpdateProviderNested(provider.id, 'volcengineConfig', { region: event.target.value })}
                className={fieldInputCls}
                placeholder="cn-beijing"
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>素材 Access Key ID</span>
              <input
                type="password"
                value={provider.volcengineConfig?.accessKeyId || ''}
                onChange={(event) => onUpdateProviderNested(provider.id, 'volcengineConfig', { accessKeyId: event.target.value })}
                className={fieldInputCls}
                placeholder={provider.volcengineConfig?.hasAccessKeyId ? '留空保持不变' : '可选'}
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>素材 Secret Access Key</span>
              <input
                type="password"
                value={provider.volcengineConfig?.secretAccessKey || ''}
                onChange={(event) => onUpdateProviderNested(provider.id, 'volcengineConfig', { secretAccessKey: event.target.value })}
                className={fieldInputCls}
                placeholder={provider.volcengineConfig?.hasSecretAccessKey ? '留空保持不变' : '可选'}
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}

      {isComfy && (
        <ApiSettingsComfyWorkflowPanel
          provider={provider}
          isPixel={isPixel}
          inputClassName={inputClassName}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          guideBoxClassName={guideBoxCls}
          draft={comfyDraft}
          onUpdateProviderNested={onUpdateProviderNested}
          onSetComfyDraft={onSetComfyDraft}
          onSetProviderTestStatus={onSetProviderTestStatus}
        />
      )}

      {isJimeng && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="2. 本地 CLI"
          note={guide?.connectionHint}
        >
          <div className={guideBoxCls}>
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-2">
                <div className={`font-bold ${labelClassName}`}>如何安装即梦 CLI？</div>
                <p className={hintClassName}>
                  在 PowerShell 7、Git Bash 或 WSL 终端执行安装命令；安装完成后运行 <code className="font-mono">dreamina login</code> 登录，再回到这里点击“测试连接”。
                </p>
                <code className="block w-full overflow-x-auto rounded border px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                  {JIMENG_CLI_INSTALL_COMMAND}
                </code>
                <p className={hintClassName}>
                  Windows 常见路径是 <code className="font-mono">C:\Users\&lt;用户名&gt;\bin\dreamina.exe</code>；如果命令已加入 PATH，可直接填写 <code className="font-mono">dreamina</code>。装在 WSL 里时，勾选下面的 WSL 选项并填写发行版名称。
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1 lg:col-span-2">
              <span className={`text-[11px] ${labelClassName}`}>dreamina 可执行路径</span>
              <input
                value={provider.jimengConfig?.executablePath || ''}
                onChange={(event) => onUpdateProviderNested(provider.id, 'jimengConfig', { executablePath: event.target.value })}
                className={fieldInputCls}
                placeholder="dreamina 或 C:\\path\\dreamina.exe"
              />
            </label>
            <label className={`flex items-center gap-2 text-[11px] ${labelClassName}`}>
              <input
                type="checkbox"
                checked={!!provider.jimengConfig?.useWsl}
                onChange={(event) => onUpdateProviderNested(provider.id, 'jimengConfig', { useWsl: event.target.checked })}
              />
              CLI 装在 WSL 中
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelClassName}`}>WSL 发行版</span>
              <input
                value={provider.jimengConfig?.wslDistro || ''}
                onChange={(event) => onUpdateProviderNested(provider.id, 'jimengConfig', { wslDistro: event.target.value })}
                className={fieldInputCls}
                placeholder="例如 Ubuntu"
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}

      {!isComfy && (
        <ApiSettingsFormBlock
          className={formBlockCls}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          title="3. 节点里可选的模型"
          note={guide?.modelHint}
        >
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <label className="space-y-1 min-w-0">
              <span className={`text-[11px] ${labelClassName}`}>图像模型（一行一个）</span>
              <textarea
                value={stringifyAdvancedProviderModels(provider.imageModels)}
                onChange={(event) => onUpdateProvider(provider.id, { imageModels: parseAdvancedProviderModelText(event.target.value) })}
                className={textareaCls}
                placeholder="例如 gpt-image-1"
              />
            </label>
            <label className="space-y-1 min-w-0">
              <span className={`text-[11px] ${labelClassName}`}>视频模型（一行一个）</span>
              <textarea
                value={stringifyAdvancedProviderModels(provider.videoModels)}
                onChange={(event) => onUpdateProvider(provider.id, { videoModels: parseAdvancedProviderModelText(event.target.value) })}
                className={textareaCls}
                placeholder={isJimeng ? '例如 seedance2.0fast_vip' : '例如 video-model-name'}
              />
            </label>
            <label className="space-y-1 min-w-0">
              <span className={`text-[11px] ${labelClassName}`}>聊天模型（一行一个）</span>
              <textarea
                value={stringifyAdvancedProviderModels(provider.chatModels)}
                onChange={(event) => onUpdateProvider(provider.id, { chatModels: parseAdvancedProviderModelText(event.target.value) })}
                className={textareaCls}
                placeholder={isJimeng ? '即梦 CLI 通常不用填写' : '例如 gpt-4o-mini'}
              />
            </label>
          </div>
        </ApiSettingsFormBlock>
      )}

      {isModelScope && (
        <ApiSettingsModelscopeLoraPanel
          provider={provider}
          isPixel={isPixel}
          inputClassName={inputClassName}
          labelClassName={labelClassName}
          hintClassName={hintClassName}
          linkButtonClassName={linkButtonClassName}
          linkAltButtonClassName={linkAltButtonClassName}
          onUpdateProviderNested={onUpdateProviderNested}
          onOpenExternal={onOpenExternal}
        />
      )}
    </div>
  );
}
